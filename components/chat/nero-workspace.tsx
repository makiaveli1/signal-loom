'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSignalLoomStore } from '@/lib/store';
import { ThreadPane } from './thread-pane';
import { MonitorThreadPane } from './monitor-thread-pane';
import { ResizeHandle } from '@/components/ui/resize-handle';
import type { Pane } from '@/lib/types';

function EmptyState({ loading }: { loading?: boolean }) {
  return (
    <main
      className="flex flex-col flex-1 items-center justify-center relative"
      style={{ background: 'var(--mb-carbon)' }}
    >
      <div className="text-center">
        {loading ? (
          <>
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-4 mx-auto"
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
          <>
            <div
              className="w-20 h-20 rounded-[1.75rem] flex items-center justify-center mb-5 mx-auto border"
              style={{
                background: 'radial-gradient(circle at 50% 35%, var(--mb-teal-glow), transparent 62%), var(--mb-elevated)',
                borderColor: 'var(--sl-border-soft)',
                boxShadow: 'var(--sl-shadow-panel)',
              }}
            >
              <svg width="42" height="42" viewBox="0 0 42 42" fill="none" aria-hidden="true">
                <circle cx="21" cy="21" r="4" fill="var(--mb-teal)" opacity="0.9" />
                <circle cx="21" cy="21" r="11" stroke="var(--mb-teal)" strokeWidth="1.2" opacity="0.38" />
                <path d="M7 22C14 14 28 14 35 22" stroke="var(--mb-brass)" strokeWidth="1.2" opacity="0.55" strokeLinecap="round" />
                <path d="M7 28C14 20 28 20 35 28" stroke="var(--mb-red)" strokeWidth="1.2" opacity="0.45" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-ivory text-base font-semibold tracking-tight">Choose a signal to resume</p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-ash">
              Open the Loom, review queued decisions, or use Command to start a fresh Hermes run.
            </p>
          </>
        )}
      </div>
    </main>
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

  // Keyboard handling: Tab cycles active pane, Escape closes monitor pane
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (workspace.panes.some((p) => p.role === 'monitor')) {
          const monitor = workspace.panes.find((p) => p.role === 'monitor');
          if (monitor) setPendingCloseId(monitor.id);
        }
        return;
      }
      if (e.key === 'Tab' || e.key === '`') {
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
