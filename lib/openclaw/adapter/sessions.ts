/**
 * Sessions adapter — loads real sessions from the OpenClaw gateway.
 *
 * Uses POST /tools/invoke with the "sessions_list" tool.
 *
 * Real gateway session shape (from gateway /tools/invoke):
 * {
 *   count: number,
 *   sessions: [{
 *     key, status, updatedAt, startedAt, endedAt,
 *     runtimeMs, childSessions, sessionId, model,
 *     totalTokens, contextTokens, displayName, channel, kind,
 *     origin, deliveryContext, estimatedCostUsd, lastChannel,
 *     transcriptPath, systemSent, abortedLastRun
 *   }]
 * }
 *
 * NOT the same as the OpenClaw MCP types — normalize at this boundary.
 */

import type {
  OpenClawSession,
  SessionStatus,
  AdapterResult,
} from './types';
import { gatewayPost } from './client';

// ---------------------------------------------------------------------------
// Raw gateway types
// ---------------------------------------------------------------------------

interface ToolInvokeResult {
  ok: boolean;
  result?: unknown;
  error?: { type: string; message: string };
}

// Raw session shape from the gateway's sessions_list tool result
interface RawSession {
  key: string;
  status?: string;
  updatedAt?: number;     // Unix ms timestamp
  startedAt?: number;    // Unix ms timestamp
  endedAt?: number;      // Unix ms timestamp
  runtimeMs?: number;
  childSessions?: string[];
  sessionId?: string;
  model?: string;
  totalTokens?: number;
  contextTokens?: number;
  displayName?: string;
  label?: string;  // human-set session label, used as clean title
  channel?: string;
  kind?: string;
  origin?: Record<string, unknown>;
  deliveryContext?: Record<string, unknown>;
  estimatedCostUsd?: number;
  lastChannel?: string;
  transcriptPath?: string;
  systemSent?: number;
  abortedLastRun?: boolean;
}

// ---------------------------------------------------------------------------
// Gateway result wrapper (sessions_list wraps sessions in { count, sessions })
// ---------------------------------------------------------------------------

