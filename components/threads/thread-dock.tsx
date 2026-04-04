'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { useSignalLoomStore } from '@/lib/store';
import { useCrmStore } from '@/lib/crm/store';
import { ThreadListItem } from './thread-list-item';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Thread } from '@/lib/types';
import type { EmailGateStoreItem } from '@/lib/store';
import { getConceptBadgeLabel, getConceptBadgeColor } from '@/lib/crm/concept';
import type { Lead } from '@/lib/crm/types';
import { cn } from '@/lib/utils';

function isWithinLast24Hours(iso: string | null): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < 24 * 60 * 60 * 1000;
}

type GroupKind = 'active' | 'conversation' | 'standalone';

interface ThreadGroup {
  kind: GroupKind;
  /** Unique id for React keys */
  id: string;
  /** Display label */
  label: string;
  /** Icon for conversation groups */
  icon?: string;
  threads: Thread[];
  /** Set to collapse/expand conversation groups */
  collapsed?: boolean;
}

export function ThreadDock() {
  const { threads, selectedThreadId, selectThread, sessionsLoading, sessionsError, sessionsFetchedAt, loadSessions } =
    useSignalLoomStore();

  const pinned = threads.filter((t) => t.pinned);
  const unpinned = threads.filter((t) => !t.pinned);

  // Build smart groups from unpinned threads
  const groups: ThreadGroup[] = buildThreadGroups(unpinned);

  return (
    <aside
      className="flex flex-col h-full border-r"
      style={{
        background: 'var(--mb-shell)',
        borderColor: 'rgba(255,255,255,0.05)',
        width: '260px',
        minWidth: '260px',
      }}
    >
      {/* Dock header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'rgba(255,255,255,0.05)' }}
      >
        <span className="text-xs font-semibold uppercase tracking-widest text-ash-muted">
          Threads
        </span>
        {sessionsLoading ? (
          <span
            className="text-xs font-mono text-ash-muted px-1.5 py-0.5 rounded"
            style={{ background: 'var(--mb-graphite)' }}
          >
            …
          </span>
        ) : (
          <span
            className="text-xs font-mono text-ash-muted px-1.5 py-0.5 rounded"
            style={{ background: 'var(--mb-graphite)' }}
          >
            {threads.length}
          </span>
        )}
      </div>

      {/* Loading state */}
      {sessionsLoading && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4 py-8">
          <div
            className="w-5 h-5 rounded-full border-2 border-t-ash-muted animate-spin"
            style={{ borderColor: 'rgba(255,255,255,0.1)', borderTopColor: 'var(--mb-ash)' }}
          />
          <p className="text-xs text-ash-muted text-center">Loading sessions…</p>
        </div>
      )}

      {/* Error state */}
      {!sessionsLoading && sessionsError && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4 py-8">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-xs"
            style={{
              background: 'rgba(232,96,58,0.12)',
              border: '1.5px solid rgba(232,96,58,0.3)',
              color: 'var(--mb-ember)',
              fontSize: '8px',
            }}
          >
            !
          </div>
          <p className="text-xs text-ember text-center font-semibold">Sessions unavailable</p>
          {sessionsFetchedAt && (
            <p className="text-xs text-ash-muted text-center">
              Last loaded:{' '}
              {new Date(sessionsFetchedAt).toLocaleTimeString('en-IE', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
          <p className="text-xs text-ash-muted text-center leading-relaxed opacity-75 max-w-[180px]">
            {sessionsError}
          </p>
          <button
            onClick={() => loadSessions()}
            className="text-xs px-3 py-1.5 rounded-md font-medium transition-all duration-150 hover:opacity-90"
            style={{
              background: 'var(--mb-graphite)',
              color: 'var(--mb-ivory)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            ↻ Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!sessionsLoading && threads.length === 0 && !sessionsError && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 px-4 py-8">
          <p className="text-xs text-ash-muted text-center">No active sessions</p>
          <p className="text-xs text-ash-muted text-center opacity-60">
            Start a conversation with Nero to begin
          </p>
        </div>
      )}

      {/* Thread list with smart grouping */}
      {!sessionsLoading && threads.length > 0 && (
        <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {/* Pinned threads */}
              {pinned.length > 0 && (
                <>
                  <DockSection label="Pinned" threads={pinned} selectedThreadId={selectedThreadId} onSelect={selectThread} />
                  <div className="my-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.04)' }} />
                </>
              )}

              {/* Smart groups */}
              {groups.map((group) => (
                <GroupSection
                  key={group.id}
                  group={group}
                  selectedThreadId={selectedThreadId}
                  onSelect={selectThread}
                />
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Smart thread grouping
// ---------------------------------------------------------------------------

function buildThreadGroups(threads: Thread[]): ThreadGroup[] {
  const groups: ThreadGroup[] = [];
  const childIds = new Set(threads.flatMap((t) => t.linkedChildren ?? []));

  // Conversation parents: threads that have linked children
  const conversationParents = threads.filter(
    (t) => (t.linkedChildren?.length ?? 0) > 0
  );
  // Standalone: threads that are neither parents nor children
  const standalone = threads.filter(
    (t) => (t.linkedChildren?.length ?? 0) === 0 && !childIds.has(t.id)
  );
  // Pure children: threads that are linked as children but not parents themselves
  const pureChildren = threads.filter(
    (t) => childIds.has(t.id) && (t.linkedChildren?.length ?? 0) === 0
  );

  // Active section: active or recently active threads (that aren't pinned)
  const now = Date.now();
  const FIVE_MINS = 5 * 60 * 1000;
  const activeThreshold = now - FIVE_MINS;
  const activeThreads = threads.filter((t) => {
    if (t.pinned) return false;
    if (t.status === 'active') return true;
    if (t.lastActive) {
      return new Date(t.lastActive).getTime() > activeThreshold;
    }
    return false;
  });

  if (activeThreads.length > 0) {
    groups.push({
      kind: 'active',
      id: 'group-active',
      label: 'Active',
      threads: activeThreads.sort((a, b) => {
        const aTime = a.lastActive ? new Date(a.lastActive).getTime() : 0;
        const bTime = b.lastActive ? new Date(b.lastActive).getTime() : 0;
        return bTime - aTime;
      }),
    });
  }

  // Conversation groups
  for (const parent of conversationParents.sort((a, b) => {
    const aTime = a.lastActive ? new Date(a.lastActive).getTime() : 0;
    const bTime = b.lastActive ? new Date(b.lastActive).getTime() : 0;
    return bTime - aTime;
  })) {
    const children = parent.linkedChildren
      ?.map((childId) => threads.find((t) => t.id === childId))
      .filter((t): t is Thread => t !== undefined) ?? [];

    groups.push({
      kind: 'conversation',
      id: `conv-${parent.id}`,
      label: parent.title ?? 'Delegation',
      icon: '↱',
      threads: [parent, ...children],
      collapsed: true,
    });
  }

  // Standalone threads (recent first)
  if (standalone.length > 0) {
    groups.push({
      kind: 'standalone',
      id: 'group-standalone',
      label: 'Other threads',
      threads: standalone.sort((a, b) => {
        const aTime = a.lastActive ? new Date(a.lastActive).getTime() : 0;
        const bTime = b.lastActive ? new Date(b.lastActive).getTime() : 0;
        return bTime - aTime;
      }),
    });
  }

  return groups;
}

// ---------------------------------------------------------------------------
// Group section (collapsible)
// ---------------------------------------------------------------------------

function GroupSection({
  group,
  selectedThreadId,
  onSelect,
}: {
  group: ThreadGroup;
  selectedThreadId: string | null;
  onSelect: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(group.collapsed ?? false);

  const isConversation = group.kind === 'conversation';
  const isActive = group.kind === 'active';
  const showToggle = isConversation || group.kind === 'standalone';
  const headerColor = isActive
    ? 'rgba(96,200,160,0.5)'
    : isConversation
    ? 'rgba(201,160,58,0.45)'
    : 'rgba(255,255,255,0.25)';

  return (
    <div>
      {/* Section header */}
      <button
        onClick={() => showToggle && setCollapsed((c) => !c)}
        className={cn(
          'flex items-center gap-1.5 w-full px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wider transition-opacity',
          showToggle ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'
        )}
        style={{ color: headerColor }}
      >
        {isConversation && (
          <motion.span
            animate={{ rotate: collapsed ? 0 : 90 }}
            transition={{ duration: 0.15 }}
            className="text-[10px]"
          >
            ›
          </motion.span>
        )}
        {isConversation && <span className="text-[10px]">{group.icon}</span>}
        {group.label}
        <span
          className="ml-auto text-[10px] font-mono opacity-60"
        >
          {group.threads.length}
        </span>
      </button>

      {/* Threads in group */}
      {(!collapsed || !showToggle) && (
        <div className={cn(isConversation && 'ml-2 pl-2 border-l', 'space-y-0.5')} style={isConversation ? { borderColor: 'rgba(255,255,255,0.06)' } : {}}>
          {group.threads.map((thread) => (
            <ThreadListItemWrapper
              key={thread.id}
              thread={thread}
              isSelected={thread.id === selectedThreadId}
              onSelect={() => onSelect(thread.id)}
              indent={isConversation && group.threads.indexOf(thread) > 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section header (flat list)
// ---------------------------------------------------------------------------

function DockSection({
  label,
  threads,
  selectedThreadId,
  onSelect,
  color = 'rgba(255,255,255,0.25)',
}: {
  label: string;
  threads: Thread[];
  selectedThreadId: string | null;
  onSelect: (id: string) => void;
  color?: string;
}) {
  return (
    <div>
      <div
        className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider"
        style={{ color }}
      >
        {label}
      </div>
      {threads.map((thread) => (
        <ThreadListItemWrapper
          key={thread.id}
          thread={thread}
          isSelected={thread.id === selectedThreadId}
          onSelect={() => onSelect(thread.id)}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Thread list item wrapper (with CRM context)
// ---------------------------------------------------------------------------

function ThreadListItemWrapper({
  thread,
  isSelected,
  onSelect,
  indent = false,
}: {
  thread: Thread;
  isSelected: boolean;
  onSelect: () => void;
  indent?: boolean;
}) {
  const { emailGates } = useSignalLoomStore();
  const { leads, getConceptBadge } = useCrmStore();

  const pendingEmailGates = (emailGates as EmailGateStoreItem[]).filter(
    (g) =>
      g.threadId === thread.id &&
      (g.gateStatus === 'ready_for_approval' || g.gateStatus === 'needs_review')
  );
  const hasPendingEmail = pendingEmailGates.length > 0;
  const hasReviewRequired = pendingEmailGates.some((g) => g.gateStatus === 'needs_review');

  const leadId = (emailGates as EmailGateStoreItem[]).find(
    (g) => g.threadId === thread.id && g.leadId
  )?.leadId;
  const lead: Lead | undefined = leadId ? leads.find((l) => l.id === leadId) : undefined;
  const conceptBadge = lead ? getConceptBadge(lead) : null;

  return (
    <div style={indent ? { paddingLeft: '8px' } : {}}>
      <ThreadListItem
        thread={thread}
        isSelected={isSelected}
        onSelect={onSelect}
        hasPendingEmail={hasPendingEmail}
        emailGateUrgent={hasReviewRequired}
        conceptBadge={conceptBadge}
        childCount={thread.linkedChildren?.length ?? 0}
      />
    </div>
  );
}
