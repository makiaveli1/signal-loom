import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { promisify } from 'node:util';

export const dynamic = 'force-dynamic';

const execFileAsync = promisify(execFile);
const HOME = process.env.HOME ?? '/home/likwid';
const HERMES_HOME = process.env.HERMES_HOME ?? `${HOME}/.hermes`;
const CONFIG_PATH = process.env.HERMES_CONFIG ?? `${HERMES_HOME}/config.yaml`;
const ENV_PATH = process.env.HERMES_ENV ?? `${HERMES_HOME}/.env`;
const STATE_DB_PATH = process.env.HERMES_STATE_DB ?? `${HERMES_HOME}/state.db`;
const MEDIA_PATH = process.env.HERMES_MEDIA_DIR ?? `${HERMES_HOME}/media_cache`;
const MAX_CONFIG_BYTES = 220_000;

type SettingType = 'boolean' | 'select' | 'number' | 'text';
type SettingValue = boolean | number | string;
type QuickSetting = {
  key: string;
  label: string;
  description: string;
  category: 'Model' | 'Chat' | 'Voice' | 'Privacy' | 'Safety' | 'Display';
  type: SettingType;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  applies: string;
};

const SAFE_ACTIONS: Record<string, { label: string; args: string[]; timeout: number }> = {
  doctor: { label: 'Hermes health check', args: ['doctor'], timeout: 60_000 },
  gateway: { label: 'Gateway status', args: ['gateway', 'status'], timeout: 25_000 },
  memory: { label: 'Memory status', args: ['memory', 'status'], timeout: 20_000 },
  mcp: { label: 'MCP servers', args: ['mcp', 'list'], timeout: 20_000 },
  tools: { label: 'Toolsets', args: ['tools', 'list'], timeout: 20_000 },
};

