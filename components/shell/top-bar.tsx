'use client';

import { Badge } from '@/components/ui/badge';
import { useSignalLoomStore } from '@/lib/store';
import { cn } from '@/lib/utils';

export function TopBar() {
  const { runtime, approvals, approvalsPanelOpen, toggleApprovalsPanel, agents, hermesCommandCenterOpen, toggleHermesCommandCenter, hermesSettingsOpen, toggleHermesSettings } = useSignalLoomStore();

  const pendingApprovals = approvals.filter(
    (a) => a.status === undefined || a.status === 'pending'
  ).length;
  const totalPending = pendingApprovals;
  const approvalBreakdown = pendingApprovals > 0
    ? `${pendingApprovals} action${pendingApprovals === 1 ? '' : 's'}`
    : '';
  const activeLanes = agents.filter((a) => a.status === 'active').length;
  const systemHealthy = runtime.gateway === 'healthy' && runtime.queue === 'healthy' && runtime.heartbeatFreshness === 'fresh';

  return (
    <header
      className="flex items-center justify-between gap-4 px-4 py-2.5 border-b"
      style={{ background: 'var(--sl-shell)', borderColor: 'var(--sl-border-soft)' }}
      role="banner"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <svg
            width="26"
            height="26"
            viewBox="0 0 26 26"
            fill="none"
            aria-hidden="true"
            className="signal-mark flex-shrink-0"
          >
            <circle cx="13" cy="13" r="3" fill="var(--sl-accent)" opacity="0.92" />
            <circle cx="13" cy="13" r="7" stroke="var(--sl-accent)" strokeWidth="1.4" opacity="0.42" />
            <circle cx="13" cy="13" r="11" stroke="var(--sl-decision)" strokeWidth="0.9" opacity="0.24" />
            <path d="M2 13H7M19 13H24" stroke="var(--sl-danger)" strokeWidth="1.6" strokeLinecap="round" opacity="0.82" />
            <path d="M13 2V6M13 20V24" stroke="var(--sl-accent)" strokeWidth="1.1" strokeLinecap="round" opacity="0.45" />
          </svg>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="font-semibold text-sm tracking-wide text-ivory truncate">Signal Loom</span>
              <span className="text-[10px] uppercase tracking-[0.24em] text-brass hidden sm:inline">
                Nero Chair
              </span>
            </div>
            <div className="text-[10px] font-mono text-ash hidden md:block">
              Your Hermes workspace · chats, tools, approvals
            </div>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex min-w-0 items-center justify-center" aria-label="Hermes runtime summary">
        <span
          className={cn(
            'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-mono transition-colors',
            systemHealthy
              ? 'border-emerald-300/15 bg-emerald-300/[0.045] text-emerald-200/80'
              : 'border-rust/25 bg-rust/10 text-rust'
          )}
          title={`Gateway ${runtime.gateway} · queue ${runtime.queue} · heartbeat ${runtime.heartbeatFreshness}`}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: systemHealthy ? 'var(--mb-jade)' : 'var(--mb-rust)' }} />
          {systemHealthy ? 'Hermes healthy' : 'Hermes needs attention'}
          <span className="text-ash-muted">·</span>
          <span className="text-ash">{activeLanes} live lane{activeLanes === 1 ? '' : 's'}</span>
        </span>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={toggleHermesCommandCenter}
          aria-pressed={hermesCommandCenterOpen}
          aria-label="Open command palette"
          className={cn(
            'hidden sm:flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-150',
            hermesCommandCenterOpen
              ? 'border-signal-teal/35 bg-signal-teal-glow text-signal-teal shadow-[0_0_18px_rgba(61,201,196,0.12)]'
              : 'border-white/10 bg-white/[0.03] text-ivory-dim hover:border-signal-teal/30 hover:text-signal-teal'
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-signal-teal signal-pulse" aria-hidden="true" />
          Command
        </button>
        <button
          type="button"
          onClick={toggleHermesSettings}
          aria-pressed={hermesSettingsOpen}
          aria-label="Open Hermes settings"
          className={cn(
            'hidden md:flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-150',
            hermesSettingsOpen
              ? 'border-brass/35 bg-brass-dim text-brass shadow-[0_0_18px_rgba(201,160,58,0.12)]'
              : 'border-white/10 bg-white/[0.03] text-ivory-dim hover:border-brass/30 hover:text-brass'
          )}
        >
          <span aria-hidden="true">⚙</span>
          Settings
        </button>
        <button
          onClick={toggleApprovalsPanel}
          aria-pressed={approvalsPanelOpen}
          aria-label={totalPending > 0 ? `${totalPending} approval item${totalPending === 1 ? '' : 's'} waiting: ${approvalBreakdown}` : 'Open approvals queue'}
          title={totalPending > 0 ? approvalBreakdown : 'Open approvals queue'}
          className={cn(
            'top-review-button top-approvals-button flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 border',
            approvalsPanelOpen
              ? 'bg-brass-dim text-brass border-brass/35 shadow-[0_0_18px_rgba(201,160,58,0.12)]'
              : totalPending > 0
                ? 'bg-brass-dim/70 text-brass border-brass/25 hover:border-brass/40'
                : 'bg-graphite/80 text-ivory-dim border-white/5 hover:text-ivory hover:border-white/10'
          )}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M6 1L7.5 4.5L11 5L8.5 7.5L9 11L6 9.5L3 11L3.5 7.5L1 5L4.5 4.5L6 1Z"
              fill={approvalsPanelOpen || totalPending > 0 ? 'var(--sl-decision)' : 'var(--sl-text-subtle)'} />
          </svg>
          Approvals
          {approvalBreakdown && (
            <span className="hidden xl:inline text-[10px] font-mono opacity-75">
              {approvalBreakdown}
            </span>
          )}
          {totalPending > 0 && (
            <Badge
              variant="outline"
              className="text-xs font-mono min-w-5 h-5 justify-center rounded-full"
              style={{ borderColor: 'var(--sl-decision)', color: 'var(--sl-decision)', background: 'color-mix(in srgb, var(--sl-bg) 72%, transparent)' }}
            >
              {totalPending}
            </Badge>
          )}
        </button>
      </div>
    </header>
  );
}
