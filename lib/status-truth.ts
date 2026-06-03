import type { AgentIdentity } from '@/lib/agent-identity';

export type ChipTone = 'ok' | 'warn' | 'danger' | 'neutral';

export type ConnectionChip = {
  id: 'cli' | 'api' | 'state-db' | 'runtime' | 'gateway';
  label: string;
  detail: string;
  tone: ChipTone;
};

type RuntimeLike = {
  gateway?: string;
  queue?: string;
  heartbeatFreshness?: string;
  issueCount?: number;
  issueDescription?: string;
};

export type DetectionLike = {
  status?: string;
  identity?: AgentIdentity;
  binary?: { found?: boolean; path?: string; version?: string };
  home?: { configExists?: boolean; stateDbExists?: boolean; stateDbPath?: string };
  api?: { url?: string; reachable?: boolean; authenticated?: boolean; error?: string };
};

export type ComposerConnectionGate = {
  blocked: boolean;
  tone: ChipTone;
  reason: string;
  detail: string;
  actionLabel: string;
};

type SessionLike = {
  id: string;
  parentSessionId?: string | null;
  lastMessageAt: string | null;
  status: string;
  messageCount: number;
};

type RuntimeActivityLike = {
  status?: 'active' | 'done' | 'error';
  updatedAt?: string;
};

export type ClassifiedDelegatedSession<TSession extends SessionLike> = {
  session: TSession;
  ageMs: number;
  lastActivityAt: string | null;
  state: 'running' | 'created' | 'recent' | 'completed' | 'stale';
};

export type DelegatedSessionBuckets<TSession extends SessionLike> = {
  runningNow: Array<ClassifiedDelegatedSession<TSession>>;
  createdEmpty: Array<ClassifiedDelegatedSession<TSession>>;
  recentlyDelegated: Array<ClassifiedDelegatedSession<TSession>>;
  completed: Array<ClassifiedDelegatedSession<TSession>>;
  stale: Array<ClassifiedDelegatedSession<TSession>>;
};

export function buildConnectionChips({
  runtime,
  detection,
  liveConnected,
}: {
  runtime: RuntimeLike;
  detection?: DetectionLike | null;
  liveConnected?: boolean;
}): ConnectionChip[] {
  const binaryFound = detection?.binary?.found === true;
  const apiReachable = detection?.api?.reachable === true;
  const apiAuthenticated = detection?.api?.authenticated !== false;
  const stateDbConnected = detection?.home?.stateDbExists === true;
  const gatewayHealthy = runtime.gateway === 'healthy' && runtime.queue === 'healthy' && runtime.heartbeatFreshness === 'fresh';

  return [
    {
      id: 'cli',
      label: binaryFound ? 'CLI installed' : detection ? 'CLI missing' : 'CLI checking',
      detail: detection?.binary?.version ?? detection?.binary?.path ?? 'Hermes binary probe',
      tone: detection ? (binaryFound ? 'ok' : 'danger') : 'neutral',
    },
    {
      id: 'api',
      label: apiReachable && apiAuthenticated ? 'API connected' : apiReachable ? 'Auth token needed' : detection ? 'Local API unreachable' : 'API checking',
      detail: detection?.api?.error ?? detection?.api?.url ?? 'Local Hermes API auth boundary',
      tone: detection ? (apiReachable && apiAuthenticated ? 'ok' : apiReachable ? 'warn' : 'danger') : 'neutral',
    },
    {
      id: 'state-db',
      label: stateDbConnected ? 'State DB connected' : detection ? 'State DB missing' : 'State DB checking',
      detail: detection?.home?.stateDbPath ?? 'Hermes session database',
      tone: detection ? (stateDbConnected ? 'ok' : 'warn') : 'neutral',
    },
    {
      id: 'runtime',
      label: liveConnected ? 'Runtime stream live' : 'Runtime stream offline',
      detail: liveConnected ? 'SSE connected' : 'Waiting for live event stream',
      tone: liveConnected ? 'ok' : 'warn',
    },
    {
      id: 'gateway',
      label: gatewayHealthy ? 'Gateway healthy' : runtime.gateway === 'down' ? 'Gateway down' : 'Gateway degraded',
      detail: `gateway ${runtime.gateway ?? 'unknown'} · queue ${runtime.queue ?? 'unknown'} · heartbeat ${runtime.heartbeatFreshness ?? 'unknown'}`,
      tone: gatewayHealthy ? 'ok' : runtime.gateway === 'down' ? 'danger' : 'warn',
    },
  ];
}

export function getStatusRowState({
  label,
  loading,
  ok,
  detail,
  loadingDetail,
}: {
  label: string;
  loading?: boolean;
  ok: boolean;
  detail?: string;
  loadingDetail?: string;
}) {
  if (loading) {
    return {
      label,
      ok: null as boolean | null,
      badge: 'checking',
      tone: 'neutral' as ChipTone,
      detail: loadingDetail ?? 'Checking…',
    };
  }

  return {
    label,
    ok,
    badge: ok ? 'ok' : 'needs work',
    tone: (ok ? 'ok' : 'warn') as ChipTone,
    detail,
  };
}

