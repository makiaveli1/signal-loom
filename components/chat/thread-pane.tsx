'use client';

import { useSignalLoomStore } from '@/lib/store';
import type { Thread } from '@/lib/types';
import { MessageList } from './message-list';
import { ThreadHeader } from '../threads/thread-header';
import { Composer } from './composer';
import { DelegationTimeline } from './delegation-timeline';
import { SplitViewToggle } from './split-view-toggle';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface ThreadPaneProps {
  thread: Thread;
  isActive: boolean;
  isSplit: boolean;
  onSetActive: () => void;
  onClose?: () => void;
  showDelegationTimeline: boolean;
}

export function ThreadPane({
  thread,
  isActive,
  isSplit,
  onSetActive,
  onClose,
  showDelegationTimeline,
}: ThreadPaneProps) {
  const { delegationEvents, approvals, highlightMessage } = useSignalLoomStore();

  const threadEvents = delegationEvents.filter((e) => e.threadId === thread.id);
  const pendingApproval = approvals.find((a) => a.linkedThreadId === thread.id);

  return (
    <div
      className={cn(
        'flex flex-col flex-1 min-w-0 h-full transition-opacity duration-150',
        isSplit && !isActive && 'opacity-60'
      )}
      style={
        isSplit
          ? {
              borderLeft: isActive ? '2px solid var(--mb-brass)' : '2px solid transparent',
              background: isActive ? 'var(--mb-carbon)' : 'rgba(0,0,0,0.08)',
            }
          : undefined
      }
      onClick={isSplit && !isActive ? onSetActive : undefined}
    >
      {/* Pane title bar (split mode only) */}
      {isSplit && (
        <div
          className="flex items-center justify-between px-4 py-2 border-b"
          style={{
            borderColor: 'rgba(255,255,255,0.04)',
            background: 'var(--mb-shell)',
            cursor: !isActive ? 'pointer' : 'default',
          }}
          onClick={!isActive ? onSetActive : undefined}
        >
          <span className="text-xs text-ash-muted truncate">{thread.title}</span>
          {isActive && onClose && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="flex-shrink-0 text-ash-muted hover:text-ivory transition-colors p-0.5 rounded"
              aria-label="Close pane"
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}

      {/* Thread header */}
      <ThreadHeader thread={thread} />

      {/* Delegation timeline — above messages */}
      {showDelegationTimeline && threadEvents.length > 0 && (
        <DelegationTimeline
          events={threadEvents}
          onEventClick={(event) => {
            if (event.linkedMessageId) {
              highlightMessage(event.linkedMessageId);
            }
          }}
        />
      )}

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
