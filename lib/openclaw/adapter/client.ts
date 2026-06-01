/**
 * Hermes adapter HTTP client
 *
 * Architecture:
 * - Browser calls Next.js API routes (/api/openclaw/* while the UI is migrated)
 * - Next.js API routes are server-side and can reach Hermes at 127.0.0.1:8642
 * - This avoids WSL/Windows networking issues with direct browser → gateway calls
 *
 * Uses a 25-second AbortSignal timeout to prevent gateway hangs.
 */

const GATEWAY_URL = process.env.HERMES_API_URL
  ?? process.env.NEXT_PUBLIC_HERMES_API_URL
  ?? process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_URL
  ?? 'http://127.0.0.1:8642';
// Server-side only — never exposed to the browser bundle.
// Prefer Hermes' API server key; keep the old env as a temporary migration fallback.
const GATEWAY_TOKEN = process.env.HERMES_API_KEY
  ?? process.env.API_SERVER_KEY
  ?? process.env.OPENCLAW_GATEWAY_TOKEN
  ?? '';
const GATEWAY_TIMEOUT_MS = 25_000;

/**
 * Determine the base URL for adapter calls.
 * - Server-side (Node.js): call Hermes directly at 127.0.0.1:8642
 * - Browser-side: call the Next.js API routes which proxy to Hermes/local state
 */
function getBaseUrl(): string {
  if (typeof window === 'undefined') {
    return GATEWAY_URL;
  }
  return ''; // browser → relative URL → Next.js API route
}

/**
 * Core fetch wrapper for Hermes API / local API proxy calls.
 * Returns parsed JSON body on success; throws on network/HTTP errors.
 */
export async function gatewayFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const baseUrl = getBaseUrl();
  const url = baseUrl + path;

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeout = setTimeout(() => controller?.abort(), GATEWAY_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller?.signal as AbortSignal | undefined,
      headers: {
        ...(baseUrl && GATEWAY_TOKEN ? { Authorization: `Bearer ${GATEWAY_TOKEN}` } : {}),
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!res.ok) {
      let message = `Gateway ${res.status}`;
      try {
        const body = await res.text();
        // Strip HTML tags from error messages
        const clean = body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        if (clean) message += `: ${clean.slice(0, 200)}`;
      } catch {
        // ignore text read failure
      }
      clearTimeout(timeout);
      throw new Error(message);
    }

    clearTimeout(timeout);
    return res.json() as Promise<T>;
  } catch (e) {
    clearTimeout(timeout);
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(`Gateway timeout after ${GATEWAY_TIMEOUT_MS / 1000}s — gateway may be slow`);
    }
    throw e;
  }
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
