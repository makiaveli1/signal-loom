'use client';

import { useSignalLoomStore } from '@/lib/store';

export function RuntimeStrip() {
  const { runtime, healthLoading } = useSignalLoomStore();

  const browserLaneDots = Array.from({ length: 4 }, (_, i) => i < runtime.browserLanes);

  return (
    <footer
      role="contentinfo"
      aria-label="Runtime health status"
      className="flex items-center justify-between px-4 py-2 border-t text-xs font-mono gap-6"
      style={{
        background: 'var(--mb-shell)',
        borderColor: 'rgba(255,255,255,0.05)',
        color: 'var(--mb-ash)',
      }}
    >
      {/* Left — system health */}
      <div className="flex items-center gap-5">
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

      {/* Center — browser lanes */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span style={{ color: 'var(--mb-ash-muted)' }}>Browser</span>
        <div className="flex items-center gap-1.5" title={`${runtime.browserLanes} of 4 browser lanes active`}>
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
          {runtime.browserLanes}/4 lanes
        </span>
        {!runtime.canvasEnabled && (
          <span style={{ color: 'var(--mb-ash-muted)', fontSize: '10px' }}>· canvas off</span>
        )}
      </div>

      {/* Right — issues */}
      <div className="flex items-center gap-3 flex-shrink-0">
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
          <span style={{ color: 'var(--mb-jade)' }}>All systems nominal</span>
        )}
      </div>
    </footer>
  );
}
