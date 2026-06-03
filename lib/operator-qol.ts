import { buildConnectionChips, getComposerConnectionGate, type ChipTone, type DetectionLike } from './status-truth.ts';
import type { Approval, DelegationEvent, Message, RuntimeState, Thread } from './types/index.ts';

export { buildConnectionChips, getComposerConnectionGate };

/** Operator-facing status check: terse enough for chips, explicit enough for trust/debug panels. */
export type OperatorCheck = {
  id: string;
  label: string;
  group: 'Local install' | 'API auth' | 'State DB' | 'Live stream' | 'Gateway';
  tone: ChipTone;
  detail: string;
};

export type ConnectionTruthSummary = {
  state: 'checking' | 'ready' | 'blocked' | 'degraded';
  primaryLabel: string;
  sendAllowed: boolean;
  okCount: number;
  totalCount: number;
  checks: OperatorCheck[];
  warnings: string[];
  nextActions: string[];
};

type RuntimeLike = Partial<RuntimeState>;

const GROUPS: Record<string, OperatorCheck['group']> = {
  cli: 'Local install',
  api: 'API auth',
  'state-db': 'State DB',
  runtime: 'Live stream',
  gateway: 'Gateway',
};

export function redactOperationalText(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s,;]+/gi, '$1[redacted]')
    .replace(/((?:api[_-]?key|token|secret|password|passwd)\s*[:=]\s*)['\"]?[^\s,&'\"]{6,}/gi, '$1[redacted]')
    .replace(/([?&](?:api[_-]?key|token|secret|password)=)[^&\s]+/gi, '$1[redacted]')
    .replace(/\b(?:sk|pk|ghp|github_pat|hf|xox[baprs])-[-_A-Za-z0-9]{12,}\b/g, '[redacted-token]');
}

export function buildConnectionTruthSummary({
  runtime,
  detection,
  liveConnected,
  loading = false,
}: {
  runtime: RuntimeLike;
  detection?: DetectionLike | null;
  liveConnected?: boolean;
  loading?: boolean;
}): ConnectionTruthSummary {
  const chips = buildConnectionChips({ runtime, detection, liveConnected });
  const checks = chips.map((chip) => ({
    ...chip,
    group: GROUPS[chip.id] ?? 'Gateway',
    detail: redactOperationalText(chip.detail),
  }));
  const okCount = checks.filter((chip) => chip.tone === 'ok').length;
  const firstDanger = checks.find((chip) => chip.tone === 'danger');
  const firstWarn = checks.find((chip) => chip.tone === 'warn');
  const gate = getComposerConnectionGate({ detection, loading });

  const warnings = checks
    .filter((chip) => chip.tone === 'warn' || chip.tone === 'danger')
    .map((chip) => `${chip.group}: ${chip.label}`);

  const nextActions: string[] = [];
  if (loading || !detection) {
    nextActions.push('Wait for the local Hermes probe to finish.');
  } else if (gate.blocked) {
    nextActions.push(gate.detail);
  } else if (detection.home?.stateDbExists === false || detection.status === 'state_db_missing') {
    nextActions.push('Sending is allowed; saved sessions will appear after Hermes records session state.');
  }
  if (!liveConnected) nextActions.push('Live events are offline; refresh or check /api/openclaw/live if the screen feels stale.');
  if (runtime.gateway !== 'healthy' || runtime.queue !== 'healthy' || runtime.heartbeatFreshness !== 'fresh') {
    nextActions.push('Open verification before trusting completion claims from this runtime snapshot.');
  }

  const state: ConnectionTruthSummary['state'] = loading || !detection
    ? 'checking'
    : gate.blocked || Boolean(firstDanger)
      ? 'blocked'
      : firstWarn
        ? 'degraded'
        : 'ready';

  const primaryLabel = state === 'checking'
    ? 'Checking Hermes'
    : state === 'ready'
      ? 'Hermes ready'
      : state === 'blocked'
        ? firstDanger?.label ?? gate.reason
        : firstWarn?.label ?? gate.reason;

  return {
    state,
    primaryLabel,
    sendAllowed: !gate.blocked,
    okCount,
    totalCount: checks.length,
    checks,
    warnings,
    nextActions: Array.from(new Set(nextActions.map(redactOperationalText).filter(Boolean))),
  };
}

export type SafetyLabelTone = 'ok' | 'warn' | 'danger' | 'neutral';
export type SafetyLabel = { label: string; tone: SafetyLabelTone; detail: string };

export function getApprovalSafetyLabel(approval: Pick<Approval, 'source' | 'status'>): SafetyLabel {
  const status = approval.status ?? 'pending';
  if (status !== 'pending') return { label: 'Unsynced decision', tone: 'warn', detail: 'Decision is recorded locally for operator audit; it is not a gateway sync acknowledgement.' };
  if (approval.source === 'gateway') return { label: 'Gateway synced', tone: 'ok', detail: 'Raised by the live gateway approval path.' };
  if (approval.source === 'mock') return { label: 'Dev mock', tone: 'neutral', detail: 'Development/demo data, not a live gateway request.' };
  return { label: 'Derived/local', tone: 'warn', detail: 'Inferred from local session data; verify before treating it as a live approval request.' };
}


export type ApprovalRiskProfile = {
  category: 'External action' | 'Local config' | 'Command/run' | 'Scheduling' | 'Content/review' | 'General decision';
  reversibility: 'hard to reverse' | 'reversible with care' | 'local only';
  operatorHint: string;
};

export function getApprovalRiskProfile(approval: Pick<Approval, 'title' | 'recommendation' | 'urgency' | 'source'>): ApprovalRiskProfile {
  const text = [approval.title, approval.recommendation].join(' ').toLowerCase();
  if (/post|publish|send|email|dm|linkedin|tweet|x\/twitter|external/.test(text)) {
    return { category: 'External action', reversibility: 'hard to reverse', operatorHint: 'Check audience, exact content, and whether this leaves the local machine.' };
  }
  if (/delete|remove|overwrite|config|env|token|credential|settings|firewall|auth/.test(text)) {
    return { category: 'Local config', reversibility: 'reversible with care', operatorHint: 'Confirm path, backup, and whether secrets or live config are touched.' };
  }
  if (/command|shell|terminal|build|deploy|install|update|script/.test(text)) {
    return { category: 'Command/run', reversibility: approval.urgency === 'high' ? 'reversible with care' : 'local only', operatorHint: 'Review exact command and side effects before approving.' };
  }
  if (/cron|schedule|watcher|recurring|alert/.test(text)) {
    return { category: 'Scheduling', reversibility: 'reversible with care', operatorHint: 'Confirm schedule, delivery target, and quiet/noise behavior.' };
  }
  if (/review|revise|approve|draft|copy|content/.test(text)) {
    return { category: 'Content/review', reversibility: 'local only', operatorHint: 'Low-risk if it only changes a draft. Public send still needs a separate gate.' };
  }
  return { category: 'General decision', reversibility: approval.source === 'gateway' ? 'reversible with care' : 'local only', operatorHint: 'Verify source and linked thread before treating this as live runtime intent.' };
}

export type SessionTriage = 'needs-you' | 'blocked' | 'running' | 'waiting-agent' | 'recent' | 'done' | 'hidden';

export type SessionIntelligence = {
  triage: SessionTriage;
  priority: number;
  labels: string[];
  searchableText: string;
  transcriptState: 'loaded' | 'partial' | 'missing' | 'unknown';
};

export function buildSessionIntelligence({
  thread,
  childCount = 0,
  hidden = false,
  transcriptMessageCount,
  transcriptPartial = false,
}: {
  thread: Thread;
  childCount?: number;
  hidden?: boolean;
  transcriptMessageCount?: number;
  transcriptPartial?: boolean;
}): SessionIntelligence {
  const labels: string[] = [];
  if (thread.hasApproval || thread.status === 'waiting_on_user') labels.push('needs review');
  if (childCount > 0) labels.push(`${childCount} child lane${childCount === 1 ? '' : 's'}`);
  if (thread.session?.shortId) labels.push(`session ${thread.session.shortId}`);
  if (thread.session?.tags?.length) labels.push(...thread.session.tags.slice(0, 3));
  if (thread.followed) labels.push('followed');
  if (hidden) labels.push('hidden');
  if (transcriptPartial) labels.push('partial transcript');
  else if (typeof transcriptMessageCount === 'number') labels.push(`${transcriptMessageCount} transcript messages`);

  const triage: SessionTriage = hidden
    ? 'hidden'
    : thread.hasApproval || thread.status === 'waiting_on_user'
      ? 'needs-you'
      : thread.status === 'blocked'
        ? 'blocked'
        : thread.status === 'active'
          ? 'running'
          : thread.status === 'waiting_on_nero' || thread.status === 'waiting_on_specialist'
            ? 'waiting-agent'
            : thread.status === 'done'
              ? 'done'
              : 'recent';

  const priority: Record<SessionTriage, number> = {
    'needs-you': 0,
    blocked: 1,
    running: 2,
    'waiting-agent': 3,
    recent: 4,
    done: 5,
    hidden: 6,
  };

  const transcriptState = transcriptPartial
    ? 'partial'
    : typeof transcriptMessageCount === 'number'
      ? transcriptMessageCount > 0 ? 'loaded' : 'missing'
      : 'unknown';

  const searchableText = [
    thread.title,
    thread.status,
    thread.id,
    thread.session?.id,
    thread.session?.shortId,
    thread.session?.preview,
    ...(thread.session?.tags ?? []),
    ...labels,
  ].filter(Boolean).join(' ').toLowerCase();

  return { triage, priority: priority[triage], labels, searchableText, transcriptState };
}

export type ContextChip = { id: string; label: string; tone: SafetyLabelTone; detail?: string };

export function buildContextChips({
  thread,
  childCount = 0,
  pendingApprovalCount = thread.hasApproval ? 1 : 0,
  transcriptState = 'unknown',
  hidden = false,
}: {
  thread: Thread;
  childCount?: number;
  pendingApprovalCount?: number;
  transcriptState?: SessionIntelligence['transcriptState'];
  hidden?: boolean;
}): ContextChip[] {
  const chips: ContextChip[] = [
    { id: 'status', label: thread.status.replaceAll('_', ' '), tone: thread.status === 'blocked' ? 'danger' : thread.status === 'done' ? 'ok' : 'neutral' },
  ];
  if (pendingApprovalCount > 0) chips.push({ id: 'approval', label: `${pendingApprovalCount} approval${pendingApprovalCount === 1 ? '' : 's'}`, tone: 'warn' });
  if (childCount > 0) chips.push({ id: 'children', label: `${childCount} child lane${childCount === 1 ? '' : 's'}`, tone: 'neutral' });
  if (thread.session?.parentSessionId) chips.push({ id: 'parent', label: 'child session', tone: 'neutral' });
  if (thread.session?.shortId) chips.push({ id: 'session', label: thread.session.shortId, tone: 'neutral' });
  if (transcriptState === 'partial') chips.push({ id: 'transcript-partial', label: 'partial transcript', tone: 'warn' });
  else if (transcriptState === 'loaded') chips.push({ id: 'transcript-loaded', label: 'transcript loaded', tone: 'ok' });
  if (hidden) chips.push({ id: 'hidden', label: 'tucked', tone: 'neutral' });
  return chips.slice(0, 6);
}

export type ToolReceipt = {
  id: string;
  messageId: string;
  kind: 'tool' | 'result' | 'operational';
  label: string;
  detail: string;
  status: 'ok' | 'error' | 'unknown';
};

export function extractToolReceipts(messages: Message[]): ToolReceipt[] {
  const receipts: ToolReceipt[] = [];
  for (const message of messages) {
    const lines = message.content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    lines.forEach((line, index) => {
      const tool = line.match(/^\[Tool:\s*([^\]]+)\]\s*(.*)$/i);
      const result = line.match(/^\[Result\]\s*(.*)$/i);
      const operational = line.match(/^(?:ran|created|updated|modified|deleted|wrote|read|searched|opened)\b(.{0,180})/i);
      if (tool) {
        receipts.push({ id: `${message.id}:tool:${index}`, messageId: message.id, kind: 'tool', label: tool[1], detail: redactOperationalText(tool[2] || 'Tool call started'), status: 'unknown' });
      } else if (result) {
        const detail = redactOperationalText(result[1] || 'Tool returned a result');
        receipts.push({ id: `${message.id}:result:${index}`, messageId: message.id, kind: 'result', label: 'Result', detail, status: /error|failed|exit\s+[1-9]/i.test(detail) ? 'error' : 'ok' });
      } else if (operational && message.role !== 'user') {
        receipts.push({ id: `${message.id}:op:${index}`, messageId: message.id, kind: 'operational', label: 'Operational note', detail: redactOperationalText(line.slice(0, 220)), status: /error|failed|blocked/i.test(line) ? 'error' : 'ok' });
      }
    });
  }
  return receipts;
}

