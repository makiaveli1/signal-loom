'use client';

import { useSignalLoomStore } from '@/lib/store';
import { cn } from '@/lib/utils';

export function SplitViewToggle() {
  const { splitView, setSplitView, closeSplit, setActivePane, threads } =
    useSignalLoomStore();

  // In single-pane view: show "Split" button
  if (!splitView.enabled) {
    return (
      <button
        onClick={() => setSplitView(true)}
        className="absolute bottom-20 right-4 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all duration-150 hover:scale-[1.02]"
        style={{
          background: 'var(--mb-shell)',
          borderColor: 'rgba(255,255,255,0.08)',
          color: 'var(--mb-ivory-dim)',
        }}
        title="Split view (Ctrl+\\)"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <rect x="1" y="1" width="4" height="10" rx="1" stroke="currentColor" strokeWidth="1.2" />
          <rect x="7" y="1" width="4" height="10" rx="1" stroke="currentColor" strokeWidth="1.2" />
        </svg>
        Split
      </button>
    );
  }

  // In split view: show pane switcher + close
  const primaryThread = threads.find((t) => t.id === splitView.primaryThreadId);
  const secondaryThread = threads.find((t) => t.id === splitView.secondaryThreadId);

  return (
    <div
      className="absolute bottom-20 right-4 z-10 flex items-center gap-2 px-3 py-2 rounded-lg border"
      style={{
        background: 'var(--mb-shell)',
        borderColor: 'rgba(255,255,255,0.08)',
      }}
    >
      {/* Left pane indicator */}
      <button
        onClick={() => setActivePane('left')}
        className={cn(
          'flex flex-col items-start px-2 py-1 rounded text-xs transition-all duration-100',
          splitView.activePane === 'left'
            ? 'bg-white/10 text-ivory border border-white/15'
            : 'text-ash-muted hover:text-ivory-dim'
        )}
        title="Activate left pane (Tab)"
      >
        <span className="font-semibold text-ivory truncate max-w-[120px]">
          {primaryThread?.title ?? 'Left'}
        </span>
        <span className="text-xs text-ash-muted font-mono">
          {splitView.activePane === 'left' ? '● active' : 'left'}
        </span>
      </button>

      {/* Divider */}
      <div className="w-px h-8 bg-white/10" />

      {/* Right pane indicator */}
      <button
        onClick={() => setActivePane('right')}
        className={cn(
          'flex flex-col items-start px-2 py-1 rounded text-xs transition-all duration-100',
          splitView.activePane === 'right'
            ? 'bg-white/10 text-ivory border border-white/15'
            : 'text-ash-muted hover:text-ivory-dim'
        )}
        title="Activate right pane (Tab)"
      >
        <span className="font-semibold text-ivory truncate max-w-[120px]">
          {secondaryThread?.title ?? 'Right'}
        </span>
        <span className="text-xs text-ash-muted font-mono">
          {splitView.activePane === 'right' ? '● active' : 'right'}
        </span>
      </button>

      {/* Close split */}
      <button
        onClick={closeSplit}
        className="ml-1 text-ash-muted hover:text-ivory transition-colors p-1 rounded"
        title="Close split (Esc)"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
