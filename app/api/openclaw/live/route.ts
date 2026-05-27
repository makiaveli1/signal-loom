/**
 * SSE endpoint for Hermes runtime changes.
 *
 * Signal Loom used to bridge an OpenClaw gateway WebSocket. Hermes does not
 * expose that OpenClaw WS protocol; the canonical local truth is
 * ~/.hermes/state.db. This route watches the DB mtime and emits the same small
 * event vocabulary the existing client/store already understands.
 */
import { stat } from 'node:fs/promises';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HERMES_STATE_DB = process.env.HERMES_STATE_DB ?? '/home/likwid/.hermes/state.db';
const POLL_MS = 3000;
const HEARTBEAT_MS = 25000;

async function stateFingerprint(): Promise<string> {
  const s = await stat(/* turbopackIgnore: true */ HERMES_STATE_DB);
  return `${s.mtimeMs}:${s.size}`;
}

export async function GET() {
  try {
    await stat(/* turbopackIgnore: true */ HERMES_STATE_DB);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : `Hermes state DB unavailable: ${HERMES_STATE_DB}` },
      { status: 500 },
    );
  }

  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let poller: ReturnType<typeof setInterval> | null = null;
  let lastFingerprint = await stateFingerprint();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      send('connected', { source: 'hermes-state-db', path: HERMES_STATE_DB });

      heartbeat = setInterval(() => {
        try { controller.enqueue(encoder.encode(': heartbeat\n\n')); }
        catch { /* stream closed */ }
      }, HEARTBEAT_MS);

      poller = setInterval(() => {
        void (async () => {
          try {
            const next = await stateFingerprint();
            if (next === lastFingerprint) return;
            lastFingerprint = next;
            send('gateway', {
              type: 'sessions.changed',
              data: { source: 'hermes-state-db', fingerprint: next },
            });
          } catch (e) {
            send('gateway', {
              type: 'runtime.error',
              data: { error: e instanceof Error ? e.message : 'Hermes state poll failed' },
            });
          }
        })();
      }, POLL_MS);
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      if (poller) clearInterval(poller);
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
