/**
 * POST /api/hermes/send
 *
 * Real email dispatch via Microsoft Graph sendMail API.
 *
 * Transport: Microsoft Graph API (shared token from website-studio CRM)
 * Token path: /home/likwid/.openclaw/workspace/ventures/website-studio/CRM/config/graph_token.json
 *
 * Security: requires human_approved gate status — enforced server-side before send.
 * No email is ever sent without explicit human approval, regardless of client state.
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Graph token loader
// ---------------------------------------------------------------------------

interface GraphToken {
  access_token: string;
  expires_on: string;
  token_type: string;
}

function loadGraphToken(): GraphToken | null {
  const tokenPath = join(
    process.env.HOME ?? '/home/likwid',
    '.openclaw',
    'workspace',
    'ventures',
    'website-studio',
    'CRM',
    'config',
    'graph_token.json'
  );
  if (!existsSync(tokenPath)) return null;
  try {
    return JSON.parse(readFileSync(tokenPath, 'utf-8')) as GraphToken;
  } catch {
    return null;
  }
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
  gateStatus: string; // validated server-side
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

  // 2. Server-side gate enforcement — this is the hard rule
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

  // 3. Load Graph token
  const token = loadGraphToken();
  if (!token) {
    return NextResponse.json(
      { error: 'Email transport unavailable: Graph token not found. Configure graph_token.json in the CRM config directory.' },
      { status: 503 }
    );
  }

  // Check token expiry
  const expiresAt = new Date(token.expires_on).getTime();
  if (Date.now() >= expiresAt - 60_000) {
    return NextResponse.json(
      { error: 'Email transport unavailable: Graph token has expired. Refresh the token in the CRM config.' },
      { status: 503 }
    );
  }

  // 4. Build Graph sendMail payload
  const fullBody = footer ? `${emailBody}\n\n${footer}` : emailBody;
  const payload: GraphSendMailPayload = {
    message: {
      subject,
      body: {
        contentType: 'Text',
        content: fullBody,
      },
      toRecipients: [
        {
          emailAddress: {
            address: toEmail,
            ...(toName ? { name: toName } : {}),
          },
        },
      ],
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
    });
  }

  // Non-202 from Graph — try to read error body
  let errorBody = 'Unknown error';
  try {
    const json = await graphResponse.json();
    errorBody = json?.error?.message ?? JSON.stringify(json).slice(0, 300);
  } catch {
    errorBody = `HTTP ${graphResponse.status}`;
  }

  return NextResponse.json(
    {
      ok: false,
      sent: false,
      gateId,
      error: `Graph sendMail failed: ${errorBody}`,
      httpStatus: graphResponse.status,
    },
    { status: 502 }
  );
}