const QUICK_SETTINGS: QuickSetting[] = [
  {
    key: 'model.default',
    label: 'Default model',
    description: 'The model Hermes uses when you start a new chat.',
    category: 'Model',
    type: 'text',
    placeholder: 'gpt-5.5',
    applies: 'New chats only',
  },
  {
    key: 'model.provider',
    label: 'Model provider',
    description: 'The service Hermes asks for model replies.',
    category: 'Model',
    type: 'select',
    options: ['openai-codex', 'openrouter', 'anthropic', 'openai', 'google', 'deepseek', 'nous', 'custom'],
    applies: 'New chats only',
  },
  {
    key: 'agent.max_turns',
    label: 'Maximum tool turns',
    description: 'How long Hermes can keep working before it stops and reports back.',
    category: 'Chat',
    type: 'number',
    min: 10,
    max: 200,
    step: 5,
    applies: 'New chats only',
  },
  {
    key: 'agent.verbose',
    label: 'Verbose mode',
    description: 'Show more runtime detail while Hermes works.',
    category: 'Chat',
    type: 'boolean',
    applies: 'New chats only',
  },
  {
    key: 'display.compact',
    label: 'Compact display',
    description: 'Use tighter spacing in the terminal UI.',
    category: 'Display',
    type: 'boolean',
    applies: 'Next launch',
  },
  {
    key: 'display.show_reasoning',
    label: 'Show reasoning when available',
    description: 'Show supported model reasoning traces in the UI.',
    category: 'Display',
    type: 'boolean',
    applies: 'New chats only',
  },
  {
    key: 'display.show_cost',
    label: 'Show estimated cost',
    description: 'Show cost estimates when the provider reports usage.',
    category: 'Display',
    type: 'boolean',
    applies: 'New chats only',
  },
  {
    key: 'display.streaming',
    label: 'Stream replies',
    description: 'Show answers as they are written instead of waiting for the full reply.',
    category: 'Display',
    type: 'boolean',
    applies: 'New chats only',
  },
  {
    key: 'display.bell_on_complete',
    label: 'Sound when done',
    description: 'Play a terminal bell when a long task finishes.',
    category: 'Display',
    type: 'boolean',
    applies: 'Next launch',
  },
  {
    key: 'display.tool_progress',
    label: 'Tool progress detail',
    description: 'How much tool progress Hermes shows while it works.',
    category: 'Display',
    type: 'select',
    options: ['off', 'new', 'all', 'verbose'],
    applies: 'New chats only',
  },
  {
    key: 'compression.enabled',
    label: 'Auto-compress long chats',
    description: 'Summarise old context when a chat gets too large.',
    category: 'Chat',
    type: 'boolean',
    applies: 'New chats only',
  },
  {
    key: 'compression.threshold',
    label: 'Compression trigger',
    description: 'How full the context can get before Hermes compresses it. 0.7 means 70%.',
    category: 'Chat',
    type: 'number',
    min: 0.4,
    max: 0.95,
    step: 0.05,
    applies: 'New chats only',
  },
  {
    key: 'memory.memory_enabled',
    label: 'Agent memory',
    description: 'Let Hermes keep durable notes across sessions.',
    category: 'Privacy',
    type: 'boolean',
    applies: 'New chats only',
  },
  {
    key: 'memory.user_profile_enabled',
    label: 'User profile memory',
    description: 'Let Hermes remember stable details about you and your preferences.',
    category: 'Privacy',
    type: 'boolean',
    applies: 'New chats only',
  },
  {
    key: 'memory.provider',
    label: 'Memory provider',
    description: 'Where Hermes stores and retrieves memory.',
    category: 'Privacy',
    type: 'select',
    options: ['built-in', 'honcho', 'mem0', 'off'],
    applies: 'New chats only',
  },
  {
    key: 'privacy.redact_pii',
    label: 'Redact platform personal data',
    description: 'Hide phone numbers and platform IDs before gateway messages reach the model.',
    category: 'Privacy',
    type: 'boolean',
    applies: 'Gateway restart',
  },
  {
    key: 'security.redact_secrets',
    label: 'Redact secrets in tool output',
    description: 'Mask strings that look like API keys or tokens before they enter the chat.',
    category: 'Safety',
    type: 'boolean',
    applies: 'Restart Hermes',
  },
  {
    key: 'security.tirith_enabled',
    label: 'Command safety checks',
    description: 'Ask Tirith to scan risky shell commands before Hermes runs them.',
    category: 'Safety',
    type: 'boolean',
    applies: 'New chats only',
  },
  {
    key: 'approvals.mode',
    label: 'Command approval mode',
    description: 'Choose when Hermes asks before running risky shell commands.',
    category: 'Safety',
    type: 'select',
    options: ['manual', 'smart', 'off'],
    applies: 'New chats only',
  },
  {
    key: 'checkpoints.enabled',
    label: 'File checkpoints',
    description: 'Keep rollback snapshots before file-changing work.',
    category: 'Safety',
    type: 'boolean',
    applies: 'New chats only',
  },
  {
    key: 'stt.enabled',
    label: 'Voice input',
    description: 'Allow voice messages to be transcribed into text.',
    category: 'Voice',
    type: 'boolean',
    applies: 'Gateway restart',
  },
  {
    key: 'stt.provider',
    label: 'Voice input provider',
    description: 'The transcription service Hermes uses for voice messages.',
    category: 'Voice',
    type: 'select',
    options: ['local', 'groq', 'openai', 'mistral'],
    applies: 'Gateway restart',
  },
  {
    key: 'tts.provider',
    label: 'Voice reply provider',
    description: 'The text-to-speech service Hermes uses when voice replies are on.',
    category: 'Voice',
    type: 'select',
    options: ['edge', 'elevenlabs', 'openai', 'minimax', 'mistral', 'neutts', 'piper'],
    applies: 'Gateway restart',
  },
  {
    key: 'voice.auto_tts',
    label: 'Auto voice replies',
    description: 'Read Hermes replies aloud when voice mode is active.',
    category: 'Voice',
    type: 'boolean',
    applies: 'Gateway restart',
  },
  {
    key: 'voice.beep_enabled',
    label: 'Recording beep',
    description: 'Play a small sound when recording starts or stops.',
    category: 'Voice',
    type: 'boolean',
    applies: 'Next launch',
  },
];

function fileExists(path: string): boolean {
  return existsSync(/* turbopackIgnore: true */ path);
}

function readBytes(path: string): Buffer {
  return readFileSync(/* turbopackIgnore: true */ path);
}

function readText(path: string): string {
  if (!fileExists(path)) return '';
  return readFileSync(/* turbopackIgnore: true */ path, 'utf8');
}

function writeBytes(path: string, content: Buffer): void {
  writeFileSync(/* turbopackIgnore: true */ path, content);
}

function writeText(path: string, content: string): void {
  writeFileSync(/* turbopackIgnore: true */ path, content, 'utf8');
}

function ensureParentDirectory(path: string): void {
  mkdirSync(/* turbopackIgnore: true */ dirname(path), { recursive: true });
}

async function run(command: string, args: string[], timeout = 12_000): Promise<{ ok: boolean; output: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      timeout,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, HERMES_HOME },
    });
    return { ok: true, output: `${stdout}${stderr}`.trim() };
  } catch (error) {
    const e = error as Error & { stdout?: string; stderr?: string };
    return { ok: false, output: `${e.stdout ?? ''}${e.stderr ?? ''}${e.message ? `\n${e.message}` : ''}`.trim() };
  }
}

