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
        background: 'var(--mb-shell)',
        borderColor: 'rgba(255,255,255,0.05)',
        color: 'var(--mb-ash)',
      }}
    >
      {/* Left — one calm system readout; details live in the title tooltip. */}
      <div className="runtime-health flex min-w-0 flex-shrink-0 items-center gap-2">
        <span
          className="inline-flex items-center gap-2 rounded-full border px-2 py-0.5"
          style={{
            borderColor: systemHealthy ? 'rgba(74,184,138,0.18)' : 'rgba(196,90,58,0.24)',
            background: systemHealthy ? 'rgba(74,184,138,0.045)' : 'rgba(196,90,58,0.09)',
            color: systemHealthy ? 'var(--mb-jade)' : 'var(--mb-rust)',
          }}
          title={`Gateway ${runtime.gateway} · queue ${runtime.queue} · heartbeat ${runtime.heartbeatFreshness}`}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: systemHealthy ? 'var(--mb-jade)' : 'var(--mb-rust)' }} />
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
          <span className="text-ash-muted">{runtime.browserLanes}/4 lanes</span>
        )}
      </div>
    </footer>
  );
}