interface SessionsListResult {
  count?: number;
  sessions?: RawSession[];
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

function normalizeSession(raw: RawSession): OpenClawSession {
  const rawId = raw.key ?? 'unknown';
  // Derive agent from session key pattern: agent:main:main, agent:main:subagent:uuid
  const keyParts = rawId.split(':');
  const agentId = deriveAgentId(rawId, raw.displayName);
  const lastMessageAtMs = raw.updatedAt ?? null;

  return {
    id: rawId,
    shortId: raw.sessionId?.slice(0, 8) ?? keyParts[keyParts.length - 1],
    title: deriveSessionTitle(raw),
    agentId,
    agentName: agentNameFromId(agentId),
    messageCount: raw.totalTokens ?? 0,
    lastMessageAt: lastMessageAtMs ? new Date(lastMessageAtMs).toISOString() : null,
    status: normalizeSessionStatus(raw.status),
    tags: deriveTags(raw),
    preview: raw.displayName ?? raw.key,
    // childSessions is useful metadata — surface via tags if present
  };
}

function deriveAgentId(key: string, displayName?: string): string {
  // Pattern: agent:main:main → nero
  // Pattern: agent:main:subagent:uuid → determine from displayName or default to nero
  // Pattern: agent:main:telegram:* → telegram
  if (key === 'agent:main:main') return 'nero';
  if (key.includes(':telegram:')) return 'nero'; // Telegram sessions handled by Nero
  if (key.includes(':subagent:')) {
    // Subagents — derive from displayName if available
    if (displayName) {
      const lower = displayName.toLowerCase();
      if (lower.includes('hephaestus') || lower.includes('forge')) return 'hephaestus';
      if (lower.includes('argus')) return 'argus';
      if (lower.includes('ariadne')) return 'ariadne';
      if (lower.includes('orion')) return 'orion';
      if (lower.includes('hermes') || lower.includes('mercury')) return 'hermes';
    }
    return 'nero';
  }
  return 'nero';
}

function deriveSessionTitle(raw: RawSession): string {
  // Priority: label (human-set) > displayName (structured) > key (raw)
  if (raw.label) {
    return raw.label.replace(/^(cron:\s*)/i, '').trim();
  }

  if (raw.displayName) {
    // displayName is like "webchat:g-agent-main-main" — clean it up
    const name = raw.displayName
      .replace(/^webchat:/i, '')
      .replace(/^telegram:/i, 'Telegram ')
      .replace(/^cron:/i, '')
      .replace(/g-agent-/g, '')
      .replace(/main-/g, '')
      .replace(/-/g, ' ')
      .replace(/:/g, ' · ');
    return name.charAt(0).toUpperCase() + name.slice(1).trim();
  }

  // Fall back to channel + last key segment
  const channel = raw.channel && raw.channel !== 'unknown' ? raw.channel : null;
  const keyParts = raw.key.split(':');
  const keyType = keyParts[keyParts.length - 2] ?? null;
  const shortKey = keyParts[keyParts.length - 1] ?? raw.key;
  // If the last key segment is a UUID, don't show it — use type + "session"
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(shortKey);
  if (isUuid) {
    const label = keyType ? `${keyType} session` : 'Subagent session';
    return channel ? `${channel} ${label}` : label;
  }
  return channel ? `${channel} ${shortKey}` : shortKey;
}

function agentNameFromId(id: string): string {
  const map: Record<string, string> = {
    nero: 'Nero',
    hephaestus: 'Hephaestus',
    argus: 'Argus',
    ariadne: 'Ariadne',
    orion: 'Orion',
    hermes: 'Hermes',
    forge: 'Hephaestus',
    sentinel: 'Argus',
    studio: 'Ariadne',
    scout: 'Orion',
    mercury: 'Hermes',
    main: 'Nero',
  };
  return map[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
}

function normalizeSessionStatus(s?: string): SessionStatus {
  if (!s) return 'unknown';
  const status = s.toLowerCase();
  if (status === 'running' || status === 'active') return 'active';
  if (status === 'done' || status === 'completed' || status === 'closed') return 'done';
  if (status === 'idle') return 'idle';
  if (status === 'timeout') return 'done'; // timed-out sessions are concluded
  return 'unknown';
}

function deriveTags(raw: RawSession): string[] {
  const tags: string[] = [];
  if (raw.childSessions && raw.childSessions.length > 0) {
    tags.push(`delegated:${raw.childSessions.length}`);
  }
  if (raw.totalTokens && raw.totalTokens > 50000) {
    tags.push('high-usage');
  }
  if (raw.status === 'running') {
    tags.push('live');
  }
  if (raw.channel) {
    tags.push(raw.channel);
  }
  return tags;
}

// ---------------------------------------------------------------------------
// Gateway tool invoker
// ---------------------------------------------------------------------------

// sessions_list can be slow — use a 60s timeout for this specific call
const GATEWAY_TIMEOUT_MS = 60_000;

async function invokeTool<T>(tool: string, args: Record<string, unknown> = {}): Promise<T> {
  const GATEWAY_URL = process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_URL ?? 'http://127.0.0.1:18789';
  const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN ?? '';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GATEWAY_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${GATEWAY_URL}/tools/invoke`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GATEWAY_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tool, args }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const clean = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    throw new Error(`Gateway error ${res.status}: ${clean}`.slice(0, 300));
  }

  // Parse gateway tool invoke response: { ok, result: { content: [{ type: 'text', text: '...' }] } }
  const invokeResult = await res.json() as ToolInvokeResult;
  if (!invokeResult.ok) {
    throw new Error(invokeResult.error?.message ?? `Tool ${tool} returned error`);
  }

  // Unwrap: result.content[0].text is a JSON string of the actual result
  const result = invokeResult.result as Record<string, unknown>;
  if (result && typeof result === 'object') {
    const content = result.content as unknown[];
    if (Array.isArray(content) && content.length > 0) {
      const first = content[0] as Record<string, unknown>;
      if (first && typeof first.text === 'string') {
        const inner = JSON.parse(first.text);
        return inner as T;
      }
    }
  }
  // Fallback
  return result as T;
}

// ---------------------------------------------------------------------------
// Public adapter functions
// ---------------------------------------------------------------------------

/**
 * Load all sessions from the gateway.
 * Filters out the main orchestrator session.
 * Sorts by updatedAt descending (most recently active first).
 */
export async function loadSessionsReal(): Promise<AdapterResult<OpenClawSession[]>> {
  try {
    const result = await invokeTool<SessionsListResult>('sessions_list', { limit: 50 });

    const rawSessions: RawSession[] = result?.sessions ?? [];
    const normalized = rawSessions
      .map(normalizeSession)
      .filter((s) => {
        // Exclude the main orchestrator session (it's Nero's own session)
        if (s.id === 'agent:main:main') return false;
        // Exclude timed-out sessions that are very old (>24h)
        if (s.status === 'done' && s.lastMessageAt) {
          const ageMs = Date.now() - new Date(s.lastMessageAt).getTime();
          if (ageMs > 24 * 60 * 60 * 1000) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Most recently updated first
        const aMs = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bMs = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bMs - aMs;
      });

    return {
      ok: true,
      data: normalized,
      fetchedAt: new Date().toISOString(),
    };
  } catch (e) {
    console.error('[OpenClaw adapter] loadSessionsReal failed:', e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Failed to load sessions from gateway',
      retryable: true,
    };
  }
}

/**
 * Probe gateway reachability — lightweight check.
 */
export async function probeGateway(): Promise<AdapterResult<{ ok: boolean }>> {
  try {
    await invokeTool<unknown>('sessions_list', { limit: 1 });
    return { ok: true, data: { ok: true }, fetchedAt: new Date().toISOString() };
  } catch {
    return {
      ok: false,
      error: 'Gateway unreachable',
      retryable: true,
    };
  }
}