function redactEnv(raw: string) {
  return raw
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith('#'))
    .map((line) => {
      const idx = line.indexOf('=');
      if (idx === -1) return { key: line.trim(), present: true, preview: 'set' };
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      return {
        key,
        present: value.length > 0,
        preview: value.length ? `${value.slice(0, 2)}••••${value.slice(-2)}` : '',
      };
    });
}

function pickConfigLines(raw: string, patterns: RegExp[]) {
  const lines = raw.split(/\r?\n/);
  return lines
    .map((line, idx) => ({ line: idx + 1, text: line }))
    .filter((entry) => patterns.some((pattern) => pattern.test(entry.text)));
}

function parseScalar(raw: string): SettingValue | null {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const withoutComment = trimmed.replace(/\s+#.*$/, '').trim();
  if (withoutComment === 'true') return true;
  if (withoutComment === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(withoutComment)) return Number(withoutComment);
  if ((withoutComment.startsWith('"') && withoutComment.endsWith('"')) || (withoutComment.startsWith("'") && withoutComment.endsWith("'"))) {
    return withoutComment.slice(1, -1);
  }
  return withoutComment;
}

function getConfigValue(raw: string, dottedKey: string): SettingValue | null {
  const wanted = dottedKey.split('.');
  const path: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const match = line.match(/^(\s*)([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
    if (!match) continue;
    const indent = match[1].length;
    const depth = Math.floor(indent / 2);
    path.length = depth;
    path[depth] = match[2];
    const valuePart = match[3] ?? '';
    if (path.slice(0, wanted.length).join('.') === dottedKey && path.length === wanted.length) {
      return parseScalar(valuePart);
    }
  }
  return null;
}

function normaliseValue(definition: QuickSetting, input: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (definition.type === 'boolean') {
    if (typeof input !== 'boolean') return { ok: false, error: `${definition.label} must be on or off.` };
    return { ok: true, value: input ? 'true' : 'false' };
  }

  if (definition.type === 'number') {
    const numeric = typeof input === 'number' ? input : typeof input === 'string' ? Number(input) : Number.NaN;
    if (!Number.isFinite(numeric)) return { ok: false, error: `${definition.label} must be a number.` };
    if (definition.min !== undefined && numeric < definition.min) return { ok: false, error: `${definition.label} must be at least ${definition.min}.` };
    if (definition.max !== undefined && numeric > definition.max) return { ok: false, error: `${definition.label} must be ${definition.max} or lower.` };
    return { ok: true, value: String(numeric) };
  }

  if (definition.type === 'select') {
    if (typeof input !== 'string') return { ok: false, error: `${definition.label} must be one of the listed options.` };
    if (!definition.options?.includes(input)) return { ok: false, error: `${input} is not allowed for ${definition.label}.` };
    return { ok: true, value: input };
  }

  if (typeof input !== 'string') return { ok: false, error: `${definition.label} must be text.` };
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: `${definition.label} cannot be empty.` };
  if (trimmed.length > 180) return { ok: false, error: `${definition.label} is too long.` };
  return { ok: true, value: trimmed };
}

function getQuickSettings(configText: string) {
  return QUICK_SETTINGS.map((definition) => ({
    ...definition,
    value: getConfigValue(configText, definition.key),
  }));
}

export async function GET() {
  const [version, configPath, envPath, tools] = await Promise.all([
    run('hermes', ['--version']),
    run('hermes', ['config', 'path']),
    run('hermes', ['config', 'env-path']),
    run('hermes', ['tools', 'list'], 20_000),
  ]);

  const configText = readText(CONFIG_PATH);
  const envText = readText(ENV_PATH);

  return NextResponse.json({
    ok: true,
    fetchedAt: new Date().toISOString(),
    paths: {
      hermesHome: HERMES_HOME,
      config: configPath.ok && configPath.output ? configPath.output.split('\n')[0] : CONFIG_PATH,
      env: envPath.ok && envPath.output ? envPath.output.split('\n')[0] : ENV_PATH,
      stateDb: STATE_DB_PATH,
      media: MEDIA_PATH,
    },
    runtime: {
      version: version.output,
      updateAvailable: /update available/i.test(version.output),
      tools: tools.output,
      toolsOk: tools.ok,
    },
    quickSettings: getQuickSettings(configText),
    config: {
      content: configText,
      bytes: Buffer.byteLength(configText),
      highlights: {
        providers: pickConfigLines(configText, [/provider/i, /model/i, /openrouter/i, /anthropic/i, /openai/i]),
        gateway: pickConfigLines(configText, [/gateway/i, /telegram/i, /discord/i, /api_server/i, /server/i]),
        memory: pickConfigLines(configText, [/honcho/i, /memory/i, /mempalace/i, /session/i]),
        tools: pickConfigLines(configText, [/tool/i, /mcp/i, /plugin/i, /skill/i]),
        voice: pickConfigLines(configText, [/tts/i, /voice/i, /audio/i]),
      },
    },
    env: {
      path: ENV_PATH,
      keys: redactEnv(envText),
      note: 'Secrets are hidden. Edit secret values from the terminal, not this screen.',
    },
  }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'The settings request was not valid JSON.' }, { status: 400 });
  }

  const { action, content, command, key, value } = body as {
    action?: string;
    content?: unknown;
    command?: unknown;
    key?: unknown;
    value?: unknown;
  };

  if (action === 'run-diagnostic') {
    if (typeof command !== 'string' || !SAFE_ACTIONS[command]) {
      return NextResponse.json({ ok: false, error: 'That check is not available from this screen.' }, { status: 400 });
    }
    const spec = SAFE_ACTIONS[command];
    const result = await run('hermes', spec.args, spec.timeout);
    return NextResponse.json({
      ok: result.ok,
      command,
      label: spec.label,
      output: result.output,
      finishedAt: new Date().toISOString(),
    }, { status: result.ok ? 200 : 500 });
  }

  if (action === 'set-config-key') {
    if (typeof key !== 'string') {
      return NextResponse.json({ ok: false, error: 'Missing setting name.' }, { status: 400 });
    }
    const definition = QUICK_SETTINGS.find((item) => item.key === key);
    if (!definition) {
      return NextResponse.json({ ok: false, error: 'This setting is not editable from the simple settings screen yet.' }, { status: 400 });
    }
    const normalised = normaliseValue(definition, value);
    if (!normalised.ok) {
      return NextResponse.json({ ok: false, error: normalised.error }, { status: 400 });
    }

    ensureParentDirectory(CONFIG_PATH);
    const backupPath = `${CONFIG_PATH}.signal-loom-${new Date().toISOString().replace(/[:.]/g, '-')}.bak`;
    if (fileExists(CONFIG_PATH)) {
      writeBytes(backupPath, readBytes(CONFIG_PATH));
    }

    const result = await run('hermes', ['config', 'set', key, normalised.value], 30_000);
    if (!result.ok) {
      if (fileExists(backupPath)) writeBytes(CONFIG_PATH, readBytes(backupPath));
      return NextResponse.json({ ok: false, error: result.output || 'Hermes could not save that setting.', backupPath }, { status: 400 });
    }

    const validation = await run('hermes', ['config', 'check'], 30_000);
    if (!validation.ok) {
      if (fileExists(backupPath)) writeBytes(CONFIG_PATH, readBytes(backupPath));
      return NextResponse.json({
        ok: false,
        error: 'That change made the config invalid, so Signal Loom restored the previous config.',
        backupPath,
        validation,
      }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      key,
      value: normalised.value,
      savedAt: new Date().toISOString(),
      path: CONFIG_PATH,
      backupPath,
      validation,
    });
  }

  if (action !== 'save-config') {
    return NextResponse.json({ ok: false, error: 'That settings action is not supported.' }, { status: 400 });
  }
  if (typeof content !== 'string') {
    return NextResponse.json({ ok: false, error: 'Config content must be text.' }, { status: 400 });
  }
  if (Buffer.byteLength(content) > MAX_CONFIG_BYTES) {
    return NextResponse.json({ ok: false, error: `Config too large; max ${MAX_CONFIG_BYTES} bytes.` }, { status: 413 });
  }
  if (content.includes('\0')) {
    return NextResponse.json({ ok: false, error: 'Config contains an invalid NUL byte.' }, { status: 400 });
  }

  ensureParentDirectory(CONFIG_PATH);
  const backupPath = `${CONFIG_PATH}.signal-loom-${new Date().toISOString().replace(/[:.]/g, '-')}.bak`;
  if (fileExists(CONFIG_PATH)) {
    writeBytes(backupPath, readBytes(CONFIG_PATH));
  }
  writeText(CONFIG_PATH, content);

  const validation = await run('hermes', ['config', 'check'], 30_000);
  if (!validation.ok) {
    if (fileExists(backupPath)) {
      writeBytes(CONFIG_PATH, readBytes(backupPath));
    }
    return NextResponse.json({
      ok: false,
      error: 'The YAML did not pass Hermes config check, so Signal Loom restored the previous config.',
      backupPath,
      validation,
    }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    savedAt: new Date().toISOString(),
    path: CONFIG_PATH,
    backupPath,
    validation,
  });
}
