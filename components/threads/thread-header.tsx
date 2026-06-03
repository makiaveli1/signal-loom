'use client';

import { useState } from 'react';
import type { Thread } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { useSignalLoomStore } from '@/lib/store';

const STATUS_LABELS: Record<Thread['status'], string> = {
  active: 'Active',
  waiting_on_nero: 'Waiting on Agent',
  waiting_on_specialist: 'Waiting on Specialist',
  waiting_on_user: 'Waiting on You',
  blocked: 'Blocked',
  done: 'Done',
};

const STATUS_COLORS: Record<Thread['status'], string> = {
  active: 'var(--mb-teal)',
  waiting_on_nero: 'var(--mb-red)',
  waiting_on_specialist: 'var(--mb-brass)',
  waiting_on_user: 'var(--mb-violet)',
  blocked: 'var(--mb-rust)',
  done: 'var(--mb-jade)',
};

export function ThreadHeader({
  thread,
  delegationCount,
  onOpenChildSession,
  dashboardCollapsed,
  onToggleDashboard,
}: {
  thread: Thread;
  delegationCount?: number;
  onOpenChildSession?: (childId: string) => void;
  dashboardCollapsed?: boolean;
  onToggleDashboard?: () => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [copiedResume, setCopiedResume] = useState(false);

  const { childToParentMap, threads } = useSignalLoomStore();
  const parentSessionId = childToParentMap[thread.id];
  const parentThread = parentSessionId ? threads.find((t) => t.id === parentSessionId) : null;
  const statusColor = STATUS_COLORS[thread.status];
  const resumeCommand = thread.session?.id ? 'hermes --resume ' + thread.session.id : null;
  const copyResumeCommand = async () => {
    if (!resumeCommand) return;
    await navigator.clipboard.writeText(resumeCommand);
    setCopiedResume(true);
    window.setTimeout(() => setCopiedResume(false), 1300);
  };

  const hasDelegation = (delegationCount ?? 0) > 0;
  const hasLinkedAgents = thread.linkedAgents.length > 0;
  const hasApproval = thread.hasApproval;
  const hasParent = !!parentThread;
  const detailCount = Number(hasLinkedAgents) + Number(hasDelegation) + Number(hasParent) + Number(hasApproval);

  return (
    <div
      className="thread-focus-header flex flex-col"
      style={{
        background: 'color-mix(in srgb, var(--sl-shell) 86%, transparent)',
        borderBottom: '1px solid var(--sl-border-soft)',
      }}
    >
      <div className="flex min-h-[3rem] items-center justify-between gap-3 px-4 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
            style={{ background: statusColor, boxShadow: `0 0 14px ${statusColor}42` }}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold tracking-[-0.01em] text-ivory">
              {thread.title}
            </h1>
            <div className="mt-0.5 flex min-w-0 items-center gap-2 text-[11px] text-ash">
              <span className="font-mono" style={{ color: statusColor }}>{STATUS_LABELS[thread.status]}</span>
              {hasApproval && <span className="text-brass">· approval waiting</span>}
            </div>
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          {onToggleDashboard && (
            <button
              type="button"
              onClick={onToggleDashboard}
              className="thread-focus-button hidden min-h-11 items-center gap-2 rounded-[var(--sl-radius-control)] border px-3 text-[11px] font-mono text-ash transition-colors hover:text-ivory md:flex"
              style={{ borderColor: 'var(--sl-border-soft)', background: 'var(--sl-control)' }}
              aria-pressed={dashboardCollapsed}
              aria-label={dashboardCollapsed ? 'Restore chat dashboard' : 'Collapse dashboard and focus chat'}
              title={dashboardCollapsed ? 'Restore dashboard' : 'Collapse dashboard — give the chat the whole pane'}
            >
              <span aria-hidden="true">{dashboardCollapsed ? '▤' : '⛶'}</span>
              <span>Focus chat</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setDetailsOpen((v) => !v)}
            className="thread-details-button flex min-h-11 flex-shrink-0 items-center gap-2 rounded-[var(--sl-radius-control)] border px-3 text-[11px] font-mono text-ash transition-colors hover:text-ivory"
            style={{ borderColor: 'var(--sl-border-soft)', background: 'var(--sl-control)' }}
            aria-expanded={detailsOpen}
            aria-label={detailsOpen ? 'Hide thread details' : 'Show thread details'}
          >
            <span className="thread-details-label">Details</span>
            <span className="thread-details-mark" aria-hidden="true">i</span>
            {detailCount > 0 && <span className="thread-details-count text-brass">{detailCount}</span>}
          </button>
        </div>
      </div>

      {detailsOpen && (
        <div className="flex flex-wrap items-center gap-2 border-t px-4 py-2" style={{ borderColor: 'var(--sl-border-soft)' }}>
          <Badge
            variant="outline"
            className="flex-shrink-0 text-xs font-mono"
            style={{
              borderColor: `${statusColor}40`,
              color: statusColor,
              background: `${statusColor}10`,
            }}
          >
            {STATUS_LABELS[thread.status]}
          </Badge>

          {hasLinkedAgents && thread.linkedAgents.map((agentId) => (
            <AgentChip key={agentId} agentId={agentId} />
          ))}

          {hasDelegation && (
            onOpenChildSession ? (
              <button
                type="button"
                onClick={() => {
                  const firstChildId = thread.linkedChildren?.[0];
                  if (firstChildId) onOpenChildSession(firstChildId);
                }}
                title="Open first child session"
                className="cursor-pointer rounded-[var(--sl-radius-control)] border px-2 py-1 text-xs font-mono transition-all duration-100 hover:opacity-80 active:scale-95"
                style={{
                  borderColor: 'rgba(155,141,200,0.3)',
                  color: '#9b8dc8',
                  background: 'rgba(155,141,200,0.08)',
                }}
              >
                Open {delegationCount} delegated lane{delegationCount !== 1 ? 's' : ''}
              </button>
            ) : (
              <span
                className="rounded-[var(--sl-radius-control)] border px-2 py-1 text-xs font-mono"
                style={{
                  borderColor: 'rgba(155,141,200,0.3)',
                  color: '#9b8dc8',
                  background: 'rgba(155,141,200,0.08)',
                }}
              >
                {delegationCount} delegated lane{delegationCount !== 1 ? 's' : ''}
              </span>
            )
          )}

          {resumeCommand && (
            <button
              type="button"
              onClick={copyResumeCommand}
              className="cursor-pointer rounded-[var(--sl-radius-control)] border px-2 py-1 text-xs font-mono transition-all duration-100 hover:opacity-80 active:scale-95"
              style={{ borderColor: 'var(--sl-rule-visible)', color: 'var(--mb-ivory-dim)', background: 'var(--sl-control)' }}
              title={resumeCommand}
            >
              {copiedResume ? 'Copied resume command' : 'Copy resume command'}
            </button>
          )}

          {hasParent && (
            <span
              className="rounded-[var(--sl-radius-control)] border px-2 py-1 text-xs font-mono"
              style={{
                borderColor: 'rgba(58,184,200,0.3)',
                color: '#3ab8c8',
                background: 'rgba(58,184,200,0.08)',
              }}
              title={`Spawned from: ${parentThread.title}`}
            >
              Parent: {parentThread.title.length > 42 ? parentThread.title.slice(0, 42) + '…' : parentThread.title}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

const AGENT_NAMES: Record<string, string> = {
  hephaestus: 'Hephaestus',
  argus: 'Argus',
  ariadne: 'Ariadne',
  orion: 'Orion',
  hermes: 'Hermes',
};

const AGENT_COLORS: Record<string, string> = {
  hephaestus: '#e8733a',
  argus: '#c9943a',
  ariadne: '#9b8dc8',
  orion: '#3ab8c8',
  hermes: '#e8a04a',
};

function AgentChip({ agentId }: { agentId: string }) {
  const name = AGENT_NAMES[agentId] ?? agentId;
  const color = AGENT_COLORS[agentId] ?? 'var(--mb-ash)';

  return (
    <span
      className="rounded-[var(--sl-radius-control)] border px-2 py-0.5 text-xs font-mono"
      style={{
        borderColor: `${color}40`,
        color: color,
        background: `${color}10`,
      }}
    >
      {name}
    </span>
  );
}
