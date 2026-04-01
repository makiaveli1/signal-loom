/**
 * POST /api/hermes/send
 *
 * Real email dispatch via Microsoft Graph sendMail API.
 *
 * Token path: ~/.openclaw/graph/graph_token.json
 * Config path: ~/.openclaw/graph/graph.json
 *
 * Security: requires human_approved gate status — enforced server-side before send.
 * No email is ever sent without explicit human approval, regardless of client state.
 * Auto-refresh: expired access tokens are automatically refreshed using refresh_token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const GRAPH_BASE = join(process.env.HOME ?? '/home/likwid', '.openclaw', 'graph');
const TOKEN_PATH = join(GRAPH_BASE, 'graph_token.json');
const CONFIG_PATH = join(GRAPH_BASE, 'graph.json');

// ---------------------------------------------------------------------------
// Token types
// ---------------------------------------------------------------------------

interface GraphToken {
  access_token: string;
  refresh_token: string;
  expires_at: number;   // ms since epoch — used by signal-loom
  expires_on?: string;  // ISO string — used by some consumers
  token_type: string;
  scope: string;
  acquired_at: number;
}

interface GraphConfig {
  clientId: string;
  tenantId: string;
  appName: string;
  objectId?: string;
}

// ---------------------------------------------------------------------------
// Token loader (read from disk)
// ---------------------------------------------------------------------------

function loadToken(): GraphToken | null {
  if (!existsSync(TOKEN_PATH)) return null;
  try {
    return JSON.parse(readFileSync(TOKEN_PATH, 'utf-8')) as GraphToken;
  } catch {
    return null;
  }
}

function loadConfig(): GraphConfig | null {
  if (!existsSync(CONFIG_PATH)) return null;
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as GraphConfig;
  } catch {
    return null;
  }
}

function saveToken(token: GraphToken): void {
  mkdirSync(GRAPH_BASE, { recursive: true });
  writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
}

// ---------------------------------------------------------------------------
// Token refresh (uses refresh_token to get a new access_token)
// ---------------------------------------------------------------------------

async function refreshAccessToken(refreshToken: string, config: GraphConfig): Promise<GraphToken> {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: config.clientId,
    refresh_token: refreshToken,
  });

  const res = await fetch(`https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => 'unknown error');
    throw new Error(`Token refresh failed: HTTP ${res.status} — ${body.slice(0, 200)}`);
  }

  const data = await res.json() as Record<string, unknown>;

  const newToken: GraphToken = {
    access_token: data.access_token as string,
    refresh_token: (data.refresh_token as string) ?? refreshToken,
    expires_at: Date.now() + (data.expires_in as number) * 1000,
    token_type: data.token_type as string,
    scope: data.scope as string,
    acquired_at: Date.now(),
  };

  saveToken(newToken);
  return newToken;
}

/**
 * Get a valid access token, refreshing automatically if within 2 minutes of expiry.
 */