export type ThreadHandoffInput = {
  thread: Thread;
  messages: Message[];
  approvals?: Approval[];
  delegationEvents?: DelegationEvent[];
  connection?: Pick<ConnectionTruthSummary, 'state' | 'primaryLabel' | 'sendAllowed' | 'warnings'>;
  childCount?: number;
  generatedAt?: string;
};

export function buildThreadHandoffReport(input: ThreadHandoffInput): { markdown: string; json: Record<string, unknown> } {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const pendingApprovals = (input.approvals ?? []).filter((approval) => approval.linkedThreadId === input.thread.id && (approval.status === undefined || approval.status === 'pending'));
  const receipts = extractToolReceipts(input.messages);
  const lastMessages = input.messages.slice(-6).map((message) => ({ role: message.role, at: message.timestamp, content: redactOperationalText(message.content).slice(0, 500) }));
  const events = (input.delegationEvents ?? []).filter((event) => event.threadId === input.thread.id);
  const childCount = input.childCount ?? input.thread.linkedChildren?.length ?? 0;
  const sessionId = input.thread.session?.id ?? input.thread.id;
  const nextAction = pendingApprovals.length > 0
    ? `Review ${pendingApprovals.length} pending approval${pendingApprovals.length === 1 ? '' : 's'}.`
    : input.thread.status === 'done'
      ? 'Verify outputs before archiving or handing over.'
      : 'Continue from the latest user/assistant turn and verify before claiming completion.';

  const json = {
    generatedAt,
    thread: {
      id: input.thread.id,
      title: input.thread.title,
      status: input.thread.status,
      sessionId,
      shortId: input.thread.session?.shortId,
      lastActive: input.thread.lastActive,
    },
    counts: {
      messages: input.messages.length,
      receipts: receipts.length,
      pendingApprovals: pendingApprovals.length,
      delegationEvents: events.length,
      childLanes: childCount,
    },
    connection: input.connection ?? null,
    pendingApprovals: pendingApprovals.map((approval) => ({ id: approval.id, title: approval.title, urgency: approval.urgency, source: approval.source ?? 'derived' })),
    delegationEvents: events.map((event) => ({ type: event.type, actor: event.actor, title: event.title, at: event.createdAt, children: event.childSessionIds ?? [] })),
    receipts: receipts.slice(-12),
    lastMessages,
    nextAction,
  };

  const markdown = [
    `# Signal Loom Handoff — ${input.thread.title}`,
    '',
    `Generated: ${generatedAt}`,
    '',
    '## Active State',
    `- Thread: ${input.thread.title}`,
    `- Status: ${input.thread.status}`,
    `- Session: ${input.thread.session?.shortId ?? sessionId}`,
    `- Messages available: ${input.messages.length}`,
    `- Child lanes: ${childCount}`,
    `- Pending approvals: ${pendingApprovals.length}`,
    `- Receipts detected: ${receipts.length}`,
    input.connection ? `- Connection: ${input.connection.primaryLabel} (${input.connection.sendAllowed ? 'send allowed' : 'send blocked'})` : '- Connection: not captured',
    '',
    '## Pending Approvals',
    ...(pendingApprovals.length ? pendingApprovals.map((approval) => `- ${approval.urgency.toUpperCase()} · ${approval.title} · ${approval.source ?? 'derived'}`) : ['- None']),
    '',
    '## Delegated / Related Work',
    ...(events.length ? events.map((event) => `- ${event.type} · ${event.actor}: ${event.title}${event.childSessionIds?.length ? ` (${event.childSessionIds.length} child)` : ''}`) : ['- None captured']),
    '',
    '## Latest Messages',
    ...(lastMessages.length ? lastMessages.map((message) => `- ${message.role}: ${message.content.replace(/\s+/g, ' ').slice(0, 220)}`) : ['- No transcript messages loaded']),
    '',
    '## Receipt Summary',
    ...(receipts.length ? receipts.slice(-12).map((receipt) => `- ${receipt.status.toUpperCase()} · ${receipt.kind}: ${receipt.label} — ${receipt.detail.slice(0, 180)}`) : ['- No tool receipts detected in loaded messages']),
    '',
    '## Next Operator Move',
    `- ${nextAction}`,
  ].join('\n');

  return { markdown, json };
}
