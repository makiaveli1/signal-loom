/**
 * OpenClaw gateway HTTP client
 *
 * All gateway communication goes through this module. App components never
 * call fetch() directly against the gateway — they go through the adapter.
 *
 * Gateway is assumed to be at http://127.0.0.1:18789 when accessed from the
 * browser. Auth token comes from the browser environment variable.
 */

const GATEWAY_URL = process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_URL ?? 'http://127.0.0.1:18789';
const GATEWAY_TOKEN = process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_TOKEN ?? '';

/**
 * Core fetch wrapper — adds auth header, JSON serialization, and error handling.
 * Returns the parsed JSON body on success; throws on network/HTTP errors.
 */
export async function gatewayFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${GATEWAY_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${GATEWAY_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    let message = `Gateway ${res.status}`;
    try {
      const body = await res.text();
      message += `: ${body.slice(0, 200)}`;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

/**
 * POST helper — serializes body as JSON.
 */
export async function gatewayPost<T = unknown>(
  path: string,
  body: unknown,
  options: RequestInit = {},
): Promise<T> {
  return gatewayFetch<T>(path, {
    ...options,
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * GET helper.
 */
export async function gatewayGet<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  return gatewayFetch<T>(path, {
    ...options,
    method: 'GET',
  });
}
