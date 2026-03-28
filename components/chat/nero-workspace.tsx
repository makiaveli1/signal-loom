'use client';

import { useEffect } from 'react';
import { useSignalLoomStore } from '@/lib/store';
import { ThreadPane } from './thread-pane';

function EmptyState() {
  return (
    <main
      className="flex flex-col flex-1 items-center justify-center relative"
      style={{ background: 'var(--mb-carbon)' }}
    >
      <div className="text-center">
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
      </div>
    </main>
  );
}

export function NeroWorkspace() {
  const {
    threads,
    selectedThreadId,
    splitView,
    setActivePane,
    closeSplit,
  } = useSignalLoomStore();

  // Keyboard handling: Tab or Ctrl+` switches pane, Escape closes split
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!splitView.enabled) return;

      if (e.key === 'Escape') {
        closeSplit();
        return;
      }

      if (e.key === 'Tab' || e.key === '`') {
        e.preventDefault();
        setActivePane(splitView.activePane === 'left' ? 'right' : 'left');
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [splitView.enabled, splitView.activePane, closeSplit, setActivePane]);

  const primaryThread = threads.find((t) => t.id === splitView.primaryThreadId);
  const secondaryThread = threads.find((t) => t.id === splitView.secondaryThreadId);

  if (!primaryThread) {
    return <EmptyState />;
  }

  // Split view active — two panes side by side
  if (splitView.enabled) {
    return (
      <div
        className="flex flex-1 min-w-0 overflow-hidden relative"
        style={{ background: 'var(--mb-carbon)' }}
      >
        {/* Left pane */}
        <ThreadPane
          thread={primaryThread}
          isActive={splitView.activePane === 'left'}
          isSplit={true}
          onSetActive={() => setActivePane('left')}
          onClose={closeSplit}
          showDelegationTimeline={true}
        />

        {/* Vertical divider */}
        <div
          className="w-px flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.05)' }}
        />

        {/* Right pane */}
        <ThreadPane
          thread={secondaryThread ?? primaryThread}
          isActive={splitView.activePane === 'right'}
          isSplit={true}
          onSetActive={() => setActivePane('right')}
          onClose={closeSplit}
          showDelegationTimeline={true}
        />
      </div>
    );
  }

  // Single-pane view
  return (
    <div
      className="flex flex-col flex-1 min-w-0 relative"
      style={{ background: 'var(--mb-carbon)' }}
    >
      <ThreadPane
        thread={primaryThread}
        isActive={true}
        isSplit={false}
        onSetActive={() => {}}
        showDelegationTimeline={false}
      />
    </div>
  );
}
