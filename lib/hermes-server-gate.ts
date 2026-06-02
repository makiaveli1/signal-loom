import { resolveSignalLoomRuntimeConfig } from './runtime-config.ts';
import { sanitizeRuntimeDetail } from './runtime-contract.ts';

export type HermesChatGateCode =
  | 'ready'
  | 'needs_token'
  | 'api_unreachable'
  | 'api_error';

export type HermesChatGate = {
  allowed: boolean;
  code: HermesChatGateCode;
  reason: string;
  detail: string;
  actionLabel: string;
  retryable: boolean;
  httpStatus: number;
  apiUrl: string;
};

type EnvLike = Record<string, string | undefined>;

type ProbeOptions = {
  env?: EnvLike;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export function resolveHermesGatewayConfig(env: EnvLike = process.env) {
  const runtimeConfig = resolveSignalLoomRuntimeConfig(env);
  return { apiUrl: runtimeConfig.apiUrl, token: runtimeConfig.token };
}

function blockedGate({
  code,
  reason,
  detail,
  actionLabel,
  retryable,
  apiUrl,
}: {
  code: Exclude<HermesChatGateCode, 'ready'>;
  reason: string;
  detail: string;
  actionLabel: string;
  retryable: boolean;
  apiUrl: string;
}): HermesChatGate {
  return {
    allowed: false,
    code,
    reason,
    detail,
    actionLabel,
    retryable,
    httpStatus: 503,
    apiUrl,
  };
}

export async function probeHermesChatGate({
  env = process.env,
  fetchImpl = fetch,
  timeoutMs = 2_500,
}: ProbeOptions = {}): Promise<HermesChatGate> {
  const { apiUrl, token } = resolveHermesGatewayConfig(env);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchImpl(`${apiUrl}/v1/models`, {
      cache: 'no-store',
      signal: controller.signal,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    if (res.status === 401 || res.status === 403) {
      return blockedGate({
        code: 'needs_token',
        reason: 'Hermes API token needed',
        detail: `The local Hermes API answered with HTTP ${res.status}. Add HERMES_API_KEY, API_SERVER_KEY, or OPENCLAW_GATEWAY_TOKEN before sending.`,
        actionLabel: 'Connect Hermes',
        retryable: false,
        apiUrl,
      });
    }

    if (!res.ok) {
      return blockedGate({
        code: 'api_error',
        reason: 'Hermes API not ready',
        detail: `The local Hermes API models check returned HTTP ${res.status}.`,
        actionLabel: 'Open Settings',
        retryable: true,
        apiUrl,
      });
    }

    return {
      allowed: true,
      code: 'ready',
      reason: 'Hermes ready',
      detail: 'Local Hermes API is reachable and accepted the current server credentials.',
      actionLabel: 'Send',
      retryable: false,
      httpStatus: 200,
      apiUrl,
    };
  } catch (error) {
    const message = sanitizeRuntimeDetail(error);
    return blockedGate({
      code: 'api_unreachable',
      reason: 'Hermes API unreachable',
      detail: message || 'Start the local Hermes API server, then retry.',
      actionLabel: 'Open Settings',
      retryable: true,
      apiUrl,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function chatGateErrorPayload(gate: HermesChatGate) {
  const safeGate: Omit<HermesChatGate, 'apiUrl'> = {
    allowed: gate.allowed,
    code: gate.code,
    reason: gate.reason,
    detail: gate.detail,
    actionLabel: gate.actionLabel,
    retryable: gate.retryable,
    httpStatus: gate.httpStatus,
  };

  return {
    error: gate.reason,
    detail: gate.detail,
    code: gate.code,
    actionLabel: gate.actionLabel,
    retryable: gate.retryable,
    connectionGate: safeGate,
  };
}
