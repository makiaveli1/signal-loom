'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSignalLoomStore } from '@/lib/store';
import { ThreadPane } from './thread-pane';
import { MonitorThreadPane } from './monitor-thread-pane';
import { ResizeHandle } from '@/components/ui/resize-handle';

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
              className="w-16 h-16 rounded-full flex items-center justify-center mb-4 mx-auto"
              style={{ background: 'var(--mb-elevated)' }}
            >
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="4" fill="var(--mb-teal)" opacity="0.8" />
                <circle cx="16" cy="16" r="9" stroke="var(--mb-teal)" strokeWidth="1.5" opacity="0.3" />
              </svg>
            </div>
            <p className="text-ivory-dim text-sm">Select a thread to begin</p>
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
          // Find the monitor pane and close it with animation
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
        setActivePaneById(next.id);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [workspace.panes, workspace.activePaneId, setActivePaneById]);

  const primaryPane = workspace.panes.find((p) => p.role === 'primary');
  const primaryThread = primaryPane ? threads.find((t) => t.id === primaryPane.threadId) : null;

  if (!primaryThread) {
    return <EmptyState loading={sessionsLoading} />;
  }

  const nonMonitorPanes = workspace.panes.filter((p) => p.role !== 'monitor');
  const monitorPane = workspace.panes.find((p) => p.role === 'monitor');

  return (
    /*
     * flex-1: fills the remaining height between TopBar and RuntimeStrip.
     * min-h-0: REQUIRED in a flex column — allows this element (and its flex
     *   column children) to shrink below their content size. Without this, a
     *   flex column item with height:100% will overflow rather than shrink.
     * overflow: contained at the shell level via the outer MissionShell div.
     */
    <div
      className="flex flex-1 min-h-0"
      style={{ background: 'var(--mb-carbon)' }}
    >
      {/*
       * Inner flex column: owns the pane layout. min-h-0 ensures panes
       * (flex column children) can shrink below content size.
       */}
      <div
        ref={centerRef}
        className="flex flex-1 min-h-0"
      >
        <AnimatePresence mode="popLayout">
          {workspace.panes.map((pane) => {
            const thread = threads.find((t) => t.id === pane.threadId);
            if (!thread) return null;

            const isMonitor = pane.role === 'monitor';
            // Monitor pane owns its own flex width (collapsed: 48px, expanded: 240px)
            // Non-monitor panes use widthRatio from the store
            const widthStyle = isMonitor
              ? {}
              : { width: `${pane.widthRatio * 100}%` };

            // canClose: secondary panes can always be closed;
            // monitor panes can always be closed; primary pane is never closeable
            const canClose =
              pane.role === 'secondary' ||
              pane.role === 'monitor';

            return (
              <motion.div
                key={pane.id}
                // Exit animation: when pendingCloseId is set, pane fades out.
                // After 200ms the store fires closePane and pane is removed permanently.
                animate={
                  pendingCloseId === pane.id
                    ? { opacity: 0, scale: 0.97 }
                    : { opacity: 1, scale: 1 }
                }
                transition={{ duration: 0.18, ease: 'easeIn' }}
                // No layout prop — resize handle drives width directly.
                // min-h-0: allows this flex column child to shrink below content size.
                className="flex-shrink-0 flex h-full min-h-0 overflow-hidden"
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
            );
          })}
        </AnimatePresence>

        {/* Resize handles between non-monitor panes */}
        {nonMonitorPanes.length > 1 && centerRef.current && (
          <div className="flex-shrink-0 flex h-full min-h-0">
            {nonMonitorPanes.slice(0, -1).map((paneA, idx) => {
              const paneB = nonMonitorPanes[idx + 1];
              return (
                <ResizeHandle
                  key={`handle-${paneA.id}-${paneB.id}`}
                  paneAId={paneA.id}
                  paneBId={paneB.id}
                  containerRef={centerRef}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
