/**
 * OpenClaw adapter HTTP client
 *
 * Architecture:
 * - Browser calls Next.js API routes (/api/openclaw/*)
 * - Next.js API routes are server-side and can reach the gateway at 127.0.0.1:18789
 * - This avoids WSL/Windows networking issues with direct browser → gateway calls
 *
 * The NEXT_PUBLIC_ prefix makes this available in browser bundles.
 * In server-only contexts (Next.js API routes), we also call the gateway directly.
 */

const GATEWAY_URL = process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_URL ?? 'http://127.0.0.1:18789';
const GATEWAY_TOKEN = process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_TOKEN ?? '';

/**
 * Determine the base URL for adapter calls.
 * - Server-side (Node.js): call the gateway directly at 127.0.0.1:18789
 * - Browser-side: call the Next.js API routes which proxy to the gateway
 */
function getBaseUrl(): string {
  // Server-side (Next.js API routes, server components)
  if (typeof window === 'undefined') {
    return GATEWAY_URL;
  }
  // Browser-side: use the Next.js API proxy routes
  // These routes are at /api/openclaw/* and proxy to the gateway server-side
  return '';
}

/**
 * Core fetch wrapper for OpenClaw gateway / API proxy calls.
 *
 * Server-side: calls the gateway directly at GATEWAY_URL with auth header.
 * Browser-side: calls the relative Next.js API route (/api/openclaw/*) with auth.
 *
 * Returns parsed JSON body on success; throws on network/HTTP errors.
 */
export async function gatewayFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const baseUrl = getBaseUrl();
  const url = baseUrl + path;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(baseUrl ? { Authorization: `Bearer ${GATEWAY_TOKEN}` } : {}),
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
