'use client';

import { useSignalLoomStore } from '@/lib/store';
import type { Thread, PaneRole, Agent } from '@/lib/types';
import { MessageList } from './message-list';
import { ThreadHeader } from '../threads/thread-header';
import { Composer } from './composer';
import { DelegationTimeline } from './delegation-timeline';
import { SplitViewToggle } from './split-view-toggle';
import { PanePresetSwitcher } from './pane-preset-switcher';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

const STATUS_COLORS: Record<Thread['status'], string> = {
  active:               'var(--mb-teal)',
  waiting_on_nero:      'var(--mb-red)',
  waiting_on_specialist: 'var(--mb-brass)',
  waiting_on_user:       'var(--mb-violet)',
  blocked:              'var(--mb-rust)',
  done:                 'var(--mb-jade)',
};

interface ThreadPaneProps {
  thread: Thread;
  isActive: boolean;
  isSplit: boolean;
  paneRole?: PaneRole;
  onSetActive: () => void;
  onClose?: () => void;
  showDelegationTimeline: boolean;
}

const ROLE_LABELS: Record<PaneRole, string> = {
  primary: 'Primary',
  secondary: 'Secondary',
  monitor: 'Monitor',
};

/** Format a date string as a human-readable relative time */
function relativeTime(iso: string | null | undefined): string {
  if (!iso) return 'Unknown';
  try {
    const ms = new Date(iso).getTime();
    const diff = Date.now() - ms;
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
  } catch {
    return 'Unknown';
  }
}

/** Session metadata card — shown for real OpenClaw sessions with no message history */
function SessionMetadataCard({ thread }: { thread: Thread }) {
  const s = thread.session;
  if (!s) return null;

  return (
    <div
      className="mx-4 my-3 rounded-lg border px-4 py-3 text-xs"
      style={{
        background: 'rgba(255,255,255,0.02)',
        borderColor: 'rgba(255,255,255,0.08)',
        color: 'var(--mb-ash)',
      }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-ivory/60 font-medium uppercase tracking-wider text-[10px]">
          Session Details
        </span>
        {thread.status === 'done' ? (
          <span className="text-jade text-[10px] font-mono">✓ Done</span>
        ) : (
          <span className="text-teal text-[10px] font-mono">● Active</span>
        )}
      </div>

      {/* Metadata grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-3">
        {s.agentName && (
          <div>
            <span className="text-ash-dimmed text-[10px] uppercase tracking-wider">Agent</span>
            <div className="text-ivory/80 font-mono mt-0.5">{s.agentName}</div>
          </div>
        )}
        <div>
          <span className="text-ash-dimmed text-[10px] uppercase tracking-wider">Session ID</span>
          <div className="text-ivory/60 font-mono mt-0.5 text-[10px] truncate" title={s.id}>
            {s.shortId ?? s.id.split(':').pop()?.slice(0, 8) ?? s.id}
          </div>
        </div>
        <div>
          <span className="text-ash-dimmed text-[10px] uppercase tracking-wider">Last active</span>
          <div className="text-ivory/80 mt-0.5">{relativeTime(thread.lastActive)}</div>
        </div>
        <div>
          <span className="text-ash-dimmed text-[10px] uppercase tracking-wider">Messages</span>
          <div className="text-ivory/80 mt-0.5">{s.messageCount ?? 0} stored</div>
        </div>
        {s.preview && (
          <div>
            <span className="text-ash-dimmed text-[10px] uppercase tracking-wider">Preview</span>
            <div className="text-ivory/80 mt-0.5 capitalize truncate" title={s.preview}>{s.preview}</div>
          </div>
        )}
        {(s.tags ?? []).length > 0 && (
          <div className="col-span-2">
            <span className="text-ash-dimmed text-[10px] uppercase tracking-wider">Tags</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {(s.tags ?? []).map((tag) => (
                <span
                  key={tag}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'var(--mb-ivory-dimmed)',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Honest note about message history */}
      <div
        className="text-[11px] leading-relaxed pt-2 border-t"
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}
      >
        <span className="text-ivory/40">
          No message history available for this session through the current adapter.{" "}
        </span>
        <span className="text-ivory/25 italic">
          Transcript access via OpenClaw session tooling.
        </span>
      </div>
    </div>
  );
}



