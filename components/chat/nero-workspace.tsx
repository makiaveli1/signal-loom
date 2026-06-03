'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSignalLoomStore } from '@/lib/store';
import { ThreadPane } from './thread-pane';
import { MonitorThreadPane } from './monitor-thread-pane';
import { DegradedState } from '@/components/ui/degraded-state';
import { ResizeHandle } from '@/components/ui/resize-handle';
import type { Pane } from '@/lib/types';

function EmptyState({ loading }: { loading?: boolean }) {
  return (
    <div
      className="flex flex-col flex-1 items-center justify-center relative"
      style={{ background: 'var(--mb-carbon)' }}
    >
      <div className="text-center">
        {loading ? (
          <>
            <div
              className="mb-4 mx-auto flex h-16 w-16 items-center justify-center rounded-[var(--sl-radius-card)]"
              style={{ background: 'var(--mb-elevated)' }}
            >
              <div
                className="w-5 h-5 rounded-full border-2 animate-spin"
                style={{ borderColor: 'rgba(255,255,255,0.1)', borderTopColor: 'var(--mb-teal)' }}
              />
            </div>
            <p className="text-ivory-dim text-sm">Loading sessions…</p>
          </>
        ) : (
          <DegradedState
            eyebrow={loading ? 'Loading' : 'No active thread'}
            title={loading ? 'Loading sessions…' : 'Choose a signal to resume'}
            detail={loading ? 'Signal Loom is fetching local Hermes sessions. No send path is implied until the connection gate says it is ready.' : 'Open the Loom, review queued decisions, or use Command to start a fresh Hermes run. Local-only drafts stay local until you send.'}
            tone={loading ? 'warn' : 'neutral'}
          />
        )}
      </div>
    </div>
  );
}

export function NeroWorkspace() {
  const {
    threads,
    workspace,
    selectedThreadId,
    setActivePaneById,
    closePane,
    sessionsLoading,
  } = useSignalLoomStore();

  // Tracks pane that is mid-exit-animation — once animation starts, pane fades out
  // before closePane fires to remove it from the store.
  const [pendingCloseId, setPendingCloseId] = useState<string | null>(null);

  const centerRef = useRef<HTMLDivElement>(null);

  // After the exit animation plays, remove the pane from the store
  useEffect(() => {
    if (pendingCloseId === null) return;
    const timer = setTimeout(() => {
      closePane(pendingCloseId);
      setPendingCloseId(null);
    }, 200); // matches exit transition duration
    return () => clearTimeout(timer);
  }, [pendingCloseId, closePane]);

  // Keyboard handling: keep normal Tab navigation intact. Pane cycling is a
  // power shortcut, not a focus trap.
  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      return !!target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]');
    };

    const handler = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if (e.key === 'Escape') {
        if (workspace.panes.some((p) => p.role === 'monitor')) {
          const monitor = workspace.panes.find((p) => p.role === 'monitor');
          if (monitor) setPendingCloseId(monitor.id);
        }
        return;
      }
      const wantsPaneCycle = (e.key === '`' && (e.metaKey || e.ctrlKey)) || (e.key === 'Tab' && (e.metaKey || e.ctrlKey));
      if (wantsPaneCycle) {
        e.preventDefault();
        const panes = workspace.panes;
        const idx = panes.findIndex((p) => p.id === workspace.activePaneId);
        const next = panes[(idx + 1) % panes.length];
        if (next) setActivePaneById(next.id);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [workspace.panes, workspace.activePaneId, setActivePaneById]);

  const primaryPane = workspace.panes.find((p) => p.role === 'primary');
  // Resolve primary thread: prefer selectedThreadId (canonical for real sessions),
  // fall back to primaryPane.threadId (for initial mock-thread state).
  const primaryThread =
    (selectedThreadId && threads.find((t) => t.id === selectedThreadId)) ??
    (primaryPane && threads.find((t) => t.id === primaryPane.threadId)) ??
    null;

  if (!primaryThread) {
    return <EmptyState loading={sessionsLoading} />;
  }

  const nonMonitorPanes = workspace.panes.filter((p) => p.role !== 'monitor');

  const renderPane = (pane: Pane) => {
    const thread = threads.find((t) => t.id === pane.threadId);
    if (!thread) return null;

    const isMonitor = pane.role === 'monitor';
    const widthStyle = isMonitor ? {} : { width: `${pane.widthRatio * 100}%` };
    const canClose = pane.role === 'secondary' || pane.role === 'monitor';
    const nonMonitorIndex = nonMonitorPanes.findIndex((p) => p.id === pane.id);
    const nextNonMonitor = !isMonitor && nonMonitorIndex >= 0 ? nonMonitorPanes[nonMonitorIndex + 1] : null;

    return (
      <Fragment key={pane.id}>
        <motion.div
          animate={
            pendingCloseId === pane.id
              ? { opacity: 0, scale: 0.97 }
              : { opacity: 1, scale: 1 }
          }
          transition={{ duration: 0.18, ease: 'easeIn' }}
          className="flex h-full min-h-0 flex-shrink-0 overflow-hidden"
          style={widthStyle}
        >
          {isMonitor ? (
            <MonitorThreadPane
              thread={thread}
              isActive={pane.active}
              collapsed={workspace.monitorCollapsed}
              onExpand={() => {
                const { toggleMonitorCollapsed } = useSignalLoomStore.getState();
                toggleMonitorCollapsed();
              }}
              onActivate={() => setActivePaneById(pane.id)}
              onClose={canClose ? () => { setPendingCloseId(pane.id); } : undefined}
            />
          ) : (
            <ThreadPane
              thread={thread}
              isActive={pane.active}
              isSplit={nonMonitorPanes.length > 1}
              paneRole={pane.role}
              onSetActive={() => setActivePaneById(pane.id)}
              onClose={canClose ? () => { setPendingCloseId(pane.id); } : undefined}
              showDelegationTimeline={true}
            />
          )}
        </motion.div>

        {nextNonMonitor && (
          <ResizeHandle
            paneAId={pane.id}
            paneBId={nextNonMonitor.id}
            containerRef={centerRef}
          />
        )}
      </Fragment>
    );
  };

  return (
    <div
      className="flex flex-1 min-h-0"
      style={{ background: 'var(--mb-carbon)' }}
    >
      <div
        ref={centerRef}
        className="flex flex-1 min-h-0 overflow-hidden"
      >
        <AnimatePresence mode="popLayout">
          {workspace.panes.map(renderPane)}
        </AnimatePresence>
      </div>
    </div>
  );
}
