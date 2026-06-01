import { DEFAULT_AGENT_IDENTITY, type AgentIdentity } from './agent-identity.ts';
import type { DetectionLike } from './status-truth.ts';

export type HermesDetection = DetectionLike & {
  ok?: boolean;
  fetchedAt?: string;
  identity?: AgentIdentity;
  nextSteps?: Array<{ id: string; label: string; command?: string; risk: 'safe' | 'requires_permission' | 'manual_only' }>;
  error?: string;
};

export type HermesDetectionState = {
  detection: HermesDetection | null;
  loading: boolean;
  error: string | null;
};

type Listener = (state: HermesDetectionState) => void;
type FetchLike = typeof fetch;

type HermesDetectionControllerOptions = {
  fetchImpl?: FetchLike;
};

const INITIAL_STATE: HermesDetectionState = {
  detection: null,
  loading: false,
  error: null,
};

function unknownErrorDetection(message: string): HermesDetection {
  return {
    ok: false,
    status: 'unknown_error',
    fetchedAt: new Date().toISOString(),
    identity: DEFAULT_AGENT_IDENTITY,
    binary: { found: false },
    api: { reachable: false, error: message },
    error: message,
  };
}

export function createHermesDetectionController({ fetchImpl = fetch }: HermesDetectionControllerOptions = {}) {
  let state: HermesDetectionState = INITIAL_STATE;
  let inflight: Promise<HermesDetectionState> | null = null;
  const listeners = new Set<Listener>();
  const pollers = new Map<number, { intervalId: ReturnType<typeof setInterval>; subscribers: number }>();

  const emit = () => {
    for (const listener of listeners) {
      listener(state);
    }
  };

  const setState = (next: HermesDetectionState) => {
    state = next;
    emit();
  };

  const refresh = async (): Promise<HermesDetectionState> => {
    if (inflight) return inflight;

    setState({ ...state, loading: true, error: null });

    inflight = (async () => {
      try {
        const res = await fetchImpl('/api/hermes/detect', { cache: 'no-store' });
        const payload = await res.json() as HermesDetection;
        const error = !res.ok || payload.status === 'unknown_error'
          ? payload.error ?? payload.api?.error ?? 'Hermes detection failed.'
          : null;
        setState({ detection: payload, loading: false, error });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Hermes detection failed.';
        setState({ detection: unknownErrorDetection(message), loading: false, error: message });
      } finally {
        inflight = null;
      }
      return state;
    })();

    return inflight;
  };

  const subscribe = (listener: Listener) => {
    listeners.add(listener);
    listener(state);
    return () => {
      listeners.delete(listener);
    };
  };

  const startPolling = (pollMs: number | null | undefined) => {
    if (!pollMs || pollMs <= 0) {
      void refresh();
      return () => undefined;
    }

    const existing = pollers.get(pollMs);
    if (existing) {
      existing.subscribers += 1;
    } else {
      pollers.set(pollMs, {
        subscribers: 1,
        intervalId: setInterval(() => {
          void refresh();
        }, pollMs),
      });
    }

    void refresh();

    return () => {
      const poller = pollers.get(pollMs);
      if (!poller) return;
      poller.subscribers -= 1;
      if (poller.subscribers <= 0) {
        clearInterval(poller.intervalId);
        pollers.delete(pollMs);
      }
    };
  };

  return {
    getState: () => state,
    refresh,
    subscribe,
    startPolling,
  };
}

export const hermesDetectionController = createHermesDetectionController();