export function getComposerConnectionGate({
  detection,
  loading = false,
}: {
  detection?: DetectionLike | null;
  loading?: boolean;
}): ComposerConnectionGate {
  if (loading || !detection) {
    return {
      blocked: true,
      tone: 'neutral',
      reason: 'Checking Hermes connection',
      detail: 'Signal Loom is checking the local Hermes API before sending so your draft is not lost to a predictable auth failure.',
      actionLabel: 'Checking…',
    };
  }

  const binaryMissing = detection.binary?.found === false || detection.status === 'missing_binary';
  if (binaryMissing) {
    return {
      blocked: true,
      tone: 'danger',
      reason: 'Hermes CLI missing',
      detail: `Signal Loom needs the local Hermes CLI before it can send this draft to ${detection.identity?.name ?? 'your agent'}.`,
      actionLabel: 'Open Settings',
    };
  }

  const apiReachable = detection.api?.reachable === true;
  const apiAuthenticated = detection.api?.authenticated !== false;
  if (apiReachable && !apiAuthenticated) {
    return {
      blocked: true,
      tone: 'warn',
      reason: 'Local auth token needed',
      detail: 'The local API answered, but Signal Loom cannot authenticate. Add HERMES_API_KEY, API_SERVER_KEY, or OPENCLAW_GATEWAY_TOKEN, then re-check.',
      actionLabel: 'Connect Hermes',
    };
  }

  if (!apiReachable || detection.status === 'api_unreachable' || detection.status === 'configured_api_missing') {
    return {
      blocked: true,
      tone: 'danger',
      reason: detection.status === 'configured_api_missing' ? 'Local API not configured' : 'Local API unreachable',
      detail: detection.api?.error ?? 'Start the local Hermes API server, then re-check the connection.',
      actionLabel: 'Open Settings',
    };
  }

  if (detection.status === 'installed_not_configured') {
    return {
      blocked: true,
      tone: 'warn',
      reason: 'Hermes needs setup',
      detail: 'Hermes is installed, but Signal Loom cannot see the config needed to start a reliable local chat.',
      actionLabel: 'Open Settings',
    };
  }

  if (detection.status === 'unknown_error') {
    return {
      blocked: true,
      tone: 'danger',
      reason: 'Connection check failed',
      detail: detection.api?.error ?? 'Signal Loom could not verify local Hermes safely.',
      actionLabel: 'Open Settings',
    };
  }

  if (detection.home?.stateDbExists === false || detection.status === 'state_db_missing') {
    return {
      blocked: false,
      tone: 'warn',
      reason: 'No saved sessions yet',
      detail: 'Hermes API is reachable and authenticated. Sending is allowed; the session database may appear after Hermes records sessions.',
      actionLabel: 'Open Settings',
    };
  }

  return {
    blocked: false,
    tone: 'ok',
    reason: 'Hermes ready',
    detail: 'Local Hermes API is reachable and authenticated.',
    actionLabel: 'Open Settings',
  };
}

function parseTimeMs(value?: string | null) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function classifyDelegatedSessions<TSession extends SessionLike>({
  sessions,
  runtimeActivities,
  now = Date.now(),
  runningWindowMs = 5 * 60 * 1000,
  recentWindowMs = 3 * 60 * 60 * 1000,
}: {
  sessions: TSession[];
  runtimeActivities?: Record<string, RuntimeActivityLike | undefined>;
  now?: number;
  runningWindowMs?: number;
  recentWindowMs?: number;
}): DelegatedSessionBuckets<TSession> {
  const buckets: DelegatedSessionBuckets<TSession> = {
    runningNow: [],
    createdEmpty: [],
    recentlyDelegated: [],
    completed: [],
    stale: [],
  };

  const children = sessions
    .filter((session) => Boolean(session.parentSessionId))
    .map((session) => {
      const runtimeActivity = runtimeActivities?.[session.id];
      const lastActivityAt = runtimeActivity?.updatedAt ?? session.lastMessageAt;
      const lastActivityMs = parseTimeMs(lastActivityAt);
      const ageMs = lastActivityMs > 0 ? now - lastActivityMs : Number.POSITIVE_INFINITY;
      const runtimeActive = runtimeActivity?.status === 'active' && ageMs <= runningWindowMs;
      const sessionActive = session.status === 'active' && ageMs <= runningWindowMs;
      const completed = session.status === 'done' || session.status === 'idle' || runtimeActivity?.status === 'done';
      const createdEmpty = session.messageCount === 0 && session.status === 'active' && ageMs <= recentWindowMs;

      let state: ClassifiedDelegatedSession<TSession>['state'] = 'stale';
      if (createdEmpty) state = 'created';
      else if (runtimeActive || sessionActive) state = 'running';
      else if (completed) state = 'completed';
      else if (ageMs <= recentWindowMs) state = 'recent';

      return { session, ageMs, lastActivityAt, state } satisfies ClassifiedDelegatedSession<TSession>;
    })
    .sort((a, b) => a.ageMs - b.ageMs);

  for (const child of children) {
    if (child.state === 'running') buckets.runningNow.push(child);
    else if (child.state === 'created') buckets.createdEmpty.push(child);
    else if (child.state === 'completed') buckets.completed.push(child);
    else if (child.state === 'recent') buckets.recentlyDelegated.push(child);
    else buckets.stale.push(child);
  }

  return buckets;
}
