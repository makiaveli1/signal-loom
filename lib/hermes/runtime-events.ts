import { open, stat } from 'node:fs/promises';
import { homedir } from 'node:os';

const DEFAULT_RUNTIME_EVENTS_PATH = `${process.env.HOME ?? homedir()}/.hermes/runtime-events.jsonl`;
export const HERMES_RUNTIME_EVENTS_PATH = process.env.HERMES_RUNTIME_EVENTS_PATH ?? DEFAULT_RUNTIME_EVENTS_PATH;

export interface RuntimeEventCursor {
  path: string;
  exists: boolean;
  size: number;
  mtimeMs: number | null;
}

export interface HermesRuntimeEventRecord {
  type: string;
  sessionId?: string;
  session_id?: string;
  sessionKey?: string;
  parentSessionId?: string | null;
  parent_session_id?: string | null;
  childSessionId?: string;
  child_session_id?: string;
  messageId?: string | number;
  message_id?: string | number;
  toolCallId?: string;
  tool_call_id?: string;
  toolName?: string;
  tool_name?: string;
  role?: string;
  text?: string;
  status?: string;
  summary?: string;
  taskPreview?: string;
  argsPreview?: string;
  resultPreview?: string;
  at?: string;
  timestamp?: string | number;
}

export interface RuntimeEventBatch {
  cursor: RuntimeEventCursor;
  events: Array<{ offset: number; event: HermesRuntimeEventRecord }>;
}

const MAX_READ_BYTES = 256 * 1024;

export async function getRuntimeEventCursor(path = HERMES_RUNTIME_EVENTS_PATH): Promise<RuntimeEventCursor> {
  try {
    const stats = await stat(/* turbopackIgnore: true */ path);
    return { path, exists: true, size: stats.size, mtimeMs: stats.mtimeMs };
  } catch {
    return { path, exists: false, size: 0, mtimeMs: null };
  }
}

function normalizeTimestamp(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const millis = value > 10_000_000_000 ? value : value * 1000;
    return new Date(millis).toISOString();
  }
  return undefined;
}

function coerceRuntimeEvent(raw: unknown): HermesRuntimeEventRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const type = typeof record.type === 'string' ? record.type : '';
  if (!type) return null;

  return {
    type,
    sessionId: typeof record.sessionId === 'string' ? record.sessionId : undefined,
    session_id: typeof record.session_id === 'string' ? record.session_id : undefined,
    sessionKey: typeof record.sessionKey === 'string' ? record.sessionKey : undefined,
    parentSessionId: typeof record.parentSessionId === 'string' || record.parentSessionId === null ? record.parentSessionId : undefined,
    parent_session_id: typeof record.parent_session_id === 'string' || record.parent_session_id === null ? record.parent_session_id : undefined,
    childSessionId: typeof record.childSessionId === 'string' ? record.childSessionId : undefined,
    child_session_id: typeof record.child_session_id === 'string' ? record.child_session_id : undefined,
    messageId: typeof record.messageId === 'string' || typeof record.messageId === 'number' ? record.messageId : undefined,
    message_id: typeof record.message_id === 'string' || typeof record.message_id === 'number' ? record.message_id : undefined,
    toolCallId: typeof record.toolCallId === 'string' ? record.toolCallId : undefined,
    tool_call_id: typeof record.tool_call_id === 'string' ? record.tool_call_id : undefined,
    toolName: typeof record.toolName === 'string' ? record.toolName : undefined,
    tool_name: typeof record.tool_name === 'string' ? record.tool_name : undefined,
    role: typeof record.role === 'string' ? record.role : undefined,
    text: typeof record.text === 'string' ? record.text : undefined,
    status: typeof record.status === 'string' ? record.status : undefined,
    summary: typeof record.summary === 'string' ? record.summary : undefined,
    taskPreview: typeof record.taskPreview === 'string' ? record.taskPreview : undefined,
    argsPreview: typeof record.argsPreview === 'string' ? record.argsPreview : undefined,
    resultPreview: typeof record.resultPreview === 'string' ? record.resultPreview : undefined,
    at: normalizeTimestamp(record.at ?? record.timestamp),
  };
}

export async function readRuntimeEventsAfter(
  offset: number,
  limit = 120,
  path = HERMES_RUNTIME_EVENTS_PATH,
): Promise<RuntimeEventBatch> {
  const cursor = await getRuntimeEventCursor(path);
  if (!cursor.exists || cursor.size <= 0) return { cursor, events: [] };

  const safeOffset = Math.max(0, Math.min(offset, cursor.size));
  if (safeOffset === cursor.size) return { cursor, events: [] };

  const bytesToRead = Math.min(cursor.size - safeOffset, MAX_READ_BYTES);
  const fh = await open(/* turbopackIgnore: true */ path, 'r');
  try {
    const buffer = Buffer.alloc(bytesToRead);
    const { bytesRead } = await fh.read(buffer, 0, bytesToRead, safeOffset);
    const text = buffer.subarray(0, bytesRead).toString('utf8');
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    const events: Array<{ offset: number; event: HermesRuntimeEventRecord }> = [];
    let runningOffset = safeOffset;

    for (const line of lines) {
      const lineOffset = runningOffset;
      runningOffset += Buffer.byteLength(line, 'utf8') + 1;
      try {
        const event = coerceRuntimeEvent(JSON.parse(line));
        if (event) events.push({ offset: lineOffset, event });
      } catch {
        // Ignore malformed/incomplete JSONL rows; future complete rows still flow.
      }
    }

    return { cursor, events: events.slice(-limit) };
  } finally {
    await fh.close();
  }
}

export function normalizeRuntimeEventForGateway(record: HermesRuntimeEventRecord) {
  const sessionKey = record.sessionKey ?? record.sessionId ?? record.session_id;
  const parentSessionId = record.parentSessionId ?? record.parent_session_id ?? null;
  const childSessionId = record.childSessionId ?? record.child_session_id;
  const messageId = record.messageId ?? record.message_id;
  const toolCallId = record.toolCallId ?? record.tool_call_id;
  const toolName = record.toolName ?? record.tool_name;
  const text = record.text ?? record.summary ?? record.resultPreview ?? record.argsPreview;

  return {
    type: record.type,
    data: {
      source: 'hermes-runtime-events',
      sessionKey: sessionKey ?? childSessionId,
      parentSessionId,
      childSessionId,
      messageId,
      toolCallId,
      toolName,
      role: record.role,
      text,
      status: record.status,
      taskPreview: record.taskPreview,
      argsPreview: record.argsPreview,
      resultPreview: record.resultPreview,
      at: record.at ?? new Date().toISOString(),
    },
  };
}
