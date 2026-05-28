'use client';

import { Badge } from '@/components/ui/badge';
import { useSignalLoomStore } from '@/lib/store';
import { cn } from '@/lib/utils';

export function TopBar() {
  const { runtime, approvals, approvalsPanelOpen, toggleApprovalsPanel, emailGates, agents, hermesCommandCenterOpen, toggleHermesCommandCenter, hermesSettingsOpen, toggleHermesSettings } = useSignalLoomStore();

  const pendingApprovals = approvals.filter(
    (a) => a.status === undefined || a.status === 'pending'
  ).length;
  const pendingEmailGates = emailGates.filter(
    (g) => g.gateStatus === 'needs_review' || g.gateStatus === 'ready_for_approval'
  ).length;
  const totalPending = pendingApprovals + pendingEmailGates;
  const activeLanes = agents.filter((a) => a.status === 'active').length;

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
            className="flex-shrink-0"
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

      <div className="hidden lg:flex items-center gap-2 min-w-0" aria-label="Hermes runtime health">
        <InstrumentChip label="Gateway" status={runtime.gateway} />
        <InstrumentChip label="Queue" status={runtime.queue} />
        <InstrumentChip label="Heartbeat" status={runtime.heartbeatFreshness === 'fresh' ? 'fresh' : 'stale'} />
        <span className="h-4 w-px bg-white/10" aria-hidden="true" />
        <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] font-mono text-signal-teal">
          <span className="w-1.5 h-1.5 rounded-full bg-signal-teal signal-pulse" />
          {activeLanes} agent{activeLanes === 1 ? '' : 's'} active
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
          aria-label={totalPending > 0 ? `${totalPending} item${totalPending === 1 ? '' : 's'} waiting for review` : 'Open review queue'}
          className={cn(
            'top-review-button flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 border',
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
          Review
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

function InstrumentChip({ label, status }: { label: string; status: string }) {
  const healthy = status === 'healthy' || status === 'fresh';
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/15 px-2 py-1 text-[11px] font-mono">
      <span
        className={cn('w-1.5 h-1.5 rounded-full', healthy && 'signal-pulse')}
        style={{ background: healthy ? 'var(--mb-jade)' : 'var(--mb-rust)' }}
      />
      <span className="text-ash">{label}</span>
      <span style={{ color: healthy ? 'var(--mb-jade)' : 'var(--mb-rust)' }}>{status}</span>
    </span>
  );
}
