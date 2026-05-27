import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const HERMES_STATE_DB = process.env.HERMES_STATE_DB
  ?? `${process.env.HOME ?? '/home/likwid'}/.hermes/state.db`;

async function runPythonJson<T>(script: string, args: string[] = []): Promise<T> {
  const { stdout } = await execFileAsync('python3', ['-c', script, HERMES_STATE_DB, ...args], {
    maxBuffer: 5 * 1024 * 1024,
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
  });
  return JSON.parse(stdout) as T;
}

export interface HermesStateSession {
  id: string;
  source: string;
  model?: string | null;
  title?: string | null;
  started_at: number;
  ended_at?: number | null;
  end_reason?: string | null;
  message_count: number;
  tool_call_count: number;
  parent_session_id?: string | null;
  preview: string;
  last_active: number;
}

export interface HermesStateMessage {
  id: number;
  session_id: string;
  role: string;
  content: string;
  tool_name?: string | null;
  timestamp: number;
  model?: string | null;
  finish_reason?: string | null;
}

const LIST_SESSIONS_SCRIPT = String.raw`
import json, os, sqlite3, sys
path = sys.argv[1]
limit = int(sys.argv[2]) if len(sys.argv) > 2 else 200
if not os.path.exists(path):
    print(json.dumps({"ok": False, "error": f"state.db not found: {path}", "sessions": []}))
    raise SystemExit(0)
conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
conn.row_factory = sqlite3.Row
rows = conn.execute("""
    SELECT s.id, s.source, s.model, s.title, s.started_at, s.ended_at, s.end_reason,
           s.message_count, s.tool_call_count, s.parent_session_id,
           COALESCE((
             SELECT SUBSTR(REPLACE(REPLACE(m.content, X'0A', ' '), X'0D', ' '), 1, 140)
             FROM messages m
             WHERE m.session_id = s.id AND m.role = 'user' AND m.content IS NOT NULL
             ORDER BY m.timestamp, m.id LIMIT 1
           ), '') AS preview,
           COALESCE((SELECT MAX(m2.timestamp) FROM messages m2 WHERE m2.session_id = s.id), s.started_at) AS last_active
    FROM sessions s
    ORDER BY last_active DESC, s.started_at DESC
    LIMIT ?
""", (limit,)).fetchall()
print(json.dumps({"ok": True, "sessions": [dict(r) for r in rows]}, ensure_ascii=False))
`;

const LOAD_MESSAGES_SCRIPT = String.raw`
import json, os, sqlite3, sys
path = sys.argv[1]
session_id = sys.argv[2]
limit = int(sys.argv[3]) if len(sys.argv) > 3 else 80
PREFIX = "\x00json:"

def flatten(value):
    if value is None:
        return ""
    if isinstance(value, str) and value.startswith(PREFIX):
        try:
            value = json.loads(value[len(PREFIX):])
        except Exception:
            return value
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        parts = []
        for item in value:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                typ = item.get('type')
                if typ in ('text', 'input_text', 'output_text') and item.get('text'):
                    parts.append(str(item.get('text')))
                elif typ == 'tool_use':
                    parts.append('[Tool: %s]' % (item.get('name') or 'tool'))
                elif typ == 'tool_result':
                    c = item.get('content')
                    parts.append('[Result] ' + (c if isinstance(c, str) else json.dumps(c, ensure_ascii=False)))
        return '\n'.join(p for p in parts if p)
    try:
        return json.dumps(value, ensure_ascii=False)
    except Exception:
        return str(value)

if not os.path.exists(path):
    print(json.dumps({"ok": False, "error": f"state.db not found: {path}", "messages": []}))
    raise SystemExit(0)
conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
conn.row_factory = sqlite3.Row
rows = conn.execute("""
    SELECT id, session_id, role, content, tool_name, timestamp, finish_reason
    FROM messages
    WHERE session_id = ?
    ORDER BY timestamp DESC, id DESC
    LIMIT ?
""", (session_id, limit)).fetchall()
items = []
for r in reversed(rows):
    d = dict(r)
    content = flatten(d.get('content'))
    if d.get('role') == 'tool' and d.get('tool_name') and not content:
        content = '[Tool result: %s]' % d.get('tool_name')
    d['content'] = content
    items.append(d)
print(json.dumps({"ok": True, "messages": items}, ensure_ascii=False))
`;

export async function listHermesSessions(limit = 200): Promise<HermesStateSession[]> {
  const result = await runPythonJson<{ ok: boolean; error?: string; sessions: HermesStateSession[] }>(
    LIST_SESSIONS_SCRIPT,
    [String(limit)],
  );
  if (!result.ok) throw new Error(result.error ?? 'Failed to read Hermes sessions');
  return result.sessions;
}

export async function loadHermesMessages(sessionId: string, limit = 80): Promise<HermesStateMessage[]> {
  const result = await runPythonJson<{ ok: boolean; error?: string; messages: HermesStateMessage[] }>(
    LOAD_MESSAGES_SCRIPT,
    [sessionId, String(limit)],
  );
  if (!result.ok) throw new Error(result.error ?? 'Failed to read Hermes messages');
  return result.messages;
}

export function unixToIso(ts?: number | null): string | null {
  if (!ts) return null;
  const millis = ts > 10_000_000_000 ? ts : ts * 1000;
  return new Date(millis).toISOString();
}
