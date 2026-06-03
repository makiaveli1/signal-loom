import type { Agent } from './types/index.ts';
import type { OpenClawSession } from './openclaw/adapter/types.ts';

export type LanePresenceState = 'running' | 'blocked' | 'waiting' | 'created' | 'recent' | 'completed' | 'stale' | 'idle';

export type LanePresence = {
  agentId: Agent['id'];
  state: LanePresenceState;
  label: string;
  detail: string;
  latestTask: string;
  ageLabel: string;
  activeCount: number;
  childCount: number;
  staleCount: number;
};

type RuntimeActivityLike = {
  status?: 'active' | 'done' | 'error';
  updatedAt?: string;
  preview?: string;
  label?: string;
  parentSessionId?: string | null;
};

const MINUTE = 60 * 1000;
const RECENT_WINDOW_MS = 30 * MINUTE;
const STALE_WINDOW_MS = 6 * 60 * MINUTE;

function timeMs(value?: string | null): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function formatAge(ms: number | null, now: number): string {
  if (ms === null) return 'no timestamp';
  const delta = Math.max(0, now - ms);
  const minutes = Math.floor(delta / MINUTE);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function titleFor(session: OpenClawSession, activity?: RuntimeActivityLike): string {
  return activity?.preview || activity?.label || session.preview || session.title || session.shortId;
}

export function buildLanePresence({
  agents,
  sessions,
  runtimeActivities = {},
  now = Date.now(),
}: {
  agents: Agent[];
  sessions: OpenClawSession[];
  runtimeActivities?: Record<string, RuntimeActivityLike | undefined>;
  now?: number;
}): Record<Agent['id'], LanePresence> {
  const result = {} as Record<Agent['id'], LanePresence>;

  for (const agent of agents) {
    const agentSessions = sessions.filter((session) =>
      session.agentId?.toLowerCase() === agent.id.toLowerCase() ||
      session.agentName?.toLowerCase() === agent.name.toLowerCase()
    );
    const childSessions = agentSessions.filter((session) => Boolean(session.parentSessionId));
    const enriched = agentSessions.map((session) => {
      const activity = runtimeActivities[session.id];
      const lastMs = timeMs(activity?.updatedAt ?? session.lastMessageAt);
      return { session, activity, lastMs };
    }).sort((a, b) => (b.lastMs ?? 0) - (a.lastMs ?? 0));

    const latest = enriched[0];
    const activeCount = enriched.filter(({ activity, lastMs, session }) =>
      activity?.status === 'active' ||
      session.status === 'active' ||
      (lastMs !== null && now - lastMs <= 5 * MINUTE && session.status !== 'done')
    ).length;
    const createdCount = childSessions.filter((session) => (session.messageCount ?? 0) <= 1 && !runtimeActivities[session.id]).length;
    const staleCount = enriched.filter(({ lastMs, session }) =>
      session.status !== 'done' && lastMs !== null && now - lastMs > STALE_WINDOW_MS
    ).length;

    let state: LanePresenceState = 'idle';
    if (agent.status === 'blocked') state = 'blocked';
    else if (activeCount > 0 || agent.status === 'active') state = 'running';
    else if (agent.status === 'waiting') state = 'waiting';
    else if (createdCount > 0) state = 'created';
    else if (latest?.session.status === 'done' || agent.status === 'done') state = 'completed';
    else if (latest?.lastMs !== null && latest && now - latest.lastMs <= RECENT_WINDOW_MS) state = 'recent';
    else if (staleCount > 0) state = 'stale';

    const label: Record<LanePresenceState, string> = {
      running: 'Running now',
      blocked: 'Blocked',
      waiting: 'Waiting',
      created: 'Created/no breadcrumb',
      recent: 'Recently active',
      completed: 'Completed',
      stale: 'Stale',
      idle: 'Idle',
    };

    result[agent.id] = {
      agentId: agent.id,
      state,
      label: label[state],
      detail: childSessions.length > 0
        ? `${childSessions.length} delegated lane${childSessions.length === 1 ? '' : 's'} · ${activeCount} active`
        : 'No delegated child sessions linked to this lane',
      latestTask: latest ? titleFor(latest.session, latest.activity) : agent.taskPreview,
      ageLabel: formatAge(latest?.lastMs ?? null, now),
      activeCount,
      childCount: childSessions.length,
      staleCount,
    };
  }

  return result;
}
