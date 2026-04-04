'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSignalLoomStore } from '@/lib/store';
import { useCrmStore } from '@/lib/crm/store';
import { ThreadListItem } from './thread-list-item';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Thread } from '@/lib/types';
import type { EmailGateStoreItem } from '@/lib/store';
import type { Lead } from '@/lib/crm/types';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Title-based conversation detection
// ---------------------------------------------------------------------------

const PREFIX_STRIP = /^(re:|fw:|fwd:|aw|sv:|antw:)\s*/i;
const STOPWORDS = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'it', 'its', 'as', 'from', 'or', 'not', 'no', 'so', 'if', 'when', 'then', 'than', 'also', 'just', 'only', 'about', 'up', 'down', 'out', 'more', 'most', 'some', 'all', 'any', 'each', 'every', 'which', 'what', 'who', 'whom', 'where', 'why', 'how']);

function significantWords(title: string): Set<string> {
  return new Set(
    title
      .replace(PREFIX_STRIP, '')
      .toLowerCase()
      .split(/[\s\-_,;.!?+]+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  );
}

function sharedWordCount(a: string, b: string): number {
  const wa = significantWords(a);
  const wb = significantWords(b);
  let shared = 0;
  for (const w of wa) { if (wb.has(w)) shared++; }
  return shared;
}

function topWords(title: string, count = 2): string {
  return [...significantWords(title)].slice(0, count).join(' ');
}

// ---------------------------------------------------------------------------
// Group types
// ---------------------------------------------------------------------------

type GroupKind = 'active' | 'conversation' | 'recent';

interface ThreadGroup {
  kind: GroupKind;
  id: string;
  label: string;
  /** Primary topic word(s) shown as group preview */
  topic?: string;
  icon?: string;
  threads: Thread[];
}

type CollapseState = Map<string, boolean>;

// ---------------------------------------------------------------------------
// Build groups
// ---------------------------------------------------------------------------

const FIVE_MINS_MS = 5 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const TITLE_SHARED_THRESHOLD = 3;
const TITLE_TIME_WINDOW_MS = 60 * 60 * 1000; // 60 min

function buildGroups(threads: Thread[]): ThreadGroup[] {
  if (threads.length === 0) return [];

  const now = Date.now();
  const childIds = new Set(threads.flatMap((t) => t.linkedChildren ?? []));

  // ── Active ────────────────────────────────────────────────────────────────
  const active = threads.filter((t) => {
    if (t.pinned) return false;
    if (t.status === 'active') return true;
    if (t.lastActive) return now - new Date(t.lastActive).getTime() < FIVE_MINS_MS;
    return false;
  }).sort(byLastActive);

  // ── Conversation groups via title similarity ──────────────────────────────
  // Only group non-active, non-parent threads to keep active threads surfaced
  const candidates = threads.filter((t) =>
    !t.pinned &&
    t.status !== 'active' &&
    (t.linkedChildren?.length ?? 0) === 0
  ).sort(byLastActive);

  const groupedIds = new Set<string>();
  const conversationGroups: ThreadGroup[] = [];

  for (const seed of candidates) {
    if (groupedIds.has(seed.id)) continue;
    const seedTime = seed.lastActive ? new Date(seed.lastActive).getTime() : 0;
    const seedWords = significantWords(seed.title);

    // Find threads that share ≥THRESHOLD words with seed AND are within TIME_WINDOW
    const group: Thread[] = [seed];
    groupedIds.add(seed.id);

    for (const other of candidates) {
      if (groupedIds.has(other.id)) continue;
      const otherTime = other.lastActive ? new Date(other.lastActive).getTime() : 0;
      const timeDiff = Math.abs(seedTime - otherTime);
      if (timeDiff > TITLE_TIME_WINDOW_MS) continue;

      const shared = sharedWordCount(seed.title, other.title);
      if (shared >= TITLE_SHARED_THRESHOLD) {
        group.push(other);
        groupedIds.add(other.id);
      }
    }

    if (group.length >= 2) {
      conversationGroups.push({
        kind: 'conversation',
        id: `conv-${seed.id}`,
        label: group.length === 2 ? 'Thread' : `${group.length} threads`,
        topic: topWords(seed.title, 2),
        icon: '↱',
        threads: group,
      });
    }
  }

  // ── Conversation groups via linkedChildren ────────────────────────────────
  const parentGroups: ThreadGroup[] = [];
  const processedParentIds = new Set<string>();

  for (const parent of threads) {
    if (processedParentIds.has(parent.id)) continue;
    const children = parent.linkedChildren
      ?.map((id) => threads.find((t) => t.id === id))
      .filter((t): t is Thread => t !== undefined) ?? [];
    if (children.length === 0) continue;

    processedParentIds.add(parent.id);
    children.forEach((c) => groupedIds.add(c.id));

    parentGroups.push({
      kind: 'conversation',
      id: `conv-${parent.id}`,
      label: children.length === 1 ? 'Thread + child' : `Delegation (${children.length})`,
      topic: topWords(parent.title, 2),
      icon: '↱',
      threads: [parent, ...children],
    });
  }

  // ── Recent ───────────────────────────────────────────────────────────────
  const remaining = threads.filter((t) =>
    !t.pinned &&
    !active.includes(t) &&
    !groupedIds.has(t.id)
  ).sort(byLastActive);

  const groups: ThreadGroup[] = [];

  if (active.length > 0) {
    groups.push({ kind: 'active', id: 'group-active', label: 'Active', threads: active });
  }

  // Merge all conversation groups, sorted by newest first
  const allConversations = [...conversationGroups, ...parentGroups].sort(
    (a, b) => {
      const aTime = a.threads[0].lastActive ? new Date(a.threads[0].lastActive).getTime() : 0;
      const bTime = b.threads[0].lastActive ? new Date(b.threads[0].lastActive).getTime() : 0;
      return bTime - aTime;
    }
  );
  groups.push(...allConversations);

  if (remaining.length > 0) {
    groups.push({ kind: 'recent', id: 'group-recent', label: 'Recent', threads: remaining });
  }

  return groups;
}

function byLastActive(a: Thread, b: Thread): number {
  const aTime = a.lastActive ? new Date(a.lastActive).getTime() : 0;
  const bTime = b.lastActive ? new Date(b.lastActive).getTime() : 0;
  return bTime - aTime;
}

// ---------------------------------------------------------------------------
// ThreadDock
// ---------------------------------------------------------------------------

export function ThreadDock() {
  const { threads, selectedThreadId, selectThread, sessionsLoading, sessionsError, sessionsFetchedAt, loadSessions } =
    useSignalLoomStore();

  const [collapsed, setCollapsed] = useState<CollapseState>(() => new Map([
    ['group-active', false],
    ['group-recent', true],
  ]));

  const pinned = threads.filter((t) => t.pinned);
  const unpinned = threads.filter((t) => !t.pinned);
  const groups = buildGroups(unpinned);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Map(prev);
      next.set(id, !prev.get(id));
      return next;
    });
  }, []);

  return (
    <aside
      className="flex flex-col h-full border-r"
      style={{ background: 'var(--mb-shell)', borderColor: 'rgba(255,255,255,0.05)', width: '260px', minWidth: '260px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <span className="text-xs font-semibold uppercase tracking-widest text-ash-muted">Threads</span>
        {sessionsLoading ? (
          <span className="text-xs font-mono text-ash-muted px-1.5 py-0.5 rounded" style={{ background: 'var(--mb-graphite)' }}>…</span>
        ) : (
          <span className="text-xs font-mono text-ash-muted px-1.5 py-0.5 rounded" style={{ background: 'var(--mb-graphite)' }}>{threads.length}</span>
        )}
      </div>

      {/* Loading */}
      {sessionsLoading && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4 py-8">
          <div className="w-5 h-5 rounded-full border-2 border-t-ash-muted animate-spin" style={{ borderColor: 'rgba(255,255,255,0.1)', borderTopColor: 'var(--mb-ash)' }} />
          <p className="text-xs text-ash-muted text-center">Loading sessions…</p>
        </div>
      )}

      {/* Error */}
      {!sessionsLoading && sessionsError && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4 py-8">
          <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs" style={{ background: 'rgba(232,96,58,0.12)', border: '1.5px solid rgba(232,96,58,0.3)', color: 'var(--mb-ember)', fontSize: '8px' }}>!</div>
          <p className="text-xs text-ember text-center font-semibold">Sessions unavailable</p>
          {sessionsFetchedAt && (
            <p className="text-xs text-ash-muted text-center">Last: {new Date(sessionsFetchedAt).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })}</p>
          )}
          <button onClick={() => loadSessions()} className="text-xs px-3 py-1.5 rounded-md font-medium hover:opacity-90" style={{ background: 'var(--mb-graphite)', color: 'var(--mb-ivory)', border: '1px solid rgba(255,255,255,0.1)' }}>
            ↻ Retry
          </button>
        </div>
      )}

      {/* Empty */}
      {!sessionsLoading && threads.length === 0 && !sessionsError && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 px-4 py-8">
          <p className="text-xs text-ash-muted text-center">No active sessions</p>
          <p className="text-xs text-ash-muted text-center opacity-60">Start a conversation with Nero to begin</p>
        </div>
      )}

      {/* Thread list */}
      {!sessionsLoading && threads.length > 0 && (
        <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-0.5">
              {pinned.length > 0 && (
                <>
                  <DockSection label="Pinned" threads={pinned} selectedThreadId={selectedThreadId} onSelect={selectThread} />
                  <div className="my-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.04)' }} />
                </>
              )}
              {groups.map((group) => (
                <DockGroupSection
                  key={group.id}
                  group={group}
                  collapsed={!!collapsed.get(group.id)}
                  onToggle={() => toggleCollapse(group.id)}
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
// DockGroupSection — collapsible group
// ---------------------------------------------------------------------------

function DockGroupSection({
  group,
  collapsed,
  onToggle,
  selectedThreadId,
  onSelect,
}: {
  group: ThreadGroup;
  collapsed: boolean;
  onToggle: () => void;
  selectedThreadId: string | null;
  onSelect: (id: string) => void;
}) {
  const headerColor = group.kind === 'active'
    ? 'rgba(96,200,160,0.55)'
    : group.kind === 'conversation'
    ? 'rgba(201,160,58,0.5)'
    : 'rgba(255,255,255,0.25)';

  const isCollapsible = group.kind !== 'active';

  return (
    <div>
      <button
        onClick={isCollapsible ? onToggle : undefined}
        className={cn(
          'flex items-center gap-1.5 w-full px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wider transition-opacity',
          isCollapsible ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'
        )}
        style={{ color: headerColor }}
        aria-expanded={!collapsed}
      >
        {isCollapsible && (
          <motion.span animate={{ rotate: collapsed ? 0 : 90 }} transition={{ duration: 0.12 }} className="text-[10px] flex-shrink-0">›</motion.span>
        )}
        {group.kind === 'conversation' && <span className="text-[10px]">{group.icon}</span>}
        <span className="truncate">{group.label}</span>
        {group.topic && group.kind === 'conversation' && (
          <span className="text-[10px] font-normal opacity-50 truncate" style={{ color: headerColor }}>{group.topic}</span>
        )}
        <span className="ml-auto text-[10px] font-mono opacity-50 flex-shrink-0">{group.threads.length}</span>
      </button>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div
              className={cn('space-y-0.5', group.kind === 'conversation' ? 'ml-2 pl-2 border-l' : '')}
              style={group.kind === 'conversation' ? { borderColor: 'rgba(255,255,255,0.06)' } : {}}
            >
              {group.threads.map((thread) => (
                <ThreadListItemWrapper
                  key={thread.id}
                  thread={thread}
                  isSelected={thread.id === selectedThreadId}
                  onSelect={() => onSelect(thread.id)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DockSection — flat section (pinned)
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
      <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color }}>{label}</div>
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
// ThreadListItemWrapper — CRM context
// ---------------------------------------------------------------------------

function ThreadListItemWrapper({
  thread,
  isSelected,
  onSelect,
}: {
  thread: Thread;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { emailGates } = useSignalLoomStore();
  const { leads, getConceptBadge } = useCrmStore();

  const pendingEmailGates = (emailGates as EmailGateStoreItem[]).filter(
    (g) => g.threadId === thread.id && (g.gateStatus === 'ready_for_approval' || g.gateStatus === 'needs_review')
  );
  const hasPendingEmail = pendingEmailGates.length > 0;
  const hasReviewRequired = pendingEmailGates.some((g) => g.gateStatus === 'needs_review');
  const leadId = (emailGates as EmailGateStoreItem[]).find((g) => g.threadId === thread.id && g.leadId)?.leadId;
  const lead: Lead | undefined = leadId ? leads.find((l) => l.id === leadId) : undefined;
  const conceptBadge = lead ? getConceptBadge(lead) : null;

  return (
    <ThreadListItem
      thread={thread}
      isSelected={isSelected}
      onSelect={onSelect}
      hasPendingEmail={hasPendingEmail}
      emailGateUrgent={hasReviewRequired}
      conceptBadge={conceptBadge}
      childCount={thread.linkedChildren?.length ?? 0}
    />
  );
}
