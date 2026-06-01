'use client';

import { useCallback, useState } from 'react';
import { PretextSmartTitle } from '@/components/ui/pretext-smart-title';
import { motion, AnimatePresence } from 'motion/react';
import { useSignalLoomStore } from '@/lib/store';
import { ThreadListItem } from './thread-list-item';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Thread } from '@/lib/types';
import { buildThreadGroups, type ConversationGroup } from '@/lib/conversation-groups';
import { cn } from '@/lib/utils';

type CollapseState = Map<string, boolean>;

// ---------------------------------------------------------------------------
// ThreadDock
// ---------------------------------------------------------------------------

export function ThreadDock({ width = 260, onCollapse }: { width?: number; onCollapse?: () => void }) {
  const {
    threads,
    selectedThreadId,
    selectThread,
    sessionsLoading,
    sessionsError,
    sessionsFetchedAt,
    loadSessions,
    hiddenThreadIds,
    threadDockMode,
    setThreadDockMode,
    hideThread,
    hideThreads,
    unhideThread,
  } = useSignalLoomStore();

  const [collapsed, setCollapsed] = useState<CollapseState>(() => new Map([
    ['group-active', false],
    ['group-recent', true],
  ]));

  const hiddenSet = new Set(hiddenThreadIds);
  const hiddenThreads = threads.filter((thread) => hiddenSet.has(thread.id));
  const visibleThreads = threads.filter((thread) => !hiddenSet.has(thread.id));
  const focusThreads = visibleThreads.filter((thread) =>
    thread.pinned ||
    thread.status === 'active' ||
    thread.status === 'waiting_on_user' ||
    thread.status === 'waiting_on_nero' ||
    thread.status === 'waiting_on_specialist' ||
    thread.status === 'blocked' ||
    thread.hasApproval
  );
  const dockThreads = threadDockMode === 'hidden'
    ? hiddenThreads
    : threadDockMode === 'focus'
      ? (focusThreads.length > 0 ? focusThreads : visibleThreads)
      : visibleThreads;
  const pinned = dockThreads.filter((t) => t.pinned);
  const unpinned = dockThreads.filter((t) => !t.pinned);
  const groups = buildThreadGroups(unpinned);

  const toggleCollapse = useCallback((id: string, defaultCollapsed: boolean) => {
    setCollapsed((prev) => {
      const next = new Map(prev);
      next.set(id, !(prev.get(id) ?? defaultCollapsed));
      return next;
    });
  }, []);

  return (
    <aside
      className="thread-dock-shell flex flex-col h-full border-r"
      style={{ background: 'var(--sl-chrome)', borderColor: 'var(--sl-divider)', width: `${width}px`, minWidth: '220px', maxWidth: '420px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--sl-divider)' }}>
        <div>
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-brass">Loom</span>
          <p className="mt-0.5 text-[10px] text-ash">Focus, restore, or tuck chats away</p>
        </div>
        <div className="flex items-center gap-1.5">
          {sessionsLoading ? (
            <span className="text-xs font-mono text-ash-muted px-1.5 py-0.5 rounded" style={{ background: 'var(--mb-graphite)' }}>…</span>
          ) : (
            <span className="text-xs font-mono text-ash-muted px-1.5 py-0.5 rounded" style={{ background: 'var(--mb-graphite)' }}>{threads.length}</span>
          )}
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              className="thread-dock-collapse-button rounded-md border border-white/10 px-1.5 py-1 text-[10px] text-ash transition-colors hover:text-ivory"
              title="Collapse chat list"
              aria-label="Collapse chat list"
            >
              ‹
            </button>
          )}
        </div>
      </div>

      <div className="loom-mode-tabs border-b px-2 py-2" style={{ borderColor: 'var(--sl-divider)' }}>
        {(['focus', 'all', 'hidden'] as const).map((mode) => {
          const count = mode === 'hidden' ? hiddenThreads.length : mode === 'focus' ? focusThreads.length : visibleThreads.length;
          const label = mode === 'focus' ? 'Focus' : mode === 'all' ? 'All' : 'Hidden';
          return (
            <button
              key={mode}
              type="button"
              className={cn('loom-mode-tab', threadDockMode === mode && 'is-active')}
              onClick={() => setThreadDockMode(mode)}
              aria-pressed={threadDockMode === mode}
            >
              <span>{label}</span>
              <span className="loom-mode-count">{count}</span>
            </button>
          );
        })}
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
          <p className="text-xs text-ember text-center font-semibold">Hermes sessions unavailable</p>
          {sessionsFetchedAt && (
            <p className="text-xs text-ash-muted text-center">Last: {new Date(sessionsFetchedAt).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })}</p>
          )}
          <button onClick={() => loadSessions()} className="text-xs px-3 py-1.5 rounded-md font-medium hover:opacity-90" style={{ background: 'var(--mb-graphite)', color: 'var(--mb-ivory)', border: '1px solid rgba(255,255,255,0.1)' }}>
            ↻ Retry
          </button>
        </div>
      )}

      {/* Empty */}
      {!sessionsLoading && dockThreads.length === 0 && !sessionsError && (
        <div className="flat-rest-state flex-1 flex flex-col items-center justify-center gap-2 px-4 py-8">
          <span className="flat-rest-mark" aria-hidden="true">⌁</span>
          <p className="text-xs text-ivory-dim text-center">{threadDockMode === 'hidden' ? 'No hidden conversations' : 'The loom is quiet'}</p>
          <p className="text-xs text-ash text-center">{threadDockMode === 'focus' ? 'Open All to browse quieter history.' : 'Start or restore a conversation to begin.'}</p>
        </div>
      )}

      {/* Thread list */}
      {!sessionsLoading && dockThreads.length > 0 && (
        <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-0.5">
              {pinned.length > 0 && (
                <>
                  <DockSection label="Pinned" threads={pinned} selectedThreadId={selectedThreadId} onSelect={selectThread} hiddenSet={hiddenSet} onHide={hideThread} onUnhide={unhideThread} />
                  <div className="my-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.04)' }} />
                </>
              )}
              {groups.map((group) => (
                <DockGroupSection
                  key={group.id}
                  group={group}
                  collapsed={collapsed.get(group.id) ?? group.kind !== 'active'}
                  onToggle={() => toggleCollapse(group.id, group.kind !== 'active')}
                  selectedThreadId={selectedThreadId}
                  onSelect={selectThread}
                  hiddenSet={hiddenSet}
                  onHideThread={hideThread}
                  onHideGroup={() => hideThreads(group.threads.map((thread) => thread.id))}
                  onUnhideThread={unhideThread}
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
  hiddenSet,
  onHideThread,
  onHideGroup,
  onUnhideThread,
}: {
  group: ConversationGroup;
  collapsed: boolean;
  onToggle: () => void;
  selectedThreadId: string | null;
  onSelect: (id: string) => void;
  hiddenSet: Set<string>;
  onHideThread: (id: string) => void;
  onHideGroup: () => void;
  onUnhideThread: (id: string) => void;
}) {
  const isGroupSelected = group.threads.some((thread) => thread.id === selectedThreadId);
  const effectiveCollapsed = collapsed && !isGroupSelected;
  const headerColor = group.kind === 'active'
    ? 'rgba(96,200,160,0.72)'
    : group.kind === 'conversation'
    ? 'rgba(201,160,58,0.78)'
    : 'rgba(255,255,255,0.32)';

  const isCollapsible = group.kind !== 'active';
  const groupLabel = group.kind === 'conversation'
    ? group.reason === 'delegated'
      ? 'Delegated bundle'
      : 'Conversation bundle'
    : group.label;
  const hint = group.kind === 'conversation'
    ? group.reason === 'delegated'
      ? 'main chat + helper agent chats'
      : 'same topic, grouped together'
    : group.kind === 'active'
    ? 'not yet bundled'
    : 'separate history';

  return (
    <div
      className={cn(
        'rounded-xl transition-all duration-200',
        group.kind === 'conversation' && 'my-1 border',
        group.kind === 'conversation' && isGroupSelected && 'bg-white/[0.025]'
      )}
      style={group.kind === 'conversation' ? {
        borderColor: isGroupSelected ? 'rgba(201,160,58,0.22)' : 'rgba(255,255,255,0.055)',
        boxShadow: isGroupSelected ? 'inset 0 1px 0 rgba(255,255,255,0.045), 0 10px 28px rgba(0,0,0,0.16)' : undefined,
      } : undefined}
    >
      <button
        onClick={isCollapsible ? onToggle : undefined}
        className={cn(
          'thread-group-toggle flex items-center gap-2 w-full px-3 py-2 rounded-xl text-left text-xs font-semibold uppercase tracking-[0.18em] transition-all',
          isCollapsible ? 'hover:bg-white/[0.025] cursor-pointer' : 'cursor-default'
        )}
        style={{ color: headerColor }}
        aria-expanded={!effectiveCollapsed}
      >
        {isCollapsible && (
          <motion.span animate={{ rotate: effectiveCollapsed ? 0 : 90 }} transition={{ duration: 0.12 }} className="text-[10px] flex-shrink-0">›</motion.span>
        )}
        {group.kind === 'conversation' && (
          <span
            className="flex h-5 w-5 items-center justify-center rounded-full border text-[10px]"
            style={{ borderColor: 'rgba(201,160,58,0.24)', background: 'rgba(201,160,58,0.075)' }}
          >
            {group.icon}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate">{groupLabel}</span>
          {group.topic && group.kind === 'conversation' && (
            <PretextSmartTitle
              text={`${group.topic} · ${hint}`}
              maxWidth={210}
              maxLines={2}
              className="mt-0.5 text-[10px] font-normal normal-case tracking-normal text-ivory-dim"
            />
          )}
        </span>
        <span
          className="rounded-full border px-2 py-0.5 text-[10px] font-mono tracking-normal"
          style={{ borderColor: 'rgba(255,255,255,0.08)', color: 'var(--mb-ivory-dim)', background: 'rgba(0,0,0,0.16)' }}
        >
          {group.threads.length}
        </span>
      </button>

      {group.kind === 'conversation' && isGroupSelected && (
        <div className="flex justify-end px-2 pb-1">
          <button
            type="button"
            className="thread-mini-action"
            onClick={onHideGroup}
          >
            Tuck bundle
          </button>
        </div>
      )}

      <AnimatePresence initial={false}>
        {!effectiveCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div
              className={cn('space-y-0.5 pb-1', group.kind === 'conversation' ? 'ml-3 pl-3 border-l' : '')}
              style={group.kind === 'conversation' ? { borderColor: 'rgba(201,160,58,0.16)' } : {}}
            >
              {group.threads.map((thread, i) => (
                <motion.div
                  key={`${group.id}:${thread.id}:${i}`}
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{
                    type: 'spring',
                    stiffness: 380,
                    damping: 28,
                    mass: 0.7,
                    delay: i * 0.025,
                  }}
                >
                  <ThreadListItemWrapper
                    thread={thread}
                    isSelected={thread.id === selectedThreadId}
                    isHidden={hiddenSet.has(thread.id)}
                    onSelect={() => onSelect(thread.id)}
                    onHide={() => onHideThread(thread.id)}
                    onUnhide={() => onUnhideThread(thread.id)}
                  />
                </motion.div>
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
  hiddenSet,
  onHide,
  onUnhide,
  color = 'rgba(255,255,255,0.25)',
}: {
  label: string;
  threads: Thread[];
  selectedThreadId: string | null;
  onSelect: (id: string) => void;
  hiddenSet: Set<string>;
  onHide: (id: string) => void;
  onUnhide: (id: string) => void;
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
          isHidden={hiddenSet.has(thread.id)}
          onSelect={() => onSelect(thread.id)}
          onHide={() => onHide(thread.id)}
          onUnhide={() => onUnhide(thread.id)}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ThreadListItemWrapper — common dock item props
// ---------------------------------------------------------------------------

function ThreadListItemWrapper({
  thread,
  isSelected,
  isHidden,
  onSelect,
  onHide,
  onUnhide,
}: {
  thread: Thread;
  isSelected: boolean;
  isHidden: boolean;
  onSelect: () => void;
  onHide: () => void;
  onUnhide: () => void;
}) {
  return (
    <ThreadListItem
      thread={thread}
      isSelected={isSelected}
      onSelect={onSelect}
      childCount={thread.linkedChildren?.length ?? 0}
      isHidden={isHidden}
      onHide={onHide}
      onUnhide={onUnhide}
    />
  );
}
