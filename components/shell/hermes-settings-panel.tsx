'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useSignalLoomStore } from '@/lib/store';
import { getStatusRowState } from '@/lib/status-truth';
import { cn } from '@/lib/utils';

type HighlightLine = { line: number; text: string };
type SettingValue = boolean | number | string;
type QuickSetting = {
  key: string;
  label: string;
  description: string;
  category: 'Model' | 'Chat' | 'Voice' | 'Privacy' | 'Safety' | 'Display';
  type: 'boolean' | 'select' | 'number' | 'text';
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  applies: string;
  value: SettingValue | null;
};

type RuntimeConfigIssue = {
  code: string;
  tone: 'warn' | 'danger';
  message: string;
};

type RuntimeConfigTruth = {
  api: {
    url: string;
    source: string;
    valid: boolean;
    loopback: boolean;
  };
  auth: {
    tokenPresent: boolean;
    tokenSource: string | null;
    acceptedSources: string[];
  };
  flags: {
    mockDataEnabled: boolean;
    installEnabled: boolean;
  };
  issues: RuntimeConfigIssue[];
};

type HermesSettingsPayload = {
  ok: boolean;
  fetchedAt: string;
  paths: Record<string, string>;
  runtime: { version: string; updateAvailable: boolean; tools: string; toolsOk: boolean };
  runtimeConfig: RuntimeConfigTruth;
  quickSettings: QuickSetting[];
  config: {
    content: string;
    bytes: number;
    highlights: Record<string, HighlightLine[]>;
  };
  env: { path: string; keys: Array<{ key: string; present: boolean; preview: string }>; note: string };
};

type HermesDetection = {
  ok: boolean;
  status: string;
  fetchedAt: string;
  binary?: { found: boolean; path?: string; version?: string };
  home?: {
    path: string;
    exists: boolean;
    configPath?: string;
    configExists: boolean;
    envPath?: string;
    envExists: boolean;
    stateDbPath?: string;
    stateDbExists: boolean;
  };
  api?: { url: string; reachable: boolean; authenticated?: boolean; error?: string };
  nextSteps?: Array<{ id: string; label: string; command?: string; risk: 'safe' | 'requires_permission' | 'manual_only' }>;
  error?: string;
};

type SettingsTab = 'home' | 'model' | 'chat' | 'voice' | 'privacy' | 'safety' | 'tools' | 'advanced' | 'update';
type DiagnosticCommand = 'doctor' | 'gateway' | 'memory' | 'mcp' | 'tools';

const TABS: Array<{ id: SettingsTab; label: string; hint: string }> = [
  { id: 'home', label: 'Connect', hint: 'install and status' },
  { id: 'model', label: 'Model', hint: 'default model and provider' },
  { id: 'chat', label: 'Chat display', hint: 'context, output, progress' },
  { id: 'voice', label: 'Voice', hint: 'speech in and out' },
  { id: 'privacy', label: 'Memory & privacy', hint: 'what Hermes remembers' },
  { id: 'safety', label: 'Safety', hint: 'approvals and rollback' },
  { id: 'tools', label: 'Tools', hint: 'toolsets and MCP status' },
  { id: 'advanced', label: 'Advanced YAML', hint: 'full config editor' },
  { id: 'update', label: 'Update', hint: 'approval-gated updater' },
];

const DIAGNOSTICS: Array<{ id: DiagnosticCommand; label: string; description: string }> = [
  { id: 'doctor', label: 'Check Hermes health', description: 'Runs hermes doctor. No settings are changed.' },
  { id: 'gateway', label: 'Check gateway', description: 'Shows whether Telegram/API delivery is running.' },
  { id: 'memory', label: 'Check memory', description: 'Shows which memory system is active.' },
  { id: 'mcp', label: 'List MCP servers', description: 'Shows connected external tool servers.' },
  { id: 'tools', label: 'List tools', description: 'Shows enabled and disabled toolsets.' },
];

const CATEGORY_INTRO: Record<QuickSetting['category'], string> = {
  Model: 'Choose the model service Hermes uses for new chats. If you change this, start a new chat to feel it.',
  Chat: 'Control how long Hermes can work and when old context is compressed.',
  Display: 'Tune what the terminal UI shows while Hermes is working.',
  Voice: 'Set up voice input and voice replies for gateway and CLI voice mode.',
  Privacy: 'Decide what Hermes can remember and what personal data gets hidden.',
  Safety: 'Keep risky commands, secrets, and file edits guarded.',
};

