/**
 * Hermes sessions adapter.
 *
 * This file intentionally keeps the legacy OpenClaw-facing type names so the
 * UI can be ported incrementally. Under the hood it now reads Hermes' canonical
 * ~/.hermes/state.db session store directly instead of calling OpenClaw
 * /tools/invoke endpoints.
 */

import { DEFAULT_AGENT_IDENTITY, type AgentIdentity } from '@/lib/agent-identity';
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

interface AgentIdentityServerModule {
  resolveAgentIdentity(): AgentIdentity;
}

const STATE_DB_MODULE = '@/lib/hermes/' + 'state-db';
const AGENT_IDENTITY_MODULE = '@/lib/hermes/' + 'agent-identity-server';

async function loadAgentIdentity(): Promise<AgentIdentity> {
  if (typeof window !== 'undefined') return DEFAULT_AGENT_IDENTITY;
  try {
    // Constant specifier; new Function prevents Next from bundling the server-only identity module into client chunks.
    const identityModule = await (new Function('specifier', 'return import(specifier)'))(AGENT_IDENTITY_MODULE) as AgentIdentityServerModule;
    return identityModule.resolveAgentIdentity();
  } catch {
    return DEFAULT_AGENT_IDENTITY;
  }
}

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
const SESSIONS_CACHE_TTL_MS = 0;

function unixToIso(ts?: number | null): string | null {
  if (!ts) return null;
  const millis = ts > 10_000_000_000 ? ts : ts * 1000;
  return new Date(millis).toISOString();
}

function fallbackSession(identity: AgentIdentity = DEFAULT_AGENT_IDENTITY): OpenClawSession {
  return {
    id: `${identity.id}:main`,
    shortId: 'main',
    title: `${identity.name} — Hermes main session`,
    agentId: identity.id,
    agentName: identity.name,
    messageCount: 0,
    lastMessageAt: new Date().toISOString(),
    status: 'active',
    tags: ['hermes', 'fallback'],
    childSessionIds: [],
    preview: 'Hermes state database unavailable — showing fallback shell.',
  };
}

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

function deriveAgentId(raw: HermesStateSession, defaultAgentId: string): string {
  const haystack = `${raw.id} ${raw.source} ${raw.title ?? ''} ${raw.preview ?? ''} ${raw.model ?? ''}`.toLowerCase();
  if (haystack.includes('hephaestus') || haystack.includes('forge')) return 'hephaestus';
  if (haystack.includes('argus') || haystack.includes('sentinel')) return 'argus';
  if (haystack.includes('ariadne') || haystack.includes('studio')) return 'ariadne';
  if (haystack.includes('orion') || haystack.includes('scout')) return 'orion';
  if (haystack.includes('mercury')) return 'hermes';
  return defaultAgentId;
}

function agentNameFromId(id: string, defaultAgent: AgentIdentity): string {
  const map: Record<string, string> = {
    nero: 'Nero',
    hephaestus: 'Hephaestus',
    argus: 'Argus',
    ariadne: 'Ariadne',
    orion: 'Orion',
    hermes: 'Hermes',
  };
  return map[id] ?? (id === defaultAgent.id ? defaultAgent.name : id.charAt(0).toUpperCase() + id.slice(1));
}

function deriveTitle(raw: HermesStateSession): string {
  const title = raw.title?.trim();
  if (title) return title;
  const preview = raw.preview?.trim();
  if (preview) return preview.length > 80 ? `${preview.slice(0, 77)}…` : preview;
  const source = raw.source ? raw.source.toUpperCase() : 'Hermes';
  return `${source} session ${shortId(raw.id)}`;
}

function normalizeSession(raw: HermesStateSession, defaultAgent: AgentIdentity): OpenClawSession {
  const agentId = deriveAgentId(raw, defaultAgent.id);
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
    agentName: agentNameFromId(agentId, defaultAgent),
    messageCount: raw.message_count ?? 0,
    toolCallCount: raw.tool_call_count ?? 0,
    source: raw.source,
    parentSessionId: raw.parent_session_id ?? null,
    lastMessageAt: unixToIso(raw.last_active),
    status: normalizeStatus(raw),
    tags,
    preview: raw.preview ?? '',
    childSessionIds: [],
  };
}

function attachSessionRelationships(sessions: OpenClawSession[]): OpenClawSession[] {
  const childrenByParent = new Map<string, string[]>();
  for (const session of sessions) {
    if (!session.parentSessionId) continue;
    const children = childrenByParent.get(session.parentSessionId) ?? [];
    children.push(session.id);
    childrenByParent.set(session.parentSessionId, children);
  }

  return sessions.map((session) => {
    const childSessionIds = childrenByParent.get(session.id) ?? [];
    const tags = new Set(session.tags);
    if (childSessionIds.length > 0) {
      tags.add('parent');
      tags.add(`children:${childSessionIds.length}`);
    }
    if (session.parentSessionId) tags.add('child');
    return { ...session, tags: [...tags], childSessionIds };
  });
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
    const identity = await loadAgentIdentity();
    const raw = await listHermesSessions(200);
    const normalized = attachSessionRelationships(raw.map((session) => normalizeSession(session, identity)))
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
    const identity = await loadAgentIdentity();
    return { ok: true, data: [fallbackSession(identity)], fetchedAt: new Date().toISOString() };
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
    const identity = await loadAgentIdentity();
    const raw = await loadHermesMessages(sessionKey, limit);
    const messages: OpenClawMessage[] = raw.map((m) => ({
      id: String(m.id),
      role: normalizeMessageRole(m.role),
      content: m.content,
      timestamp: unixToIso(m.timestamp) ?? new Date().toISOString(),
      agentId: m.role === 'assistant' ? identity.id : undefined,
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
