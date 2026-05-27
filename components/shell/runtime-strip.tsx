'use client';

import { useSignalLoomStore } from '@/lib/store';

export function RuntimeStrip() {
  const { runtime, healthLoading, selectedThreadId, threads } = useSignalLoomStore();

  const activeThread = threads.find((t) => t.id === selectedThreadId);
  const activeSessionTitle = activeThread?.session?.title ?? activeThread?.title ?? null;

  const browserLaneDots = Array.from({ length: 4 }, (_, i) => i < runtime.browserLanes);

  return (
    <footer
      role="contentinfo"
      aria-label="Runtime health status"
      className="runtime-strip flex min-w-0 items-center justify-between gap-3 border-t px-4 py-2 text-xs font-mono"
      style={{
        background: 'var(--mb-shell)',
        borderColor: 'rgba(255,255,255,0.05)',
        color: 'var(--mb-ash)',
      }}
    >
      {/* Left — system health */}
      <div className="runtime-health flex min-w-0 flex-shrink-0 items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span style={{ color: 'var(--mb-ash-muted)' }}>Gateway</span>
          <span
            style={{
              color: healthLoading
                ? 'var(--mb-brass)'
                : runtime.gateway === 'healthy'
                  ? 'var(--mb-jade)'
                  : 'var(--mb-rust)',
            }}
          >
            {healthLoading ? 'Checking…' : runtime.gateway}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span style={{ color: 'var(--mb-ash-muted)' }}>Queue</span>
          <span style={{ color: runtime.queue === 'healthy' ? 'var(--mb-jade)' : 'var(--mb-rust)' }}>
            {runtime.queue}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span style={{ color: 'var(--mb-ash-muted)' }}>Heartbeat</span>
          <span style={{ color: runtime.heartbeatFreshness === 'fresh' ? 'var(--mb-jade)' : 'var(--mb-rust)' }}>
            {runtime.heartbeatFreshness}
          </span>
        </div>
      </div>

      {/* Center — active agents/tools */}
      <div className="runtime-lanes hidden flex-shrink-0 items-center gap-2 xl:flex">
        <span style={{ color: 'var(--mb-ash-muted)' }}>Active agents</span>
        <div className="flex items-center gap-1.5" title={`${runtime.browserLanes} of 4 agent/tool lanes active`}>
          {browserLaneDots.map((active, i) => (
            <span
              key={i}
              className="w-2 h-2 rounded-sm transition-all duration-200"
              style={{
                background: active ? 'var(--mb-teal)' : 'var(--mb-graphite)',
                boxShadow: active ? '0 0 6px var(--mb-teal-glow)' : 'none',
              }}
            />
          ))}
        </div>
        <span style={{ color: 'var(--mb-ash-muted)' }}>
          {runtime.browserLanes}/4 active
        </span>
        {!runtime.canvasEnabled && (
          <span style={{ color: 'var(--mb-ash-muted)', fontSize: '10px' }}>· visual workspace off</span>
        )}
      </div>

      {/* Sprint 8: active session indicator */}
      <div className="runtime-session flex min-w-0 flex-1 items-center justify-center gap-3">
        {activeSessionTitle ? (
          <div
            className="runtime-session-chip flex min-w-0 items-center gap-1.5 rounded px-2 py-0.5 text-xs"
            style={{
              background: 'rgba(155,141,200,0.08)',
              border: '1px solid rgba(155,141,200,0.20)',
              color: 'var(--mb-ivory-dim)',
            }}
            title={`Active session: ${activeSessionTitle}`}
          >
            {/* Small monitor icon */}
            <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <circle cx="6" cy="6" r="2.5" stroke="#9b8dc8" strokeWidth="1.2" fill="none" />
              <path
                d="M1 6C2 3.5 4 2 6 2s4 1.5 5 4c-1 2.5-3 4-5 4S2 8.5 1 6z"
                stroke="#9b8dc8"
                strokeWidth="1.2"
                fill="none"
                strokeLinejoin="round"
              />
            </svg>
            <span className="runtime-session-title truncate" style={{ color: '#9b8dc8' }}>
              {activeSessionTitle}
            </span>
          </div>
        ) : (
          <span className="text-xs text-ash-muted" style={{ color: 'var(--mb-ash-muted)' }}>
            No session selected
          </span>
        )}
      </div>

      {/* Right — issues */}
      <div className="runtime-issues flex min-w-0 flex-shrink-0 items-center justify-end gap-3">
        {runtime.issueCount > 0 ? (
          <div className="flex items-center gap-2">
            <span
              className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs"
              style={{ background: 'rgba(196,90,58,0.15)', color: 'var(--mb-rust)' }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.5" />
                <path d="M5 3v2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="5" cy="7" r="0.75" fill="currentColor" />
              </svg>
              {runtime.issueCount} issue{runtime.issueCount > 1 ? 's' : ''}
            </span>
            {runtime.issueDescription && (
              <span
                className="text-ash-muted text-xs"
                style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {runtime.issueDescription}
              </span>
            )}
          </div>
        ) : (
          <span style={{ color: 'var(--mb-jade)' }}>Healthy</span>
        )}
      </div>
    </footer>
  );
}