function valuesEqual(a: SettingValue | null | undefined, b: SettingValue | null | undefined) {
  if (typeof a === 'number' || typeof b === 'number') return Number(a) === Number(b);
  return String(a ?? '') === String(b ?? '');
}

function settingValueToText(value: SettingValue | null | undefined) {
  if (value === null || value === undefined || value === '') return 'Not set';
  if (typeof value === 'boolean') return value ? 'On' : 'Off';
  return String(value);
}

function StatCard({ label, value, tone = 'teal' }: { label: string; value: string; tone?: 'teal' | 'brass' | 'red' }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3 shadow-xl shadow-black/10">
      <div className={cn(
        'text-[10px] font-semibold uppercase tracking-[0.22em]',
        tone === 'teal' && 'text-signal-teal',
        tone === 'brass' && 'text-brass',
        tone === 'red' && 'text-signal-red'
      )}>
        {label}
      </div>
      <div className="mt-1 break-words font-mono text-xs leading-5 text-ivory-dim">{value || '—'}</div>
    </div>
  );
}

function RuntimeTruthPanel({ config }: { config: RuntimeConfigTruth }) {
  const healthTone = config.issues.some((issue) => issue.tone === 'danger')
    ? 'red'
    : config.issues.length > 0
      ? 'brass'
      : 'teal';
  const healthLabel = healthTone === 'red' ? 'Needs fix' : healthTone === 'brass' ? 'Review' : 'Aligned';

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brass">Runtime truth</p>
          <h3 className="mt-1 text-base font-semibold text-ivory">Detected Signal Loom configuration</h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-ash">
            One readout for the env values server routes will actually use. Tokens stay hidden; only source and presence are shown.
          </p>
        </div>
        <span className={cn(
          'rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em]',
          healthTone === 'teal' && 'border-signal-teal/30 text-signal-teal',
          healthTone === 'brass' && 'border-brass/30 text-brass',
          healthTone === 'red' && 'border-signal-red/30 text-signal-red'
        )}>
          {healthLabel}
        </span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <StatCard label="Hermes API" value={`${config.api.url} (${config.api.source})`} tone={config.api.valid && config.api.loopback ? 'teal' : 'brass'} />
        <StatCard label="API token" value={config.auth.tokenPresent ? `Set via ${config.auth.tokenSource}` : `Missing (${config.auth.acceptedSources.join(', ')})`} tone={config.auth.tokenPresent ? 'teal' : 'brass'} />
        <StatCard label="Local flags" value={`mock:${config.flags.mockDataEnabled ? 'on' : 'off'} · install:${config.flags.installEnabled ? 'on' : 'off'}`} tone={config.flags.installEnabled ? 'brass' : 'teal'} />
      </div>

      {config.issues.length > 0 ? (
        <div className="mt-4 grid gap-2">
          {config.issues.map((issue) => (
            <div key={issue.code} className={cn(
              'rounded-2xl border px-3 py-2 text-sm leading-6',
              issue.tone === 'danger' ? 'border-signal-red/20 bg-signal-red/10 text-signal-red' : 'border-brass/20 bg-brass/10 text-brass'
            )}>
              <span className="mr-2 font-mono text-[10px] uppercase tracking-[0.16em]">{issue.code.replace(/_/g, ' ')}</span>
              {issue.message}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-2xl border border-signal-teal/20 bg-signal-teal-glow px-3 py-2 text-sm leading-6 text-signal-teal">
          Runtime env sources are aligned for a local Hermes setup.
        </p>
      )}
    </section>
  );
}

function HighlightList({ title, lines, empty }: { title: string; lines?: HighlightLine[]; empty: string }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-black/15 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brass">{title}</h3>
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] text-ash">
          {lines?.length ?? 0} lines
        </span>
      </div>
      {lines && lines.length > 0 ? (
        <div className="max-h-72 space-y-1 overflow-auto pr-1">
          {lines.map((entry) => (
            <pre key={`${entry.line}-${entry.text}`} className="overflow-x-auto rounded-lg border border-white/5 bg-carbon/80 px-2.5 py-2 text-[11px] leading-5 text-ivory-dim">
              <span className="mr-3 text-ash">{entry.line}</span>{entry.text || ' '}
            </pre>
          ))}
        </div>
      ) : (
        <p className="text-sm leading-6 text-ash">{empty}</p>
      )}
    </section>
  );
}