async function getValidAccessToken(): Promise<{ token: GraphToken | null; refreshed: boolean; error?: string }> {
  const config = loadConfig();
  if (!config) return { token: null, refreshed: false, error: 'graph.json config not found' };

  let token = loadToken();
  if (!token) return { token: null, refreshed: false, error: 'graph_token.json not found — not authenticated' };

  // Auto-refresh if access token is expired or within 2 minutes of expiry
  const TWO_MINS_MS = 2 * 60 * 1000;
  if (token.expires_at && Date.now() > token.expires_at - TWO_MINS_MS) {
    if (!token.refresh_token) {
      return { token: null, refreshed: false, error: 'Access token expired and no refresh token available' };
    }
    try {
      token = await refreshAccessToken(token.refresh_token, config);
      return { token, refreshed: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { token: null, refreshed: false, error: `Auto-refresh failed: ${message}` };
    }
  }

  return { token, refreshed: false };
}

// ---------------------------------------------------------------------------
// Request + response types
// ---------------------------------------------------------------------------

interface SendEmailRequest {
  gateId: string;
  toEmail: string;
  toName?: string;
  subject: string;
  body: string;
  footer?: string;
  gateStatus: string;
}

interface GraphSendMailPayload {
  message: {
    subject: string;
    body: { contentType: 'Text'; content: string };
    toRecipients: Array<{ emailAddress: { address: string; name?: string } }>;
  };
  saveToSentItems: boolean;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // 1. Parse body
  let body: SendEmailRequest;
  try {
    body = (await req.json()) as SendEmailRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { gateId, toEmail, toName, subject, body: emailBody, footer, gateStatus } = body;

  // 2. Server-side gate enforcement — hard rule
  if (gateStatus !== 'human_approved') {
    return NextResponse.json(
      {
        error: 'Send blocked: email must be in human_approved status before dispatch.',
        gateStatus,
        rule: 'ONLY human_approved gates may be sent.',
      },
      { status: 403 }
    );
  }

  // 3. Get valid token (auto-refreshes if needed)
  const { token, refreshed, error: tokenError } = await getValidAccessToken();
  if (!token) {
    return NextResponse.json(
      {
        error: `Email transport unavailable: ${tokenError ?? 'Token not available'}. Run Graph auth setup.`,
        refreshed,
      },
      { status: 503 }
    );
  }

  if (refreshed) {
    console.log('[hermes/send] Access token auto-refreshed successfully');
  }

  // 4. Build Graph sendMail payload
  const fullBody = footer ? `${emailBody}\n\n${footer}` : emailBody;
  const payload: GraphSendMailPayload = {
    message: {
      subject,
      body: { contentType: 'Text', content: fullBody },
      toRecipients: [{ emailAddress: { address: toEmail, ...(toName ? { name: toName } : {}) } }],
    },
    saveToSentItems: true,
  };

  // 5. Call Graph API
  let graphResponse: Response;
  try {
    graphResponse = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: {
        Authorization: `${token.token_type} ${token.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (networkErr) {
    const message = networkErr instanceof Error ? networkErr.message : 'Network error';
    return NextResponse.json({ error: `Graph API call failed: ${message}` }, { status: 502 });
  }

  // 6. Handle Graph response
  if (graphResponse.status === 202) {
    return NextResponse.json({
      ok: true,
      sent: true,
      gateId,
      sentAt: new Date().toISOString(),
      transport: 'Microsoft Graph sendMail',
      tokenRefreshed: refreshed,
    });
  }

  // Non-202 from Graph
  let errorBody = 'Unknown error';
  try {
    const json = await graphResponse.json();
    errorBody = json?.error?.message ?? JSON.stringify(json).slice(0, 300);
  } catch {
    errorBody = `HTTP ${graphResponse.status}`;
  }

  return NextResponse.json(
    { ok: false, sent: false, gateId, error: `Graph sendMail failed: ${errorBody}`, httpStatus: graphResponse.status },
    { status: 502 }
  );
}

// ---------------------------------------------------------------------------
// GET — mailbox readiness check (for UI status display)
// ---------------------------------------------------------------------------

export async function GET() {
  const config = loadConfig();
  const token = loadToken();

  if (!config) {
    return NextResponse.json({ ready: false, error: 'graph.json not found' });
  }
  if (!token) {
    return NextResponse.json({ ready: false, error: 'Not authenticated — run Graph auth setup' });
  }

  const now = Date.now();
  const expired = token.expires_at ? now > token.expires_at : true;
  const expiresInMs = token.expires_at ? token.expires_at - now : 0;
  const expiresInMins = Math.round(expiresInMs / 60000);
  const willAutoRefresh = !!token.refresh_token;

  return NextResponse.json({
    ready: !expired,
    expired,
    expiresInMins,
    willAutoRefresh,
    hasRefreshToken: !!token.refresh_token,
    acquiredAt: token.acquired_at ? new Date(token.acquired_at).toISOString() : null,
    tokenPath: TOKEN_PATH,
  });
}
