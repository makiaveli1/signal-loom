/**
 * Sessions adapter — loads real sessions from the OpenClaw gateway.
 *
 * Uses POST /tools/invoke with the "sessions_list" tool.
 * The gateway is slow (5–20s) when there are many sessions — use timeouts.
 */

import type {
  OpenClawSession,
  SessionStatus,
  AdapterResult,
} from './types';
import { gatewayPost } from './client';

// ---------------------------------------------------------------------------
// Raw gateway tool invoke types
// ---------------------------------------------------------------------------

interface ToolInvokeResult {
  ok: boolean;
  result?: unknown;
  error?: { type: string; message: string };
}

interface SessionsListResult {
  sessions: RawSession[];
}

interface RawSession {
  key: string;
  name?: string;
  title?: string;
  agentId?: string;
  agent?: string;
  messageCount?: number;
  message_count?: number;
  lastMessage?: { content?: string; createdAt?: string; timestamp?: string };
  last_message?: { content?: string; createdAt?: string; timestamp?: string };
  updatedAt?: string;
  updated_at?: string;
  createdAt?: string;
  created_at?: string;
  tags?: string[];
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

function normalizeSession(raw: RawSession): OpenClawSession {
  const rawId = raw.key ?? 'unknown';
  const shortId = rawId.split(':').pop() ?? rawId;

  return {
    id: rawId,
    shortId,
    title: raw.title ?? raw.name ?? `Session ${shortId}`,
    agentId: raw.agentId ?? raw.agent ?? 'nero',
    agentName: agentNameFromId(raw.agentId ?? raw.agent ?? 'nero'),
    messageCount: raw.messageCount ?? raw.message_count ?? 0,
    lastMessageAt: (
      raw.lastMessage?.createdAt
      ?? raw.lastMessage?.timestamp
      ?? raw.last_message?.createdAt
      ?? raw.last_message?.timestamp
      ?? raw.updatedAt
      ?? raw.updated_at
      ?? null
    ),
    status: normalizeSessionStatus('active'),
    tags: raw.tags ?? [],
    preview: (
      raw.lastMessage?.content
      ?? raw.last_message?.content
      ?? ''
    ).slice(0, 120),
  };
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

function normalizeSessionStatus(_s?: string): SessionStatus {
  // Sessions from the gateway are assumed active if they exist
  return 'active';
}

// ---------------------------------------------------------------------------
// Gateway tool invoker
// ---------------------------------------------------------------------------

const GATEWAY_TIMEOUT_MS = 30_000;

async function invokeTool<T>(tool: string, args: Record<string, unknown> = {}): Promise<T> {
  // gatewayPost uses server-side call → reaches gateway directly at 127.0.0.1
  const res = await gatewayPost<ToolInvokeResult>('/tools/invoke', {
    tool,
    args,
  });

  if (!res.ok) {
    throw new Error(res.error?.message ?? `Tool ${tool} returned error`);
  }
  return res.result as T;
}

// ---------------------------------------------------------------------------
// Public adapter functions
// ---------------------------------------------------------------------------

/**
 * Load all sessions from the gateway.
 * Sorts by lastMessageAt descending (most recent first).
 */
export async function loadSessionsReal(): Promise<AdapterResult<OpenClawSession[]>> {
  try {
    const result = await invokeTool<SessionsListResult>('sessions_list', { limit: 50 });

    const rawSessions: RawSession[] = result?.sessions ?? [];
    const normalized = rawSessions
      .map(normalizeSession)
      .filter((s) => s.id && s.id !== 'main') // exclude the main orchestrator session
      .sort((a, b) => {
        if (!a.lastMessageAt && !b.lastMessageAt) return 0;
        if (!a.lastMessageAt) return 1;
        if (!b.lastMessageAt) return -1;
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
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
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Gateway unreachable',
      retryable: true,
    };
  }
}
