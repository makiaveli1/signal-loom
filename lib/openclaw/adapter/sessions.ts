/**
 * Hermes sessions adapter.
 *
 * This file intentionally keeps the legacy OpenClaw-facing type names so the
 * UI can be ported incrementally. Under the hood it now reads Hermes' canonical
 * ~/.hermes/state.db session store directly instead of calling OpenClaw
 * /tools/invoke endpoints.
 */

import type { AdapterResult, OpenClawMessage, OpenClawSession, SessionStatus } from './types';

interface HermesStateSession {
  id: string;
  source: string;
  model?: string | null;
  title?: string | null;
  started_at: number;
  ended_at?: number | null;
  end_reason?: string | null;
  message_count: number;
  tool_call_count: number;
  parent_session_id?: string | null;
  preview: string;
  last_active: number;
}

interface HermesStateMessage {
  id: number;
  session_id: string;
  role: string;
  content: string;
  tool_name?: string | null;
  timestamp: number;
  finish_reason?: string | null;
}

interface HermesStateDbModule {
  listHermesSessions(limit?: number): Promise<HermesStateSession[]>;
  loadHermesMessages(sessionId: string, limit?: number): Promise<HermesStateMessage[]>;
}

const STATE_DB_MODULE = '@/lib/hermes/' + 'state-db';

async function loadStateDbModule(): Promise<HermesStateDbModule> {
  // Hide the server-only module from the client bundle. This adapter facade is
  // imported by client components, but these functions only execute inside
  // Next.js API routes / Node runtime paths.
  return (new Function('specifier', 'return import(specifier)'))(STATE_DB_MODULE) as Promise<HermesStateDbModule>;
}

interface SessionsCache {
  data: OpenClawSession[];
  fetchedAt: number;
}

let _sessionsCache: SessionsCache | null = null;
let _sessionsInFlight: Promise<OpenClawSession[]> | null = null;
const SESSIONS_CACHE_TTL_MS = 15_000;

function unixToIso(ts?: number | null): string | null {
  if (!ts) return null;
  const millis = ts > 10_000_000_000 ? ts : ts * 1000;
  return new Date(millis).toISOString();
}

const MOCK_FALLBACK_SESSIONS: OpenClawSession[] = [
  {
    id: 'hermes:main',
    shortId: 'main',
    title: 'Nero — Hermes main session',
    agentId: 'nero',
    agentName: 'Nero',
    messageCount: 0,
    lastMessageAt: new Date().toISOString(),
    status: 'active',
    tags: ['hermes', 'fallback'],
    childSessionIds: [],
    preview: 'Hermes state database unavailable — showing fallback shell.',
  },
];

function shortId(id: string): string {
  const tail = id.split(/[:/_-]/).filter(Boolean).pop() ?? id;
  return tail.length > 12 ? tail.slice(0, 8) : tail;
}

function normalizeStatus(raw: HermesStateSession): SessionStatus {
  if (!raw.ended_at) return 'active';
  const last = raw.last_active ? (raw.last_active > 10_000_000_000 ? raw.last_active : raw.last_active * 1000) : 0;
  const ageMs = last ? Date.now() - last : Number.POSITIVE_INFINITY;
  if (ageMs < 30 * 60 * 1000) return 'idle';
  return 'done';
}

function deriveAgentId(raw: HermesStateSession): string {
  const haystack = `${raw.id} ${raw.source} ${raw.title ?? ''} ${raw.preview ?? ''} ${raw.model ?? ''}`.toLowerCase();
  if (haystack.includes('hephaestus') || haystack.includes('forge')) return 'hephaestus';
  if (haystack.includes('argus') || haystack.includes('sentinel')) return 'argus';
  if (haystack.includes('ariadne') || haystack.includes('studio')) return 'ariadne';
  if (haystack.includes('orion') || haystack.includes('scout')) return 'orion';
  if (haystack.includes('mercury')) return 'hermes';
  // In Nero's Hermes setup, API/TUI/CLI/Telegram roots are chaired by Nero.
  return 'nero';
}

