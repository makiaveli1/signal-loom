'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSignalLoomStore } from '@/lib/store';
import type { Thread, PaneRole, Message } from '@/lib/types';
import { getConversationBundle } from '@/lib/conversation-groups';
import { MessageList } from './message-list';
import { ThreadHeader } from '../threads/thread-header';
import { Composer } from './composer';
import { DelegationTimeline } from './delegation-timeline';
import { SplitViewToggle } from './split-view-toggle';
import { PretextSmartTitle } from '@/components/ui/pretext-smart-title';
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

/**
 * TranscriptBlock — shows session history/transcript availability state.
 *
 * States:
 * - loading: spinner while messages are being fetched
 * - available: transcript loaded, optionally with truncation note
 * - partial: transcript loaded but truncated (session too long)
 * - unavailable: no transcript available for this session
 */
function TranscriptBlock({ thread }: { thread: Thread }) {
  const { sessionMessagesLoading, sessionMessages, sessionsFetchedAt } = useSignalLoomStore();
  const [secondsAgo, setSecondsAgo] = useState(0);
  const session = thread.session as import('@/lib/openclaw/adapter/types').OpenClawSession | undefined;
  const isLoading = sessionMessagesLoading[thread.id] ?? false;
  const transcript = sessionMessages[thread.id];

  // Sprint 9: Tick seconds for live sessions
  useEffect(() => {
    if (!session || thread.status !== 'active') return;
    const tick = setInterval(() => {
      if (sessionsFetchedAt) {
        const secs = Math.floor((Date.now() - new Date(sessionsFetchedAt).getTime()) / 1000);
        setSecondsAgo(secs);
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [session, thread.status, sessionsFetchedAt]);

  if (!session) return null;

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
          Hermes Session
        </span>
        {thread.status === 'done' ? (
          <span className="text-jade text-[10px] font-mono">✓ Done</span>
        ) : (
          <span
            className="flex items-center gap-1.5 text-[10px] font-mono"
            style={{ color: 'var(--mb-teal)' }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0 signal-pulse"
              style={{ background: 'var(--mb-teal)' }}
            />
            Live · {secondsAgo}s ago
          </span>
        )}
      </div>

      {/* Metadata grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-3">
        {session.agentName && (
          <div>
            <span className="text-ash text-[10px] uppercase tracking-wider">Agent</span>
            <div className="text-ivory/80 font-mono mt-0.5">{session.agentName}</div>
          </div>
        )}
        <div>
          <span className="text-ash text-[10px] uppercase tracking-wider">Session ID</span>
          <div className="text-ivory/60 font-mono mt-0.5 text-[10px] truncate" title={session.id}>
            {session.shortId ?? session.id.split(':').pop()?.slice(0, 8) ?? session.id}
          </div>
        </div>
        <div>
          <span className="text-ash text-[10px] uppercase tracking-wider">Last active</span>
          <div className="text-ivory/80 mt-0.5">{relativeTime(thread.lastActive)}</div>
        </div>
        <div>
          <span className="text-ash text-[10px] uppercase tracking-wider">Messages</span>
          <div className="text-ivory/80 mt-0.5">{session.messageCount ?? 0} stored</div>
        </div>
        {session.preview && (
          <div>
            <span className="text-ash text-[10px] uppercase tracking-wider">Preview</span>
            <div className="text-ivory/80 mt-0.5 capitalize truncate" title={session.preview}>{session.preview}</div>
          </div>
        )}
        {(session.tags ?? []).length > 0 && (
          <div className="col-span-2">
            <span className="text-ash text-[10px] uppercase tracking-wider">Tags</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {(session.tags ?? []).map((tag) => (
                <span
                  key={tag}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'var(--mb-ivory-dim)',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Transcript state */}
      <div
        className="text-[11px] leading-relaxed pt-2 border-t"
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}
      >
        {isLoading ? (
          <div className="flex flex-col gap-2 pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            {/* Sprint 10.5: Shimmer skeleton — transcript is loading */}
            <div className="flex items-center gap-2 text-ivory/30 text-[11px]">
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                style={{ fontSize: '10px' }}
              >◷</motion.span>
              <span>Loading transcript…</span>
            </div>
            <div className="flex flex-col gap-1.5 py-1">
              {([100, 65, 80] as const).map((w, i) => (
                <motion.div
                  key={i}
                  animate={{ opacity: [0.25, 0.55, 0.25] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut', delay: i * 0.15 }}
                  className="h-2 rounded"
                  style={{ width: `${w}%`, background: 'rgba(255,255,255,0.07)' }}
                />
              ))}
            </div>
          </div>
        ) : transcript && transcript.messages.length > 0 ? (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-jade">✓</span>
              <span className="text-ivory/50">
                {transcript.messages.length} message{transcript.messages.length !== 1 ? 's' : ''} loaded
              </span>
            </div>
            {(transcript.contentTruncated || transcript.truncated) && (
              <div className="text-ivory/25 italic">
                Note: session is long — only the most recent messages were retrieved.
              </div>
            )}
            {transcript.droppedMessages && (
              <div className="text-ivory/25 italic">
                Some older messages were dropped by the gateway.
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-ivory/30">—</span>
              <span className="text-ivory/40">
                No transcript available for this session.
              </span>
            </div>
            <span className="text-ivory/20 italic">
              Transcript access is backed by Hermes session state.
            </span>
          </div>
        )}
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
  const {
    delegationEvents,
    approvals,
    highlightMessage,
    agents,
    sessionsFetchedAt,
    sessionMessages,
    sessionMessagesLoading,
    loadMessagesForThread,
    childSessionIds,
    openChildSession,
    activeDelegationEventId,
    threads,
    hiddenThreadIds,
    setActivePaneById,
    workspace,
    childToParentMap,
  } = useSignalLoomStore();

  // Sprint 10.7: Load transcript from sessionMessages store — messages loaded by
  // loadMessagesForThread are stored here, NOT in thread.messages (which is empty
  // for session-derived threads). Pass to MessageList via messages prop.
  const visibleBundleThreads = useMemo(
    () => threads.filter((candidate) => candidate.id === thread.id || !hiddenThreadIds.includes(candidate.id)),
    [hiddenThreadIds, thread.id, threads]
  );
  const conversationBundle = useMemo(() => getConversationBundle(visibleBundleThreads, thread.id), [visibleBundleThreads, thread.id]);
  const bundleThreads = useMemo(
    () => conversationBundle?.kind === 'conversation' ? conversationBundle.threads : [thread],
    [conversationBundle, thread]
  );
  const isConversationBundle = bundleThreads.length > 1;

  const transcriptKey = thread.session?.id ?? thread.id;
  const transcript = sessionMessages[transcriptKey] ?? sessionMessages[thread.id];

  const displayedMessages = useMemo<(Message & {
    sourceThreadId?: string;
    sourceThreadTitle?: string;
    sourceThreadStatus?: Thread['status'];
    sourceThreadKind?: 'primary' | 'delegated' | 'related';
    sourceSessionShortId?: string;
  })[]>(() => {
    if (!isConversationBundle) return transcript?.messages ?? thread.messages;

    return bundleThreads
      .flatMap((bundleThread) => {
        const key = bundleThread.session?.id ?? bundleThread.id;
        const bundleTranscript = sessionMessages[key] ?? sessionMessages[bundleThread.id];
        const sourceMessages = bundleTranscript?.messages ?? bundleThread.messages;
        const sourceThreadKind = bundleThread.id === thread.id
          ? 'primary'
          : childToParentMap[bundleThread.id]
            ? 'delegated'
            : 'related';
        return sourceMessages.map((message) => ({
          ...message,
          id: `${bundleThread.id}:${message.id}`,
          sourceThreadId: bundleThread.id,
          sourceThreadTitle: bundleThread.title,
          sourceThreadStatus: bundleThread.status,
          sourceThreadKind,
          sourceSessionShortId: bundleThread.session?.shortId,
        }));
      })
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [bundleThreads, childToParentMap, isConversationBundle, sessionMessages, thread.id, thread.messages, transcript?.messages]);

  // Sprint 9: Collapse state for the session info panel (Delegated Lane Work + Timeline + Hermes Session)
  const [infoPanelCollapsed, setInfoPanelCollapsed] = useState(true);

  // Load every transcript in a conversation bundle so related sessions read as one
  // continuous chat instead of forcing the operator to jump between fragments.
  useEffect(() => {
    for (const bundleThread of bundleThreads) {
      const sessionKey = bundleThread.session?.id ?? bundleThread.id;
      if (!bundleThread.session && !sessionMessages[bundleThread.id] && !sessionMessagesLoading[bundleThread.id]) {
        loadMessagesForThread(bundleThread.id);
        continue;
      }
      if (sessionMessages[sessionKey]) continue;
      if (sessionMessagesLoading[sessionKey]) continue;
      loadMessagesForThread(sessionKey);
    }
  }, [bundleThreads, sessionMessages, sessionMessagesLoading, loadMessagesForThread]);

  // Sprint 10.6: No more 5-second polling — SSE live events handle new messages.
  // Keeping the SSE connection alive is the only refresh mechanism needed.
  // Polling caused visible list refreshes and killed streaming state mid-stream.

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
            <PretextSmartTitle
              text={thread.title}
              maxWidth={260}
              maxLines={1}
              className="text-xs"
              font="500 12px Geist, ui-sans-serif, system-ui, sans-serif"
              lineHeight={15}
            />
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
            {/* Sprint 10.5: Spring pop-in for approval badge */}
            <AnimatePresence>
              {pendingApproval && (
                <motion.span
                  key="approval-badge"
                  initial={{ opacity: 0, scale: 0.6, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: -2 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 22, mass: 0.4 }}
                  className="flex items-center gap-0.5 text-xs font-semibold flex-shrink-0"
                  style={{ color: 'var(--mb-brass)', fontSize: '10px' }}
                >
                  ▲ {approvals.filter((a) => a.linkedThreadId === thread.id).length}
                </motion.span>
              )}
            </AnimatePresence>
            {/* Sprint 8: Parent context link — shown on child sessions in secondary pane */}
            {paneRole === 'secondary' && childToParentMap[thread.id] && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const primaryPane = workspace.panes.find((p) => p.role === 'primary');
                  if (primaryPane) setActivePaneById(primaryPane.id);
                }}
                className="flex items-center gap-1 text-xs font-mono flex-shrink-0 cursor-pointer transition-opacity hover:opacity-80 active:scale-95"
                style={{ color: '#3ab8c8', fontSize: '9px', border: '1px solid rgba(58,184,200,0.25)', padding: '1px 6px', borderRadius: '4px', background: 'rgba(58,184,200,0.06)' }}
                title="Return to parent session"
              >
                ↙ Parent context
              </button>
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
      <ThreadHeader
        thread={thread}
        delegationCount={childSessionIds[thread.id]?.length ?? 0}
        onOpenChildSession={
          (childId) => openChildSession(childId, threadEvents.find((e) => e.childSessionIds?.includes(childId))?.id)
        }
      />

      {/* Sprint 9: Session info panel — wraps Delegated Lane Work + Timeline + Hermes Session */}
      <SessionInfoPanel
        thread={thread}
        threadEvents={threadEvents}
        sessionsFetchedAt={sessionsFetchedAt}
        showDelegationTimeline={showDelegationTimeline}
        activeDelegationEventId={activeDelegationEventId}
        onOpenChildSession={(childId) =>
          openChildSession(childId, threadEvents.find((e) => e.childSessionIds?.includes(childId))?.id)
        }
        onHighlightMessage={highlightMessage}
        collapsed={infoPanelCollapsed}
        onToggleCollapse={() => setInfoPanelCollapsed((v) => !v)}
      />

      {/* Context enrichment block — sparse threads ≤2 messages */}
      {displayedMessages.length <= 2 && !isSplit && (
        <ContextEnrichmentBlock thread={thread} />
      )}

      {/* Sprint 10.5: Spring pop-in for approval indicator */}
      <AnimatePresence>
        {pendingApproval && (
          <motion.div
            key="approval-indicator"
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 26, mass: 0.7 }}
            className="mx-4 mt-3 flex items-center gap-2 px-3 py-2 rounded-lg border text-xs"
            style={{
              background: 'rgba(201,160,58,0.06)',
              borderColor: 'rgba(201,160,58,0.20)',
              color: 'var(--mb-brass)',
            }}
          >
            <span className="font-semibold">▲ 1 approval pending</span>
            <span className="text-ivory-dim truncate">{pendingApproval.title}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <MessageList
        thread={thread}
        messages={displayedMessages}
        conversationBundle={isConversationBundle ? conversationBundle : null}
      />

      {/* Composer */}
      <Composer threadId={thread.id} />

      {/* Split view toggle — only in single-pane mode */}
      {!isSplit && <SplitViewToggle />}
    </div>
  );
}

// Sprint 9: SessionInfoPanel — wraps Delegated Lane Work + Timeline + Hermes Session with one collapse toggle
function SessionInfoPanel({
  thread,
  threadEvents,
  sessionsFetchedAt,
  showDelegationTimeline,
  activeDelegationEventId,
  onOpenChildSession,
  onHighlightMessage,
  collapsed,
  onToggleCollapse,
}: {
  thread: Thread;
  threadEvents: import('@/lib/types').DelegationEvent[];
  sessionsFetchedAt: string | null;
  showDelegationTimeline: boolean;
  activeDelegationEventId: string | null;
  onOpenChildSession: (childId: string) => void;
  onHighlightMessage: (messageId: string | null) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const hasDelegatedChildren = (thread.linkedChildren?.length ?? 0) > 0;
  const hasSession = !!thread.session;

  // Collapsed: show a slim premium work-context shelf so technical routing never dominates the chat.
  if (collapsed) {
    return (
      <button
        onClick={onToggleCollapse}
        className="w-full group flex items-center gap-3 px-5 py-1.5 border-b cursor-pointer transition-all duration-200 hover:bg-white/[0.035]"
        style={{
          background: 'linear-gradient(90deg, rgba(201,160,58,0.045), rgba(255,255,255,0.01), rgba(61,201,196,0.025))',
          borderColor: 'rgba(255,255,255,0.055)',
          minHeight: '44px',
        }}
        title="Open folded routing, delegated work, and session receipts"
      >
        <span
          className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border transition-transform duration-200 group-hover:translate-x-0.5"
          style={{
            borderColor: 'rgba(201,160,58,0.26)',
            color: 'var(--mb-brass)',
            background: 'rgba(201,160,58,0.08)',
          }}
          aria-hidden="true"
        >
          ›
        </span>

        <div className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: 'var(--mb-brass)' }}>
              Receipts
            </span>
            <span className="hidden text-[11px] text-ash xl:inline">
              routing + tools folded
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {hasDelegatedChildren && (
            <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-2 py-1 text-[10px] font-mono text-signal-violet">
              {(thread.linkedChildren ?? []).length} delegated
            </span>
          )}
          {showDelegationTimeline && threadEvents.length > 0 && (
            <span className="rounded-full border border-brass/20 bg-brass/10 px-2 py-1 text-[10px] font-mono text-brass">
              {threadEvents.length} event{threadEvents.length !== 1 ? 's' : ''}
            </span>
          )}
          {hasSession && (
            <span className="rounded-full border border-white/10 bg-black/15 px-2 py-1 text-[10px] font-mono text-ash">
              session
            </span>
          )}
        </div>
      </button>
    );
  }

  // Expanded: show all sections with a collapse toggle at the top
  return (
    <div className="border-b" style={{ borderColor: 'rgba(255,255,255,0.055)' }}>
      {/* Section header with collapse toggle */}
      <button
        onClick={onToggleCollapse}
        className="w-full flex items-center gap-3 px-5 py-2 cursor-pointer transition-all duration-200 hover:bg-white/[0.025]"
        style={{ background: 'linear-gradient(90deg, rgba(201,160,58,0.05), rgba(255,255,255,0.012))', minHeight: '44px' }}
        title="Fold receipts — give more room to Nero chat"
      >
        <span
          className="flex h-5 w-5 items-center justify-center rounded-full border"
          style={{ borderColor: 'rgba(201,160,58,0.24)', color: 'var(--mb-brass)', background: 'rgba(201,160,58,0.08)' }}
          aria-hidden="true"
        >
          ‹
        </span>
        <div className="min-w-0 flex-1 text-left">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: 'var(--mb-brass)' }}>
            Receipts open
          </span>
          <span className="block truncate text-[11px] text-ash">
            delegated helper work, routing events, and Hermes session receipts
          </span>
        </div>
        <span className="text-[10px] text-ash-muted">
          fold context
        </span>
      </button>

      <div
        className="min-h-0 overflow-y-auto"
        style={{ maxHeight: 'min(42vh, 24rem)' }}
      >
        {/* Sprint 8: Delegation strip — child session shortcuts */}
        {hasDelegatedChildren && (
          <DelegationStrip
            thread={thread}
            onOpenChildSession={onOpenChildSession}
          />
        )}

        {/* Delegation timeline */}
        {showDelegationTimeline && (
          <DelegationTimeline
            events={threadEvents}
            fetchedAt={sessionsFetchedAt}
            onEventClick={(event) => {
              if (event.linkedMessageId) {
                onHighlightMessage(event.linkedMessageId);
              }
            }}
            onOpenChildSession={(childSessionId) =>
              onOpenChildSession(childSessionId)
            }
            inlineMode={true}
            activeEventId={activeDelegationEventId}
          />
        )}

        {/* Real session transcript block */}
        {hasSession && <TranscriptBlock thread={thread} />}
      </div>
    </div>
  );
}

// Sprint 8: DelegationStrip — compact child session shortcut strip
function DelegationStrip({
  thread,
  onOpenChildSession,
}: {
  thread: Thread;
  onOpenChildSession: (childId: string) => void;
}) {
  const { sessions } = useSignalLoomStore();
  const childIds = thread.linkedChildren ?? [];

  if (childIds.length === 0) return null;

  return (
    <div
      className="flex flex-col gap-0.5 px-4 py-2 border-b"
      style={{
        background: 'rgba(155,141,200,0.04)',
        borderColor: 'rgba(155,141,200,0.10)',
      }}
    >
      {/* Label row */}
      <div className="flex items-center gap-2 mb-1">
        <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <circle cx="6" cy="6" r="2.5" stroke="#9b8dc8" strokeWidth="1.2" fill="none" />
          <path d="M1 6C2 3.5 4 2 6 2s4 1.5 5 4c-1 2.5-3 4-5 4S2 8.5 1 6z" stroke="#9b8dc8" strokeWidth="1.2" fill="none" strokeLinejoin="round" />
        </svg>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(155,141,200,0.6)', fontSize: '9px' }}>
          Delegated Lane Work
        </span>
      </div>

      {/* Child session rows */}
      {childIds.slice(0, 3).map((childId) => {
        const childSession = sessions.find((s) => s.id === childId);
        const title = childSession?.title ?? childSession?.shortId ?? childId;
        const status = childSession?.status === 'active' ? 'active' : 'done';

        return (
          <div
            key={childId}
            className="flex items-center gap-2 px-2 py-1 rounded border transition-all duration-100 cursor-pointer hover:bg-white/5"
            style={{
              borderColor: 'rgba(155,141,200,0.15)',
              background: 'rgba(155,141,200,0.05)',
            }}
            onClick={() => onOpenChildSession(childId)}
          >
            {/* Status dot */}
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: status === 'active' ? 'var(--mb-teal)' : 'var(--mb-jade)' }}
            />
            {/* Title */}
            <span
              className="flex-1 text-xs truncate"
              style={{ color: 'var(--mb-ivory-dim)', fontFamily: 'monospace' }}
              title={title}
            >
              {title}
            </span>
            {/* Status */}
            <span
              className="text-xs font-mono flex-shrink-0"
              style={{ color: status === 'active' ? 'var(--mb-teal)' : 'var(--mb-jade)', fontSize: '9px' }}
            >
              {status}
            </span>
            {/* Open button */}
            <span
              className="text-xs font-mono flex-shrink-0"
              style={{ color: '#9b8dc8', fontSize: '9px' }}
            >
              Open ↗
            </span>
          </div>
        );
      })}
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
