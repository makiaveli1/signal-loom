'use client';

import { useSignalLoomStore } from '@/lib/store';

export function RuntimeStrip() {
  const { runtime, healthLoading } = useSignalLoomStore();

  const systemHealthy = runtime.gateway === 'healthy' && runtime.queue === 'healthy' && runtime.heartbeatFreshness === 'fresh';

  return (
    <footer
      role="contentinfo"
      aria-label="Runtime health status"
      className="runtime-strip flex min-w-0 items-center justify-between gap-3 border-t px-4 py-1 text-xs font-mono"
      style={{
        background: 'var(--sl-chrome)',
        borderColor: 'var(--sl-divider)',
        color: 'var(--sl-text-subtle)',
      }}
    >
      {/* Left — one calm system readout; details live in the title tooltip. */}
      <div className="runtime-health flex min-w-0 flex-shrink-0 items-center gap-2">
        <span
          className={`runtime-health-pill inline-flex items-center gap-2 px-2 py-0.5 ${systemHealthy ? 'is-healthy' : 'is-degraded'}`}
          title={`Gateway ${runtime.gateway} · queue ${runtime.queue} · heartbeat ${runtime.heartbeatFreshness}`}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: systemHealthy ? 'var(--sl-success)' : 'var(--sl-danger)' }} />
          {healthLoading ? 'Checking' : systemHealthy ? 'Healthy' : 'Degraded'}
        </span>
      </div>

      {/* Center — intentionally quiet: active session is already visible in the thread header. */}
      <div className="runtime-session min-w-0 flex-1" aria-hidden="true" />

      {/* Right — issues */}
      <div className="runtime-issues flex min-w-0 flex-shrink-0 items-center justify-end gap-3">
        {runtime.issueCount > 0 ? (
          <div className="flex items-center gap-2">
            <span
              className="runtime-issue-pill flex items-center gap-1.5 px-2 py-0.5 text-xs"
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
                className="runtime-issue-description text-ash-muted text-xs"
                style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {runtime.issueDescription}
              </span>
            )}
          </div>
        ) : (
          <span className="text-ash-muted">{runtime.browserLanes}/4 lanes</span>
        )}
      </div>
    </footer>
  );
}