function connectionLabel(status: string) {
  const labels: Record<string, string> = {
    ready: 'Ready',
    missing_binary: 'Hermes is not installed',
    installed_not_configured: 'Hermes needs setup',
    configured_api_missing: 'API server not configured',
    api_unreachable: 'API server is not reachable',
    state_db_missing: 'No saved sessions yet',
    needs_token: 'API token required',
    unknown_error: 'Detection failed',
  };
  return labels[status] ?? status.replace(/_/g, ' ');
}

function StatusRow({
  label,
  ok,
  detail,
  loading = false,
  loadingDetail,
}: {
  label: string;
  ok: boolean;
  detail?: string;
  loading?: boolean;
  loadingDetail?: string;
}) {
  const row = getStatusRowState({ label, ok, detail, loading, loadingDetail });
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-black/15 px-3 py-2 text-sm">
      <div className="min-w-0">
        <div className="font-semibold text-ivory-dim">{row.label}</div>
        {row.detail && <div className="mt-0.5 break-all font-mono text-[11px] leading-5 text-ash">{row.detail}</div>}
      </div>
      <span className={cn(
        'shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px]',
        row.tone === 'ok' && 'border-signal-teal/30 text-signal-teal',
        row.tone === 'warn' && 'border-brass/30 text-brass',
        row.tone === 'danger' && 'border-signal-red/30 text-signal-red',
        row.tone === 'neutral' && 'border-white/10 text-ash'
      )}>
        {row.badge}
      </span>
    </div>
  );
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold text-ivory-dim transition hover:border-signal-teal/30 hover:text-signal-teal"
    >
      {copied ? 'Copied' : label}
    </button>
  );
}

