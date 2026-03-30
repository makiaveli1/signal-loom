/**
 * Sessions adapter — loads real sessions from the OpenClaw runtime.
 *
 * The gateway session store lives at:
 *   ~/.openclaw/agents/<agentId>/sessions/sessions.json
 *
 * We access it via the gateway's agent session API, which reads the same store.
 */

import type {
  OpenClawSession,
  SessionStatus,
  AdapterResult,
} from './types';
import { gatewayGet } from './client';

// ---------------------------------------------------------------------------
// Raw gateway types (normalized at the adapter boundary)
// ---------------------------------------------------------------------------

interface RawSession {
  key?: string;
  id?: string;
  title?: string;
  name?: string;
  agentId?: string;
  agent?: string;
  messages?: unknown[];
  messageCount?: number;
  message_count?: number;
  lastMessage?: { content?: string; createdAt?: string; timestamp?: string };
  last_message?: { content?: string; createdAt?: string; timestamp?: string };
  status?: string;
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
  const rawId = raw.key ?? raw.id ?? 'unknown';
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
    status: normalizeSessionStatus(raw.status),
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
  };
  return map[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
}

function normalizeSessionStatus(s?: string): SessionStatus {
  if (!s) return 'unknown';
  const lower = s.toLowerCase();
  if (lower === 'active' || lower === 'running') return 'active';
  if (lower === 'idle' || lower === 'waiting') return 'idle';
  if (lower === 'done' || lower === 'complete' || lower === 'completed') return 'done';
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Public adapter functions
// ---------------------------------------------------------------------------

/**
 * Probe the gateway for reachability.
 * Used as a health check before attempting other calls.
 */
export async function probeGateway(): Promise<AdapterResult<{ ok: boolean }>> {
  try {
    // GET /v1/models returns model list if gateway is reachable
    await gatewayGet('/v1/models');
    return {
      ok: true,
      data: { ok: true },
      fetchedAt: new Date().toISOString(),
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Gateway unreachable',
      retryable: true,
    };
  }
}

/**
 * Load all sessions for an agent from the gateway.
 *
 * Falls back gracefully to empty list if the gateway is unreachable or
 * returns an unexpected shape. UI should degrade to empty state or mock,
 * not crash.
 */
export async function loadSessions(
  agentId: string = 'nero',
): Promise<AdapterResult<OpenClawSession[]>> {
  try {
    // The gateway serves agent sessions at this internal endpoint.
    // If it changes, the error message will reveal the correct path.
    let raw: RawSession[] | Record<string, RawSession> = await gatewayGet(
      `/agents/${agentId}/sessions`,
    );

    // Normalize to array
    let sessions: RawSession[];
    if (Array.isArray(raw)) {
      sessions = raw;
    } else if (raw && typeof raw === 'object') {
      // Some endpoints return { sessions: [...] }
      const asRecord = raw as Record<string, RawSession>;
      sessions = Object.values(asRecord);
    } else {
      sessions = [];
    }

    const normalized = sessions.map(normalizeSession);

    // Sort by lastMessageAt descending (most recent first)
    normalized.sort((a, b) => {
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
    console.error('[OpenClaw adapter] loadSessions failed:', e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Failed to load sessions',
      retryable: true,
    };
  }
}

/**
 * Load a single session by its session key.
 */
export async function loadSession(
  sessionKey: string,
): Promise<AdapterResult<OpenClawSession>> {
  try {
    const raw: RawSession = await gatewayGet(`/sessions/${encodeURIComponent(sessionKey)}`);
    return {
      ok: true,
      data: normalizeSession(raw),
      fetchedAt: new Date().toISOString(),
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Failed to load session',
      retryable: true,
    };
  }
}