export function ThreadPane({
  thread,
  isActive,
  isSplit,
  paneRole,
  onSetActive,
  onClose,
  showDelegationTimeline,
}: ThreadPaneProps) {
  const { delegationEvents, approvals, highlightMessage, agents, sessionsFetchedAt } = useSignalLoomStore();

  const threadEvents = delegationEvents.filter((e) => e.threadId === thread.id);
  const pendingApproval = approvals.find((a) => a.linkedThreadId === thread.id);
  const linkedAgents = thread.linkedAgents
    .map((id) => agents.find((a) => a.id === id))
    .filter(Boolean);

  return (
    <div
      className={cn(
        'flex flex-col flex-1 min-w-0 h-full min-h-0 overflow-hidden transition-opacity duration-150',
        isSplit && !isActive && 'opacity-85'
      )}
      style={
        isSplit
          ? {
              borderLeft: isActive ? `2px solid ${STATUS_COLORS[thread.status] ?? 'var(--mb-teal)'}` : '2px solid rgba(255,255,255,0.04)',
              background: isActive ? 'var(--mb-carbon)' : 'rgba(0,0,0,0.12)',
            }
          : undefined
      }
      onClick={isSplit && !isActive ? onSetActive : undefined}
    >
      {/* Pane title bar — split mode */}
      {isSplit && (
        <div
          className="flex items-center justify-between px-4 py-2.5 border-b gap-2 flex-shrink-0"
          style={{
            borderColor: isActive ? `${STATUS_COLORS[thread.status]}30` : 'rgba(255,255,255,0.04)',
            background: isActive ? 'rgba(255,255,255,0.03)' : 'transparent',
            borderLeft: isActive ? `3px solid ${STATUS_COLORS[thread.status] ?? 'var(--mb-teal)'}` : '3px solid transparent',
            cursor: !isActive ? 'pointer' : 'default',
            transition: 'background 0.15s ease, border-color 0.15s ease',
          }}
          onClick={!isActive ? onSetActive : undefined}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {/* Status dot */}
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: STATUS_COLORS[thread.status] }}
            />
            {/* Pane role label */}
            {paneRole && (
              <span
                className="text-xs font-mono uppercase tracking-widest flex-shrink-0"
                style={{
                  color: isActive ? 'var(--mb-ivory)' : 'var(--mb-ash)',
                  fontSize: '9px',
                  fontWeight: 600,
                }}
              >
                {ROLE_LABELS[paneRole]}
              </span>
            )}
            {/* Thread title */}
            <span
              className="text-xs truncate"
              style={{
                color: isActive ? 'var(--mb-ivory)' : 'var(--mb-ivory-dim)',
                fontWeight: isActive ? 500 : 400,
              }}
            >
              {thread.title}
            </span>
            {/* Linked agents */}
            {linkedAgents.slice(0, 2).map((agent) =>
              agent ? (
                <span
                  key={agent.id}
                  className="px-1.5 py-0.5 rounded text-xs font-mono flex-shrink-0"
                  style={{
                    background: `${agent.accentColor}15`,
                    color: agent.accentColor,
                    border: `1px solid ${agent.accentColor}25`,
                    fontSize: '9px',
                  }}
                >
                  {agent.name}
                </span>
              ) : null
            )}
            {/* Pending approval badge */}
            {pendingApproval && (
              <span
                className="flex items-center gap-0.5 text-xs font-semibold flex-shrink-0"
                style={{ color: 'var(--mb-brass)', fontSize: '10px' }}
              >
                ▲ {approvals.filter((a) => a.linkedThreadId === thread.id).length}
              </span>
            )}
          </div>
          {onClose && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="flex-shrink-0 text-ash-muted hover:text-ivory transition-colors p-1 rounded hover:bg-white/5"
              aria-label="Close pane"
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}

      {/* Preset switcher — shown when preset switcher is visible (top of center area) */}
      {!isSplit && <PanePresetSwitcher />}

      {/* Thread header */}
      <ThreadHeader thread={thread} />

      {/* Delegation timeline — above messages */}
      {showDelegationTimeline && (
        <DelegationTimeline
          events={threadEvents}
          fetchedAt={sessionsFetchedAt}
          onEventClick={(event) => {
            if (event.linkedMessageId) {
              highlightMessage(event.linkedMessageId);
            }
          }}
        />
      )}

      {/* Real session metadata card — shown for real OpenClaw sessions */}
      {thread.session && <SessionMetadataCard thread={thread} />}

      {/* Context enrichment block — sparse threads ≤2 messages */}
      {thread.messages.length <= 2 && !isSplit && (
        <ContextEnrichmentBlock thread={thread} />
      )}

      {/* Pending approval indicator */}
      {pendingApproval && (
        <div
          className="mx-4 mt-3 flex items-center gap-2 px-3 py-2 rounded-lg border text-xs"
          style={{
            background: 'rgba(201,160,58,0.06)',
            borderColor: 'rgba(201,160,58,0.20)',
            color: 'var(--mb-brass)',
          }}
        >
          <span className="font-semibold">▲ 1 approval pending</span>
          <span className="text-ivory-dim truncate">{pendingApproval.title}</span>
        </div>
      )}

      {/* Messages */}
      <MessageList thread={thread} />

      {/* Composer */}
      <Composer threadId={thread.id} />

      {/* Split view toggle — only in single-pane mode */}
      {!isSplit && <SplitViewToggle />}
    </div>
  );
}

// Sprint 2 Phase E: Context enrichment for sparse threads
function ContextEnrichmentBlock({ thread }: { thread: Thread }) {
  const { approvals } = useSignalLoomStore();
  const pendingApproval = approvals.find((a) => a.linkedThreadId === thread.id);

  const contextMap: Record<
    string,
    { label: string; color: string; icon: string }
  > = {
    waiting_on_nero: {
      label: 'Nero is thinking through this',
      color: 'var(--mb-red)',
      icon: '◷',
    },
    waiting_on_specialist: {
      label: 'Specialist is working on it',
      color: 'var(--mb-brass)',
      icon: '◷',
    },
    waiting_on_user: {
      label: 'Needs your call',
      color: 'var(--mb-violet)',
      icon: '◆',
    },
    blocked: {
      label: 'Blocked',
      color: 'var(--mb-rust)',
      icon: '■',
    },
    active: {
      label: 'Active',
      color: 'var(--mb-teal)',
      icon: '●',
    },
    done: {
      label: 'Done',
      color: 'var(--mb-jade)',
      icon: '✓',
    },
  };

  const ctx = contextMap[thread.status] ?? contextMap.active;

  return (
    <div
      className="flex items-center gap-2 px-4 py-2 border-b text-xs"
      style={{
        background: `${ctx.color}08`,
        borderColor: `${ctx.color}20`,
        color: ctx.color,
      }}
    >
      <span>{ctx.icon}</span>
      <span>{ctx.label}</span>
      {pendingApproval && thread.status === 'waiting_on_user' && (
        <span className="font-semibold ml-2">
          — {pendingApproval.title}
        </span>
      )}
    </div>
  );
}