function agentNameFromId(id: string): string {
  const map: Record<string, string> = {
    nero: 'Nero',
    hephaestus: 'Hephaestus',
    argus: 'Argus',
    ariadne: 'Ariadne',
    orion: 'Orion',
    hermes: 'Hermes',
  };
  return map[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
}

function deriveTitle(raw: HermesStateSession): string {
  const title = raw.title?.trim();
  if (title) return title;
  const preview = raw.preview?.trim();
  if (preview) return preview.length > 80 ? `${preview.slice(0, 77)}…` : preview;
  const source = raw.source ? raw.source.toUpperCase() : 'Hermes';
  return `${source} session ${shortId(raw.id)}`;
}

function normalizeSession(raw: HermesStateSession): OpenClawSession {
  const agentId = deriveAgentId(raw);
  const tags = ['hermes'];
  if (raw.source) tags.push(raw.source);
  if (raw.parent_session_id) tags.push('child');
  if (raw.tool_call_count > 0) tags.push(`tools:${raw.tool_call_count}`);
  if (raw.end_reason) tags.push(raw.end_reason);

  return {
    id: raw.id,
    shortId: shortId(raw.id),
    title: deriveTitle(raw),
    agentId,
    agentName: agentNameFromId(agentId),
    messageCount: raw.message_count ?? 0,
    lastMessageAt: unixToIso(raw.last_active),
    status: normalizeStatus(raw),
    tags,
    preview: raw.preview ?? '',
    childSessionIds: [],
  };
}

export async function loadSessionsReal(): Promise<AdapterResult<OpenClawSession[]>> {
  const now = Date.now();

  if (_sessionsCache && now - _sessionsCache.fetchedAt < SESSIONS_CACHE_TTL_MS) {
    return { ok: true, data: _sessionsCache.data, fetchedAt: new Date(_sessionsCache.fetchedAt).toISOString() };
  }

  if (_sessionsInFlight) {
    const data = await _sessionsInFlight;
    return { ok: true, data, fetchedAt: new Date(_sessionsCache?.fetchedAt ?? Date.now()).toISOString() };
  }

  _sessionsInFlight = (async () => {
    const { listHermesSessions } = await loadStateDbModule();
    const raw = await listHermesSessions(200);
    const normalized = raw
      .map(normalizeSession)
      .filter((s) => {
        if (!s.lastMessageAt) return true;
        if (s.status !== 'done') return true;
        const ageMs = Date.now() - new Date(s.lastMessageAt).getTime();
        return ageMs < 7 * 24 * 60 * 60 * 1000;
      });
    _sessionsCache = { data: normalized, fetchedAt: Date.now() };
    return normalized;
  })();

  try {
    const data = await _sessionsInFlight;
    return { ok: true, data, fetchedAt: new Date(_sessionsCache!.fetchedAt).toISOString() };
  } catch (e) {
    if (_sessionsCache) {
      return { ok: true, data: _sessionsCache.data, fetchedAt: new Date(_sessionsCache.fetchedAt).toISOString() };
    }
    console.warn('[Hermes adapter] loadSessionsReal fallback:', e instanceof Error ? e.message : e);
    return { ok: true, data: MOCK_FALLBACK_SESSIONS, fetchedAt: new Date().toISOString() };
  } finally {
    _sessionsInFlight = null;
  }
}

function normalizeMessageRole(role: string): OpenClawMessage['role'] {
  if (role === 'user' || role === 'system' || role === 'tool') return role;
  return 'assistant';
}

export async function loadSessionMessages(
  sessionKey: string,
  limit = 80,
): Promise<AdapterResult<{
  messages: OpenClawMessage[];
  truncated: boolean;
  contentTruncated: boolean;
  droppedMessages: boolean;
  totalBytes: number;
}>> {
  try {
    if (typeof window !== 'undefined') {
      const url = `/api/openclaw/sessions/history?sessionKey=${encodeURIComponent(sessionKey)}&limit=${limit}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`sessions/history API returned ${res.status}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'session history failed');
      return { ok: true, data: json.data, fetchedAt: new Date().toISOString() };
    }

    const { loadHermesMessages } = await loadStateDbModule();
    const raw = await loadHermesMessages(sessionKey, limit);
    const messages: OpenClawMessage[] = raw.map((m) => ({
      id: String(m.id),
      role: normalizeMessageRole(m.role),
      content: m.content,
      timestamp: unixToIso(m.timestamp) ?? new Date().toISOString(),
      agentId: m.role === 'assistant' ? 'nero' : undefined,
    }));

    const totalBytes = messages.reduce((sum, m) => sum + m.content.length, 0);
    return {
      ok: true,
      data: {
        messages,
        truncated: raw.length >= limit,
        contentTruncated: false,
        droppedMessages: false,
        totalBytes,
      },
      fetchedAt: new Date().toISOString(),
    };
  } catch (e) {
    console.error('[Hermes adapter] loadSessionMessages failed:', e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Failed to load Hermes session history',
      retryable: true,
    };
  }
}

export async function probeGateway(): Promise<AdapterResult<{ ok: boolean }>> {
  try {
    const { listHermesSessions } = await loadStateDbModule();
    await listHermesSessions(1);
    return { ok: true, data: { ok: true }, fetchedAt: new Date().toISOString() };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Hermes state unavailable',
      retryable: true,
    };
  }
}
