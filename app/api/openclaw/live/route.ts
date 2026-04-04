/**
 * SSE endpoint for real-time gateway events.
 * Uses Node.js v22 built-in WebSocket — no external packages needed.
 */
import { NextResponse } from 'next/server';

const GATEWAY_WS = process.env.OPENCLAW_GATEWAY_URL ?? 'ws://127.0.0.1:18789';
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN ?? '';

function createGatewayClient() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const WebSocket = globalThis.WebSocket as any;

  return {
    ws: null as WebSocket | null,
    messageHandlers: [] as ((event: { type: string; data?: unknown }) => void)[],

    connect(token: string): Promise<void> {
      return new Promise((resolve, reject) => {
        this.ws = new (WebSocket as unknown as { new(url: string): WebSocket })(GATEWAY_WS);

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
            if (msg.type === 'hello-ok') resolve();
            this.messageHandlers.forEach((h) => h(msg));
          } catch { /* ignore malformed */ }
        };

        this.ws.onerror = (err: Event) => { reject(err); };
        this.ws.onclose = () => { setTimeout(() => this._reconnect(token), 3000); };
      });
    },

    _reconnect(token: string) {
      if (this.ws) { try { this.ws.close(); } catch { /* noop */ } this.ws = null; }
      this.connect(token).catch(() => {/* reconnect handled in close */});
    },

    send(msg: object) {
      if (this.ws?.readyState === (WebSocket as unknown as { OPEN: number }).OPEN) {
        this.ws.send(JSON.stringify(msg));
      }
    },

    onMessage(handler: (event: { type: string; data?: unknown }) => void) {
      this.messageHandlers.push(handler);
      return () => { this.messageHandlers = this.messageHandlers.filter((h) => h !== handler); };
    },

    subscribe(events: string[]) { this.send({ type: 'subscribe', events }); },

    close() {
      if (this.ws) { try { this.ws.close(); } catch { /* noop */ } this.ws = null; }
    },
  };
}

let client: ReturnType<typeof createGatewayClient> | null = null;

export async function GET() {
  if (!GATEWAY_TOKEN) {
    return NextResponse.json({ error: 'Gateway token not configured' }, { status: 500 });
  }

  if (!client) {
    client = createGatewayClient();
    await client.connect(GATEWAY_TOKEN).catch(() => {/* handled by reconnect */});
    client.subscribe(['session.message', 'sessions.changed']);
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const heartbeat = setInterval(() => {
        try { controller.enqueue(encoder.encode(': heartbeat\n\n')); }
        catch { clearInterval(heartbeat); }
      }, 25000);

      try { controller.enqueue(encoder.encode('event: connected\ndata: {}\n\n')); }
      catch { clearInterval(heartbeat); return; }

      const unsub = client!.onMessage((msg) => {
        try { controller.enqueue(encoder.encode('event: gateway\ndata: ' + JSON.stringify(msg) + '\n\n')); }
        catch { /* stream closed */ }
      });

      return () => { clearInterval(heartbeat); unsub(); };
    },
    cancel() { /* keep client alive across SSE reconnects */ },
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
