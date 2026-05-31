/**
 * SSE endpoint for Hermes runtime changes.
 *
 * Today this is a read-only bridge over Hermes' local state database. It emits
 * row-level deltas, not just "the DB file changed", so Signal Loom can refresh
 * visible CLI/TUI/API conversations while they are happening. When Hermes grows
 * a native runtime event stream, this route is the bridge point.
 */
import { stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { NextResponse } from 'next/server';
import { getHermesStateCursor, loadHermesDeltas, unixToIso } from '@/lib/hermes/state-db';
import { getRuntimeEventCursor, normalizeRuntimeEventForGateway, readRuntimeEventsAfter } from '@/lib/hermes/runtime-events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HERMES_STATE_DB = process.env.HERMES_STATE_DB ?? `${process.env.HOME ?? homedir()}/.hermes/state.db`;
const POLL_MS = 1200;
const HEARTBEAT_MS = 20000;
const DELTA_LIMIT = 120;
const RUNTIME_EVENT_LIMIT = 120;

type SseController = ReadableStreamDefaultController<Uint8Array>;

function eventIdFor(prefix: string, id: string | number): string {
  return `${prefix}:${id}`;
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

  let initialCursor;
  const initialRuntimeCursor = await getRuntimeEventCursor();
  try {
    initialCursor = await getHermesStateCursor();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to read Hermes state cursor' },
      { status: 500 },
    );
  }

  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let poller: ReturnType<typeof setInterval> | null = null;
  let closed = false;
  let lastMessageId = initialCursor.maxMessageId;
  let lastRuntimeOffset = initialRuntimeCursor.exists ? initialRuntimeCursor.size : 0;
  let lastSessionCount = initialCursor.sessionCount;
  let lastSessionStartedAt = initialCursor.maxSessionStartedAt ?? 0;
  let polling = false;

  const stream = new ReadableStream({
    start(controller: SseController) {
      const send = (event: string, data: unknown, id?: string) => {
        if (closed) return;
        const frame = `${id ? `id: ${id}\n` : ''}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        try {
          controller.enqueue(encoder.encode(frame));
        } catch {
          closed = true;
        }
      };

      send('connected', {
        source: initialRuntimeCursor.exists ? 'hermes-runtime-events+state-db' : 'hermes-state-db',
        path: HERMES_STATE_DB,
        runtimeEvents: initialRuntimeCursor,
        cursor: initialCursor,
        pollMs: POLL_MS,
      });

      heartbeat = setInterval(() => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(': heartbeat\n\n')); }
        catch { closed = true; }
      }, HEARTBEAT_MS);

      poller = setInterval(() => {
        if (closed || polling) return;
        polling = true;
        void (async () => {
          try {
            const runtimeBatch = await readRuntimeEventsAfter(lastRuntimeOffset, RUNTIME_EVENT_LIMIT);
            if (runtimeBatch.cursor.exists && runtimeBatch.cursor.size < lastRuntimeOffset) {
              lastRuntimeOffset = 0;
            }

            for (const runtimeEvent of runtimeBatch.events) {
              const normalized = normalizeRuntimeEventForGateway(runtimeEvent.event);
              send('gateway', normalized, eventIdFor('runtime', runtimeEvent.offset));
            }
            lastRuntimeOffset = runtimeBatch.cursor.size;

            const deltas = await loadHermesDeltas(lastMessageId, DELTA_LIMIT);
            const cursor = deltas.cursor;
            const changedSessionIds = new Set(deltas.changedSessionIds);
            const sessionShapeChanged =
              cursor.sessionCount !== lastSessionCount ||
              (cursor.maxSessionStartedAt ?? 0) !== lastSessionStartedAt;

            if (sessionShapeChanged || deltas.messages.length > 0) {
              send('gateway', {
                type: 'sessions.changed',
                data: {
                  source: 'hermes-state-db',
                  cursor,
                  changedSessionIds: [...changedSessionIds],
                },
              }, eventIdFor('sessions', cursor.maxMessageId));
            }

            for (const message of deltas.messages) {
              const base = {
                source: 'hermes-state-db',
                sessionKey: message.session_id,
                messageId: message.id,
                role: message.role,
                at: unixToIso(message.timestamp) ?? new Date().toISOString(),
                parentSessionId: message.parent_session_id ?? null,
                sessionTitle: message.session_title ?? null,
                sessionSource: message.session_source ?? null,
              };

              send('gateway', {
                type: 'session.message',
                data: base,
              }, eventIdFor('msg', message.id));

              if (message.tool_name || message.role === 'tool') {
                send('gateway', {
                  type: 'session.tool',
                  data: {
                    ...base,
                    toolName: message.tool_name ?? 'tool',
                  },
                }, eventIdFor('tool', message.id));
              }

              if (message.parent_session_id) {
                send('gateway', {
                  type: 'subagent.updated',
                  data: {
                    ...base,
                    childSessionId: message.session_id,
                    parentSessionId: message.parent_session_id,
                  },
                }, eventIdFor('subagent', message.id));
              }
            }

            lastMessageId = Math.max(lastMessageId, cursor.maxMessageId);
            lastSessionCount = cursor.sessionCount;
            lastSessionStartedAt = cursor.maxSessionStartedAt ?? 0;
          } catch (e) {
            send('gateway', {
              type: 'runtime.error',
              data: { error: e instanceof Error ? e.message : 'Hermes state poll failed' },
            });
          } finally {
            polling = false;
          }
        })();
      }, POLL_MS);
    },
    cancel() {
      closed = true;
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
