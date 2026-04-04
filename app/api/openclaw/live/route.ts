/**
 * SSE endpoint for real-time gateway events.
 * Bridges gateway WebSocket → browser EventSource.
 * Uses Node.js v22 built-in WebSocket — no external packages.
 */
import { NextResponse } from 'next/server';

const GATEWAY_WS = process.env.OPENCLAW_GATEWAY_URL ?? 'ws://127.0.0.1:18789';
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN ?? '';

// Track subscribed state so we re-subscribe after reconnect
let subscribed = false;

function createGatewayClient() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const WS = globalThis.WebSocket as any;

  return {
    ws: null as WebSocket | null,
    messageHandlers: [] as ((event: { type: string; data?: unknown }) => void)[],

    connect(token: string): Promise<void> {
      subscribed = false;
      return new Promise((resolve, reject) => {
        this.ws = new (WS as unknown as { new(url: string): WebSocket })(GATEWAY_WS);

        this.ws.onopen = () => {
          this.ws!.send(JSON.stringify({
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
          }));
        };

        this.ws.onmessage = (event: MessageEvent) => {
          try {
            const msg = JSON.parse(event.data as string) as { type: string; data?: unknown };

            // Once hello-ok arrives, the connection is authenticated — now subscribe
            if (msg.type === 'hello-ok') {
              resolve();
              // Subscribe after auth is confirmed, not before
              if (!subscribed) {
                subscribed = true;
                this.send({ type: 'subscribe', events: ['session.message', 'sessions.changed', 'session.tool'] });
              }
            }

            this.messageHandlers.forEach((h) => h(msg));
          } catch { /* ignore malformed */ }
        };

        this.ws.onerror = (err: Event) => { reject(err); };
        this.ws.onclose = () => {
          subscribed = false;
          // Reconnect with backoff
          setTimeout(() => this._reconnect(token), 3000);
        };
      });
    },

    _reconnect(token: string) {
      if (this.ws) { try { this.ws.close(); } catch { /* noop */ } this.ws = null; }
      this.connect(token).catch(() => {/* reconnect handled in close */});
    },

    send(msg: object) {
      // readyState 1 = OPEN
      if (this.ws?.readyState === 1) {
        this.ws.send(JSON.stringify(msg));
      }
    },

    onMessage(handler: (event: { type: string; data?: unknown }) => void) {
      this.messageHandlers.push(handler);
      return () => { this.messageHandlers = this.messageHandlers.filter((h) => h !== handler); };
    },

    close() {
      if (this.ws) { try { this.ws.close(); } catch { /* noop */ } this.ws = null; }
    },
  };
}

// Singleton client — shared across all SSE request handlers
let client: ReturnType<typeof createGatewayClient> | null = null;

export async function GET() {
  if (!GATEWAY_TOKEN) {
    return NextResponse.json({ error: 'Gateway token not configured' }, { status: 500 });
  }

  // Lazily create the shared gateway client
  if (!client) {
    client = createGatewayClient();
    // Fire and forget — subscribe happens inside onMessage on hello-ok
    client.connect(GATEWAY_TOKEN).catch(() => {/* reconnect handled by close handler */});
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Heartbeat to keep connection alive through proxies/gateways
      const heartbeat = setInterval(() => {
        try { controller.enqueue(encoder.encode(': heartbeat\n\n')); }
        catch { clearInterval(heartbeat); }
      }, 25000);

      // Send connected event so the browser knows the SSE stream is up
      try { controller.enqueue(encoder.encode('event: connected\ndata: {}\n\n')); }
      catch { clearInterval(heartbeat); return; }

      // Re-subscribe after SSE reconnect (browsers reconnect SSE automatically)
      if (!subscribed && client) {
        subscribed = true;
        client.send({ type: 'subscribe', events: ['session.message', 'sessions.changed', 'session.tool'] });
      }

      // Forward gateway events to SSE
      const unsub = client!.onMessage((msg) => {
        try {
          const data = `event: gateway\ndata: ${JSON.stringify(msg)}\n\n`;
          controller.enqueue(encoder.encode(data));
        } catch { /* stream closed */ }
      });

      return () => {
        clearInterval(heartbeat);
        unsub();
      };
    },
    cancel() {
      // SSE client disconnect — keep the gateway WS alive for the next request
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