function HermesConnectOverview({ detection, loading, onRefresh }: { detection: HermesDetection | null; loading: boolean; onRefresh: () => void }) {
  const status = detection?.status ?? 'unknown_error';
  const ready = status === 'ready';
  return (
    <section className={cn(
      'rounded-3xl border p-5 shadow-2xl shadow-black/15',
      ready ? 'border-signal-teal/20 bg-signal-teal-glow' : 'border-brass/20 bg-[linear-gradient(135deg,rgba(201,160,58,0.10),rgba(61,201,196,0.04))]'
    )}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className={cn('text-[10px] font-semibold uppercase tracking-[0.24em]', ready ? 'text-signal-teal' : 'text-brass')}>Hermes connection</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-ivory">{loading ? 'Checking local Hermes…' : connectionLabel(status)}</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ivory-dim">
            Signal Loom is a local interface. It does not host an agent for you — it connects to the Hermes CLI, local API server, config, and session database on this machine.
          </p>
        </div>
        <button type="button" onClick={onRefresh} disabled={loading} className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-xs font-semibold text-ivory-dim transition hover:border-signal-teal/30 hover:text-signal-teal disabled:cursor-wait disabled:opacity-60">
          {loading ? 'Checking…' : 'Re-check'}
        </button>
      </div>

      <div className="mt-5 grid gap-2 lg:grid-cols-2">
        <StatusRow label="Hermes CLI" loading={loading} ok={Boolean(detection?.binary?.found)} loadingDetail="Checking binary…" detail={detection?.binary?.version ?? detection?.binary?.path ?? 'Run the install command below if this is missing.'} />
        <StatusRow label="Config file" loading={loading} ok={Boolean(detection?.home?.configExists)} loadingDetail="Checking config path…" detail={detection?.home?.configPath ?? 'No config path detected yet.'} />
        <StatusRow label="API server" loading={loading} ok={Boolean(detection?.api?.reachable && detection?.api?.authenticated !== false)} loadingDetail="Checking local API auth…" detail={detection?.api?.error ? `${detection.api.url} — ${detection.api.error}` : detection?.api?.url} />
        <StatusRow label="Session database" loading={loading} ok={Boolean(detection?.home?.stateDbExists)} loadingDetail="Checking state DB…" detail={detection?.home?.stateDbPath ?? 'A state DB appears after Hermes has stored sessions.'} />
      </div>

      {detection?.nextSteps && detection.nextSteps.length > 0 && (
        <div className="mt-5 rounded-2xl border border-white/10 bg-black/15 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h4 className="text-xs font-semibold uppercase tracking-[0.22em] text-brass">Next safe steps</h4>
            <span className="text-[10px] text-ash">copy commands manually; Signal Loom will not auto-install Hermes from the browser</span>
          </div>
          <div className="grid gap-2">
            {detection.nextSteps.map((step) => (
              <div key={step.id} className="rounded-xl border border-white/5 bg-carbon/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ivory-dim">{step.label}</span>
                  <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-ash">{step.risk.replace(/_/g, ' ')}</span>
                </div>
                {step.command && (
                  <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <pre className="overflow-x-auto rounded-lg border border-white/5 bg-black/25 px-3 py-2 font-mono text-[11px] leading-5 text-signal-teal">{step.command}</pre>
                    <CopyButton text={step.command} label="Copy command" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function SafeActions({
  runningDiagnostic,
  diagnosticOutput,
  onRun,
}: {
  runningDiagnostic: DiagnosticCommand | null;
  diagnosticOutput: string;
  onRun: (command: DiagnosticCommand) => void;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brass">Safe checks</p>
          <h3 className="mt-1 text-base font-semibold text-ivory">Check what is working</h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-ash">
            These buttons only read status. They do not edit config, restart services, send messages, or delete files.
          </p>
        </div>
        <span className="rounded-full border border-signal-teal/20 bg-signal-teal-glow px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-signal-teal">
          read-only
        </span>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-5">
        {DIAGNOSTICS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onRun(item.id)}
            disabled={runningDiagnostic !== null}
            className="rounded-2xl border border-white/10 bg-black/15 p-3 text-left transition hover:-translate-y-0.5 hover:border-signal-teal/30 hover:bg-signal-teal-glow disabled:cursor-wait disabled:opacity-55"
          >
            <span className="block text-xs font-semibold text-ivory">{runningDiagnostic === item.id ? 'Checking…' : item.label}</span>
            <span className="mt-1 block text-[10px] leading-4 text-ash">{item.description}</span>
          </button>
        ))}
      </div>
      {diagnosticOutput && (
        <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-carbon/90 p-3 text-[11px] leading-5 text-ivory-dim">
          {diagnosticOutput}
        </pre>
      )}
    </section>
  );
}

function SettingCard({
  setting,
  pendingValue,
  saving,
  onPendingChange,
  onCommit,
}: {
  setting: QuickSetting;
  pendingValue: SettingValue | null | undefined;
  saving: boolean;
  onPendingChange: (key: string, value: SettingValue) => void;
  onCommit: (key: string, value: SettingValue) => void;
}) {
  const currentValue = pendingValue ?? setting.value ?? (setting.type === 'boolean' ? false : '');
  const dirty = !valuesEqual(currentValue, setting.value);

  const control = (() => {
    if (setting.type === 'boolean') {
      const checked = currentValue === true || currentValue === 'true';
      return (
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={saving}
          onClick={() => onCommit(setting.key, !checked)}
          className={cn(
            'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition disabled:cursor-wait disabled:opacity-55',
            checked ? 'border-signal-teal/35 bg-signal-teal/20' : 'border-white/10 bg-white/[0.06]'
          )}
        >
          <span
            className={cn(
              'ml-1 h-5 w-5 rounded-full bg-ivory shadow-lg transition-transform',
              checked && 'translate-x-5 bg-signal-teal'
            )}
          />
        </button>
      );
    }

    if (setting.type === 'select') {
      const options = setting.options ?? [];
      const value = String(currentValue ?? '');
      const allOptions = options.includes(value) || !value ? options : [value, ...options];
      return (
        <select
          value={value}
          disabled={saving}
          onChange={(event) => onCommit(setting.key, event.currentTarget.value)}
          className="min-h-10 w-full rounded-xl border border-white/10 bg-carbon/80 px-3 py-2 text-sm text-ivory outline-none transition focus:border-signal-teal/40 disabled:cursor-wait disabled:opacity-55"
        >
          {allOptions.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      );
    }

    return (
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <input
          type={setting.type === 'number' ? 'number' : 'text'}
          min={setting.min}
          max={setting.max}
          step={setting.step}
          value={String(currentValue ?? '')}
          placeholder={setting.placeholder}
          disabled={saving}
          onChange={(event) => onPendingChange(setting.key, event.currentTarget.value)}
          className="min-h-10 w-full rounded-xl border border-white/10 bg-carbon/80 px-3 py-2 text-sm text-ivory outline-none transition placeholder:text-ash/60 focus:border-signal-teal/40 disabled:cursor-wait disabled:opacity-55"
        />
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={() => onCommit(setting.key, currentValue)}
          className="min-h-10 rounded-xl border border-signal-teal/25 bg-signal-teal-glow px-4 text-sm font-semibold text-signal-teal transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    );
  })();

  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-ivory">{setting.label}</h4>
            <span className="rounded-full border border-white/15 bg-black/35 px-2 py-0.5 text-[10px] font-semibold text-ivory-dim">
              {setting.applies}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-ash">{setting.description}</p>
          <p className="mt-2 font-mono text-[10px] text-ash/80">
            Current: <span className="text-ivory-dim">{settingValueToText(setting.value)}</span>
          </p>
        </div>
        <div className="min-w-[180px] max-w-full sm:w-64">{control}</div>
      </div>
    </article>
  );
}

function SettingsGroup({
  title,
  settings,
  pendingValues,
  savingKey,
  onPendingChange,
  onCommit,
}: {
  title: QuickSetting['category'];
  settings: QuickSetting[];
  pendingValues: Record<string, SettingValue>;
  savingKey: string | null;
  onPendingChange: (key: string, value: SettingValue) => void;
  onCommit: (key: string, value: SettingValue) => void;
}) {
  if (settings.length === 0) return null;
  return (
    <section className="space-y-3">
      <div className="rounded-3xl border border-white/10 bg-black/15 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brass">{title}</p>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-ivory-dim">{CATEGORY_INTRO[title]}</p>
      </div>
      <div className="grid gap-3">
        {settings.map((setting) => (
          <SettingCard
            key={setting.key}
            setting={setting}
            pendingValue={pendingValues[setting.key]}
            saving={savingKey === setting.key}
            onPendingChange={onPendingChange}
            onCommit={onCommit}
          />
        ))}
      </div>
    </section>
  );
}

export function HermesSettingsPanel() {
  const { hermesSettingsOpen, closeHermesSettings } = useSignalLoomStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('home');
  const [settings, setSettings] = useState<HermesSettingsPayload | null>(null);
  const [detection, setDetection] = useState<HermesDetection | null>(null);
  const [pendingValues, setPendingValues] = useState<Record<string, SettingValue>>({});
  const [configDraft, setConfigDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingDetection, setLoadingDetection] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [updateOutput, setUpdateOutput] = useState('');
  const [updateConfirmText, setUpdateConfirmText] = useState('');
  const [diagnosticOutput, setDiagnosticOutput] = useState('');
  const [runningDiagnostic, setRunningDiagnostic] = useState<DiagnosticCommand | null>(null);

  const dirty = settings ? configDraft !== settings.config.content : false;
  const updateArmed = updateConfirmText.trim().toLowerCase() === 'update hermes';

  const versionLines = useMemo(() => settings?.runtime.version.split('\n').filter(Boolean) ?? [], [settings]);
  const quickSettingsByCategory = useMemo(() => {
    const grouped = new Map<QuickSetting['category'], QuickSetting[]>();
    for (const item of settings?.quickSettings ?? []) {
      const list = grouped.get(item.category) ?? [];
      list.push(item);
      grouped.set(item.category, list);
    }
    return grouped;
  }, [settings]);


  const loadDetection = async () => {
    setLoadingDetection(true);
    try {
      const res = await fetch('/api/hermes/detect', { cache: 'no-store' });
      const payload = await res.json() as HermesDetection;
      setDetection(payload);
    } catch (error) {
      setDetection({
        ok: false,
        status: 'unknown_error',
        fetchedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Could not detect Hermes.',
      });
    } finally {
      setLoadingDetection(false);
    }
  };

  const loadSettings = async () => {
    setLoading(true);
    setNotice(null);
    try {
      const res = await fetch('/api/hermes/settings', { cache: 'no-store' });
      const payload = await res.json();
      if (!res.ok || !payload.ok) throw new Error(payload.error ?? 'Signal Loom could not load Hermes settings.');
      setSettings(payload);
      setConfigDraft(payload.config.content);
      setPendingValues(Object.fromEntries((payload.quickSettings ?? []).map((item: QuickSetting) => [item.key, item.value ?? ''])));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Signal Loom could not load Hermes settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hermesSettingsOpen) return;
    loadDetection();
    loadSettings();
  }, [hermesSettingsOpen]);

  useEffect(() => {
    if (!hermesSettingsOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeHermesSettings();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hermesSettingsOpen, closeHermesSettings]);

  const updatePendingValue = (key: string, value: SettingValue) => {
    setPendingValues((current) => ({ ...current, [key]: value }));
  };

  const saveSetting = async (key: string, value: SettingValue) => {
    setSavingKey(key);
    setNotice(null);
    setPendingValues((current) => ({ ...current, [key]: value }));
    try {
      const res = await fetch('/api/hermes/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-config-key', key, value }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok) throw new Error(payload.error ?? 'Signal Loom could not save that setting.');
      const label = settings?.quickSettings.find((item) => item.key === key)?.label ?? key;
      setNotice(`${label} saved. Some changes apply only after a new chat or gateway restart.`);
      await loadSettings();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Signal Loom could not save that setting.');
    } finally {
      setSavingKey(null);
    }
  };

  const runDiagnostic = async (command: DiagnosticCommand) => {
    setRunningDiagnostic(command);
    setNotice(null);
    try {
      const res = await fetch('/api/hermes/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run-diagnostic', command }),
      });
      const payload = await res.json();
      setDiagnosticOutput(`${payload.label ?? command}\n${payload.output ?? ''}`.trim());
      if (!res.ok || !payload.ok) throw new Error(payload.error ?? payload.output ?? 'That check failed.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'That check failed.');
    } finally {
      setRunningDiagnostic(null);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch('/api/hermes/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save-config', content: configDraft }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok) throw new Error(payload.error ?? 'Signal Loom could not save config.yaml.');
      setNotice(`Config saved. Backup created at ${payload.backupPath}.`);
      await loadSettings();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Signal Loom could not save config.yaml.');
    } finally {
      setSaving(false);
    }
  };

  const runUpdate = async () => {
    if (!updateArmed) {
      setNotice('Type “update hermes” first. This keeps accidental updates out of your click path.');
      return;
    }
    setUpdating(true);
    setNotice('Running hermes update. This can take a minute.');
    setUpdateOutput('');
    try {
      const res = await fetch('/api/hermes/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmUpdate: true }),
      });
      const payload = await res.json();
      setUpdateOutput(payload.output ?? '');
      if (!res.ok || !payload.ok) throw new Error(payload.output || 'Hermes update failed.');
      setNotice('Hermes update finished. Restart the gateway or open a new chat if the update changed runtime code.');
      await loadSettings();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Hermes update failed.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <AnimatePresence>
      {hermesSettingsOpen && (
        <div className="hermes-settings-layer" role="dialog" aria-modal="true" aria-label="Hermes settings">
          <motion.button
            type="button"
            aria-label="Close settings"
            className="hermes-settings-backdrop"
            onClick={closeHermesSettings}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.aside
            className="hermes-settings-panel"
            initial={{ opacity: 0, x: 42, scale: 0.985 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 42, scale: 0.985 }}
            transition={{ type: 'spring', stiffness: 360, damping: 34, mass: 0.8 }}
          >
            <div className="flex items-start gap-4 border-b border-white/10 p-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-signal-teal/25 bg-signal-teal-glow text-signal-teal shadow-[0_0_30px_rgba(61,201,196,0.12)]">
                ⚙
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-signal-teal">Settings</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-ivory">Change Hermes without editing YAML</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-ivory-dim">
                  Signal Loom is controlling your local Hermes agent. Use simple controls for common settings; the advanced editor is still here for anything that does not have a button yet.
                </p>
              </div>
              <button type="button" onClick={closeHermesSettings} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-ivory-dim transition hover:border-signal-red/30 hover:text-signal-red">
                Close
              </button>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-[220px_minmax(0,1fr)] overflow-hidden max-md:grid-cols-1">
              <nav className="space-y-1 overflow-auto border-r border-white/10 p-3 max-md:flex max-md:gap-2 max-md:border-b max-md:border-r-0" aria-label="Settings sections">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'w-full rounded-2xl border px-3 py-2.5 text-left transition-all duration-200 max-md:min-w-44',
                      activeTab === tab.id
                        ? 'border-signal-teal/35 bg-signal-teal-glow text-signal-teal shadow-[0_0_24px_rgba(61,201,196,0.10)]'
                        : 'border-white/5 bg-white/[0.02] text-ivory-dim hover:border-white/12 hover:bg-white/[0.04]'
                    )}
                  >
                    <span className="block text-xs font-semibold">{tab.label}</span>
                    <span className="mt-0.5 block text-[10px] text-ash">{tab.hint}</span>
                  </button>
                ))}
              </nav>

              <main className="min-h-0 overflow-auto p-5">
                {loading && !settings && (
                  <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-8 text-center text-ivory-dim">
                    <span className="animate-pulse text-signal-teal">◷</span> Loading settings…
                  </div>
                )}

                {notice && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 rounded-2xl border border-brass/20 bg-brass/10 px-4 py-3 text-sm leading-6 text-brass"
                  >
                    {notice}
                  </motion.div>
                )}

                {activeTab === 'home' && (
                  <div className="space-y-4">
                    <HermesConnectOverview detection={detection} loading={loadingDetection} onRefresh={() => { loadDetection(); loadSettings(); }} />
                    {settings && (
                      <>
                        <div className="grid gap-3 md:grid-cols-3">
                          <StatCard label="Version" value={versionLines[0] ?? 'Hermes'} tone={settings.runtime.updateAvailable ? 'brass' : 'teal'} />
                          <StatCard label="Config file" value={`${settings.config.bytes.toLocaleString()} bytes`} />
                          <StatCard label="Update status" value={settings.runtime.updateAvailable ? 'Update available' : 'Up to date'} tone={settings.runtime.updateAvailable ? 'brass' : 'teal'} />
                        </div>
                        <RuntimeTruthPanel config={settings.runtimeConfig} />
                        <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
                          <h3 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brass">Where files live</h3>
                          <p className="mt-1 text-sm leading-6 text-ash">Signal Loom reads these paths so you do not have to remember them.</p>
                          <div className="mt-3 grid gap-2">
                            {Object.entries(settings.paths).map(([key, value]) => (
                              <div key={key} className="grid grid-cols-[120px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-white/5 bg-black/15 px-3 py-2 text-xs">
                                <span className="font-semibold uppercase tracking-[0.16em] text-ash">{key}</span>
                                <span className="break-all font-mono text-ivory-dim">{value}</span>
                                <CopyButton text={value} label="Copy path" />
                              </div>
                            ))}
                          </div>
                        </section>
                        <SafeActions runningDiagnostic={runningDiagnostic} diagnosticOutput={diagnosticOutput} onRun={runDiagnostic} />
                      </>
                    )}
                  </div>
                )}

                {settings && activeTab === 'model' && (
                  <div className="space-y-4">
                    <SettingsGroup title="Model" settings={quickSettingsByCategory.get('Model') ?? []} pendingValues={pendingValues} savingKey={savingKey} onPendingChange={updatePendingValue} onCommit={saveSetting} />
                    <HighlightList title="Model lines from config.yaml" lines={settings.config.highlights.providers} empty="No model/provider lines found. Use Advanced YAML if this config is unusual." />
                    <section className="rounded-2xl border border-white/10 bg-black/15 p-3">
                      <h3 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brass">API keys</h3>
                      <p className="mt-1 text-xs leading-5 text-ash">Secret values are hidden here. This screen shows whether each key exists, not the key itself.</p>
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        {settings.env.keys.map((item) => (
                          <div key={item.key} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-carbon/70 px-3 py-2 text-xs">
                            <span className="font-mono text-ivory-dim">{item.key}</span>
                            <span className={item.present ? 'text-signal-teal' : 'text-ash'}>{item.preview || 'empty'}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                )}

                {settings && activeTab === 'chat' && (
                  <div className="space-y-5">
                    <SettingsGroup title="Chat" settings={quickSettingsByCategory.get('Chat') ?? []} pendingValues={pendingValues} savingKey={savingKey} onPendingChange={updatePendingValue} onCommit={saveSetting} />
                    <SettingsGroup title="Display" settings={quickSettingsByCategory.get('Display') ?? []} pendingValues={pendingValues} savingKey={savingKey} onPendingChange={updatePendingValue} onCommit={saveSetting} />
                  </div>
                )}

                {settings && activeTab === 'voice' && (
                  <div className="space-y-4">
                    <SettingsGroup title="Voice" settings={quickSettingsByCategory.get('Voice') ?? []} pendingValues={pendingValues} savingKey={savingKey} onPendingChange={updatePendingValue} onCommit={saveSetting} />
                    <HighlightList title="Voice lines from config.yaml" lines={settings.config.highlights.voice} empty="No voice settings found in config highlights." />
                  </div>
                )}

                {settings && activeTab === 'privacy' && (
                  <div className="space-y-4">
                    <SettingsGroup title="Privacy" settings={quickSettingsByCategory.get('Privacy') ?? []} pendingValues={pendingValues} savingKey={savingKey} onPendingChange={updatePendingValue} onCommit={saveSetting} />
                    <div className="grid gap-3 md:grid-cols-2">
                      <StatCard label="Session database" value={settings.paths.stateDb} tone="brass" />
                      <StatCard label="Media cache" value={settings.paths.media} tone="teal" />
                    </div>
                    <HighlightList title="Memory lines from config.yaml" lines={settings.config.highlights.memory} empty="No memory lines found in config highlights." />
                  </div>
                )}

                {settings && activeTab === 'safety' && (
                  <div className="space-y-4">
                    <SettingsGroup title="Safety" settings={quickSettingsByCategory.get('Safety') ?? []} pendingValues={pendingValues} savingKey={savingKey} onPendingChange={updatePendingValue} onCommit={saveSetting} />
                    <section className="rounded-3xl border border-brass/20 bg-brass/10 p-4 text-sm leading-6 text-brass">
                      Changes that affect security, secret redaction, or gateway privacy may need a new Hermes session or gateway restart. Signal Loom saves a backup before each change.
                    </section>
                  </div>
                )}

                {settings && activeTab === 'tools' && (
                  <div className="space-y-4">
                    <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brass">Tools</p>
                      <h3 className="mt-1 text-base font-semibold text-ivory">What Hermes can use</h3>
                      <p className="mt-1 max-w-2xl text-sm leading-6 text-ash">
                        This tab is read-only for now because tool enablement is platform-specific. Use the check below to see the active toolsets, then use Hermes tools if you need to change them.
                      </p>
                    </section>
                    <HighlightList title="Tools, MCP, and skill lines" lines={settings.config.highlights.tools} empty="No tool lines detected in config highlights." />
                    <section className="rounded-2xl border border-white/10 bg-black/15 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brass">hermes tools list</h3>
                        <span className={settings.runtime.toolsOk ? 'text-xs text-signal-teal' : 'text-xs text-signal-red'}>{settings.runtime.toolsOk ? 'loaded' : 'error'}</span>
                      </div>
                      <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border border-white/5 bg-carbon/80 p-3 text-[11px] leading-5 text-ivory-dim">{settings.runtime.tools || 'No tool output.'}</pre>
                    </section>
                  </div>
                )}

                {settings && activeTab === 'advanced' && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-3">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brass">Advanced config.yaml editor</div>
                        <p className="mt-1 text-xs text-ash">Use this only when the setting you need is not listed above. Signal Loom validates the YAML and restores the backup if Hermes rejects it.</p>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setConfigDraft(settings.config.content)} disabled={!dirty || saving} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-ivory-dim disabled:opacity-40">Reset edits</button>
                        <button type="button" onClick={saveConfig} disabled={!dirty || saving} className="rounded-full border border-signal-teal/30 bg-signal-teal-glow px-3 py-1.5 text-xs font-semibold text-signal-teal disabled:opacity-40">
                          {saving ? 'Saving…' : 'Save YAML'}
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={configDraft}
                      onChange={(e) => setConfigDraft(e.target.value)}
                      spellCheck={false}
                      className="min-h-[55vh] w-full resize-none rounded-2xl border border-white/10 bg-carbon/90 p-4 font-mono text-xs leading-6 text-ivory outline-none transition focus:border-signal-teal/40"
                    />
                  </div>
                )}

                {settings && activeTab === 'update' && (
                  <div className="space-y-4">
                    <section className="rounded-3xl border border-brass/20 bg-[linear-gradient(135deg,rgba(201,160,58,0.10),rgba(61,201,196,0.04))] p-5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brass">Hermes update</p>
                      <h3 className="mt-2 text-lg font-semibold text-ivory">Update the local Hermes install</h3>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-ivory-dim">
                        This runs <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-xs text-brass">hermes update</code>. It can change the active agent code, so Signal Loom requires the exact phrase below before running it.
                      </p>
                      <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-black/15 p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                        <label className="block">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ash">Type update hermes to unlock</span>
                          <input
                            value={updateConfirmText}
                            onChange={(e) => setUpdateConfirmText(e.target.value)}
                            placeholder="update hermes"
                            className="mt-2 w-full rounded-xl border border-white/10 bg-carbon/80 px-3 py-2 font-mono text-xs text-ivory outline-none transition placeholder:text-ash/60 focus:border-brass/40"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={runUpdate}
                          disabled={updating || !updateArmed}
                          className="inline-flex items-center justify-center gap-2 rounded-full border border-brass/30 bg-brass-dim px-4 py-2 text-sm font-semibold text-brass transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          <span className={updating ? 'animate-spin' : ''}>◷</span>
                          {updating ? 'Updating…' : settings.runtime.updateAvailable ? 'Update now' : 'Check anyway'}
                        </button>
                      </div>
                    </section>
                    <pre className="min-h-44 max-h-96 overflow-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/25 p-4 text-xs leading-6 text-ivory-dim">{updateOutput || settings.runtime.version}</pre>
                  </div>
                )}
              </main>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
