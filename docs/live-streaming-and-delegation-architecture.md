# Signal Loom live streaming + delegation architecture

Signal Loom now treats Hermes' local state database as a near-live event source and exposes a bridge point for true runtime events.

## What works in this slice

- `/api/openclaw/live` is an SSE endpoint.
- It can tail an optional append-only Hermes runtime event log at `HERMES_RUNTIME_EVENTS_PATH` or `~/.hermes/runtime-events.jsonl`.
- It polls Hermes `~/.hermes/state.db` by message cursor instead of only DB file mtime.
- It prefers runtime JSONL frames when present, then falls back to persisted `state.db` deltas.
- It emits typed gateway frames:
  - `sessions.changed`
  - `session.message`
  - `session.tool`
  - `subagent.updated`
  - native runtime frames such as `assistant.delta`, `reasoning.delta`, `tool.started`, and `tool.finished`
- The client live-events hook refreshes visible/followed transcripts when persisted session-specific frames arrive.
- Runtime frames are ingested as transient transcript/activity state before DB persistence.
- `/api/openclaw/sessions` exposes real `parentSessionId` / `childSessionIds` relationships from Hermes `sessions.parent_session_id`.
- Live Lanes render delegated child sessions as monitorable subagent cards.
- UI-origin chat streaming is on by default.

## Current boundary

Without a Hermes runtime-event producer, this remains persisted near-live streaming, not token-perfect CLI runtime streaming.

If a conversation happens in Hermes CLI/TUI, Signal Loom can update once Hermes writes session/message/tool rows into `state.db`. It can also show pre-persistence events if Hermes appends JSONL frames to the configured runtime log. Until Hermes emits those frames itself, Signal Loom cannot invent token deltas, private thinking deltas, or tool-start events before Hermes records or publishes them.

## Required Hermes runtime bridge for full fidelity

For true “watch CLI conversations while Nero thinks, streams, uses tools, and delegates” behavior, Hermes should expose a runtime event stream or append-only event log with frames like:

```ts
type HermesRuntimeEvent =
  | { type: 'session.started'; sessionId: string; parentSessionId?: string; source: string; at: string }
  | { type: 'message.started'; sessionId: string; role: string; messageId?: string; at: string }
  | { type: 'assistant.delta'; sessionId: string; messageId?: string; text: string; at: string }
  | { type: 'reasoning.delta'; sessionId: string; messageId?: string; text: string; at: string }
  | { type: 'tool.started'; sessionId: string; toolCallId: string; toolName: string; argsPreview?: string; at: string }
  | { type: 'tool.finished'; sessionId: string; toolCallId: string; toolName: string; ok: boolean; resultPreview?: string; at: string }
  | { type: 'subagent.started'; sessionId: string; parentSessionId: string; agentName?: string; taskPreview?: string; at: string }
  | { type: 'subagent.finished'; sessionId: string; parentSessionId: string; status: string; summary?: string; at: string }
  | { type: 'message.finished'; sessionId: string; messageId?: string; at: string };
```

Signal Loom's bridge point for that source is `/api/openclaw/live`: prefer native Hermes runtime frames when available, fall back to `state.db` cursor polling when not.

## Runtime event log contract

Each line is one JSON object. Signal Loom tails from the end of the file on SSE connect, so old events are not replayed into a fresh browser tab.

Default path:

```bash
~/.hermes/runtime-events.jsonl
```

Override:

```bash
HERMES_RUNTIME_EVENTS_PATH=/path/to/runtime-events.jsonl
```

Example:

```json
{"type":"tool.started","sessionId":"20260528_130802_1263c6","toolCallId":"tool-1","toolName":"terminal","argsPreview":"npm run build","at":"2026-05-28T13:30:00Z"}
```

Signal Loom intentionally keeps this schema small and preview-based. Producers should send safe previews, not raw secrets or full tool payloads.

## UX rules

- Tool output stays folded into receipts; live chips/edges show activity without flooding the transcript.
- Subagent work appears in Live Lanes first, and can open a secondary/monitor pane.
- Motion is transform/opacity-first, restrained, and respects `prefers-reduced-motion`.
