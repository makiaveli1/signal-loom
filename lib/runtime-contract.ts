type RuntimeHeaders = Record<string, string>;

const DEFAULT_RUNTIME_DETAIL = 'Hermes runtime is unavailable. Start or reconnect the local Hermes API, then retry.';

function stringifyDetail(detail: unknown): string {
  if (detail instanceof Error) return detail.message;
  if (typeof detail === 'string') return detail;
  if (detail == null) return '';
  return String(detail);
}

export function sanitizeRuntimeDetail(detail: unknown): string {
  let safe = stringifyDetail(detail).replace(/[\r\n]+/g, ' ').trim();
  if (!safe) return DEFAULT_RUNTIME_DETAIL;

  safe = safe
    .replace(/Bearer\s+[^\s;,.)]+/gi, 'Bearer [redacted]')
    .replace(/(api[_-]?key|token|authorization)=([^\s;,.)]+)/gi, '$1=[redacted]')
    .replace(/https?:\/\/[^\s;,.)]+/gi, 'local Hermes API')
    .replace(/state\.db not found:\s*(?:[A-Z]:\\|\/)[^;,]+/gi, 'local Hermes state database not found')
    .replace(/(?:[A-Z]:\\|\/)[^\s;,]*\.hermes[^\s;,]*/gi, 'local Hermes profile path')
    .replace(/(?:[A-Z]:\\|\/)[^\s;,]*state\.db/gi, 'local Hermes state database');

  return safe.slice(0, 320) || DEFAULT_RUNTIME_DETAIL;
}

export function runtimeContractHeaders(degradedArea: string, detail?: unknown): RuntimeHeaders {
  const headers: RuntimeHeaders = {
    'Cache-Control': 'no-store',
    'X-Adapter-Fetched-At': new Date().toISOString(),
    'X-Signal-Loom-Degraded': degradedArea,
  };

  if (detail !== undefined) {
    headers['X-Signal-Loom-Degraded-Reason'] = sanitizeRuntimeDetail(detail).slice(0, 240);
  }

  return headers;
}

export function localHermesStateDbLabel() {
  return 'local Hermes state database';
}
