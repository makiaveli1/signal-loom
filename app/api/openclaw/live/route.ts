/**
 * SSE endpoint for real-time gateway events.
 *
 * Bridges the gateway WebSocket protocol to browser EventSource.
 * Browser connects via EventSource to this route; this route maintains
 * a persistent WebSocket connection to the gateway and streams events
 * as SSE data events.
 *
 * Supports:
 *  - session.message: new transcript messages (from any channel)
 *  - sessions.changed: session list changes
 *
 * Auth: reads OPENCLAW_GATEWAY_TOKEN from server environment.
 */

import { NextResponse } from 'next/server';

const GATEWAY_WS = process.env.OPENCLAW_GATEWAY_URL ?? 'ws://127.0.0.1:18789';
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN ?? '';

// Minimum viable WebSocket client for the gateway protocol
function createGatewayClient() {
  // Node.js WebSocket — use dynamic import to avoid ESM/CJS issues
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const WebSocket = (require('ws') as any).WebSocket as new (url: string) => import('ws').WebSocket;

  return {
    ws: null as import('ws').WebSocket | null,
    messageHandlers: [] as ((event: { type: string; data: unknown }) => void)[],

    connect(token: string): Promise<void> {
      return new Promise((resolve, reject) => {
        this.ws = new WebSocket(GATEWAY_WS);

        this.ws.on('message', (raw: Buffer) => {
          try {
            const msg = JSON.parse(raw.toString()) as { type: string; data?: unknown };
            if (msg.type === 'hello-ok') {
              resolve();
            }
            this.messageHandlers.forEach((h) => h(msg));
          } catch {
            // Ignore malformed frames
          }
        });

        this.ws.on('error', (err) => {
          reject(err);
        });

        this.ws.on('close', () => {
          // Reconnect after 3s
          setTimeout(() => this._reconnect(token), 3000);
        });

        // Send connect frame
        this.ws.on('open', () => {
          this.ws!.send(
            JSON.stringify({
              type: 'connect',
              protocolVersion: { min: 1, max: 1 },
              connectParams: {
                minProtocol: 1,
                maxProtocol: 1,
                client: {
                  id: 'signal-loom-live',
                  displayName: 'Signal Loom Live',
                  version: '1.0.0',
                  platform: 'browser',
                  mode: 'client',
                },
                scopes: ['operator.read'],
                auth: { token },
              },
            })
          );
        });
      });
    },

    _reconnect(token: string) {
      if (this.ws) {
        try { this.ws.close(); } catch { /* ignore */ }
        this.ws = null;
      }
      this.connect(token).catch(() => {/* reconnect handled in close handler */});
    },

    send(msg: object) {
      if (this.ws?.readyState === 1 /* OPEN */) {
        this.ws.send(JSON.stringify(msg));
      }
    },

    onMessage(handler: (event: { type: string; data: unknown }) => void) {
      this.messageHandlers.push(handler);
      return () => {
        this.messageHandlers = this.messageHandlers.filter((h) => h !== handler);
      };
    },

    subscribe(events: string[]) {
      this.send({ type: 'subscribe', events });
    },

    close() {
      if (this.ws) {
        try { this.ws.close(); } catch { /* ignore */ }
        this.ws = null;
      }
    },
  };
}

// Singleton client per server instance
let client: ReturnType<typeof createGatewayClient> | null = null;

export async function GET() {
  if (!GATEWAY_TOKEN) {
    return NextResponse.json({ error: 'Gateway token not configured' }, { status: 500 });
  }

  // Lazily create the shared gateway client
  if (!client) {
    client = createGatewayClient();
    await client.connect(GATEWAY_TOKEN).catch(() => {/* handled by reconnect */});
    // Subscribe to real-time session events
    client.subscribe(['session.message', 'sessions.changed']);
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send heartbeat comment every 25s to keep the connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25000);

      // Send initial connected ping so client knows SSE stream is alive
      try {
        controller.enqueue(encoder.encode('event: connected\ndata: {}\n\n'));
      } catch {
        // Stream already closed
        clearInterval(heartbeat);
        unsub();
        return;
      }

      // Forward gateway events to SSE
      const unsub = client!.onMessage((msg) => {
        try {
          const data = `event: gateway\ndata: ${JSON.stringify(msg)}\n\n`;
          controller.enqueue(encoder.encode(data));
        } catch {
          /* stream may be closed */
        }
      });

      // Clean up on disconnect
      return () => {
        clearInterval(heartbeat);
        unsub();
      };
    },
    cancel() {
      // Note: we keep the shared client alive across requests
      // since SSE connections are short-lived and re-established
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
    },
  });
}
