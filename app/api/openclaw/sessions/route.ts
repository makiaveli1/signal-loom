/**
 * GET /api/openclaw/sessions
 *
 * Compatibility route: exposes Hermes sessions in the legacy OpenClaw-shaped
 * contract while the UI migration is in progress.
 */

import { NextResponse } from 'next/server';
import { listHermesSessions, unixToIso, type HermesStateSession } from '@/lib/hermes/state-db';
import type { OpenClawSession, SessionStatus } from '@/lib/openclaw/adapter/types';

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

export async function GET() {
  try {
    const raw = await listHermesSessions(200);
    const sessions = raw
      .map(normalizeSession)
      .filter((s) => {
        if (!s.lastMessageAt) return true;
        if (s.status !== 'done') return true;
        const ageMs = Date.now() - new Date(s.lastMessageAt).getTime();
        return ageMs < 7 * 24 * 60 * 60 * 1000;
      });

    return NextResponse.json(sessions, {
      headers: {
        'Cache-Control': 'private, max-age=30',
        'X-Adapter-Fetched-At': new Date().toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load Hermes sessions', retryable: true },
      { status: 502 },
    );
  }
}
