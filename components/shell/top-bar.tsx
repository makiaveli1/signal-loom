'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { agentIdentityFromDetection } from '@/lib/agent-identity';
import { useSignalLoomStore } from '@/lib/store';
import { buildConnectionChips, classifyDelegatedSessions, type ChipTone } from '@/lib/status-truth';
import { useHermesDetection } from '@/lib/use-hermes-detection';
import { cn } from '@/lib/utils';

type ConnectionChipListProps = {
  chips: ReturnType<typeof buildConnectionChips>;
  primaryLabel: string;
  okCount: number;
  onOpenSettings: () => void;
};

function toneClass(tone: ChipTone) {
  if (tone === 'ok') return 'border-signal-teal/25 text-signal-teal bg-signal-teal-glow';
  if (tone === 'warn') return 'border-brass/30 text-brass bg-brass-dim/60';
  if (tone === 'danger') return 'border-signal-red/30 text-signal-red bg-signal-red/10';
  return 'border-white/10 text-ash bg-white/[0.03]';
}

function ConnectionTruthPanel({ chips, primaryLabel, okCount, onOpenSettings }: ConnectionChipListProps) {
  return (
    <div className="w-[min(92vw,25rem)] rounded-3xl border border-white/10 bg-carbon/95 p-3 text-left shadow-2xl shadow-black/45 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brass">Connection truth</p>
          <h2 className="mt-1 text-sm font-semibold text-ivory">{primaryLabel}</h2>
        </div>
        <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 font-mono text-[10px] text-ash">
          {okCount}/5 checks
        </span>
      </div>
      <div className="mt-3 grid gap-2">
        {chips.map((chip) => (
          <div key={chip.id} className="rounded-2xl border border-white/8 bg-black/18 p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-ivory-dim">{chip.label}</span>
              <span className={cn('rounded-full border px-2 py-0.5 font-mono text-[10px]', toneClass(chip.tone))}>
                {chip.tone}
              </span>
            </div>
            <p className="mt-1 break-words font-mono text-[11px] leading-5 text-ash">{chip.detail}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/8 bg-white/[0.025] p-2.5">
        <p className="max-w-[15rem] text-[11px] leading-5 text-ash">
          This shows runtime truth only. Tokens are never shown here.
        </p>
        <button
          type="button"
          onClick={onOpenSettings}
          className="min-h-10 rounded-full border border-brass/30 bg-brass-dim px-3 text-xs font-semibold text-brass transition hover:-translate-y-0.5 hover:border-brass/50"
        >
          Open Settings
        </button>
      </div>
    </div>
  );
}

export function TopBar() {
  const {
    runtime,
    approvals,
    approvalsPanelOpen,
    toggleApprovalsPanel,
    agents,
    sessions,
    runtimeActivities,
    liveConnected,
    hermesCommandCenterOpen,
    toggleHermesCommandCenter,
    hermesSettingsOpen,
    toggleHermesSettings,
  } = useSignalLoomStore();
  const { detection, loading: detectionLoading } = useHermesDetection({ pollMs: 60_000 });
  const agentIdentity = agentIdentityFromDetection(detection?.identity);
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const topBarRef = useRef<HTMLElement | null>(null);

  const pendingApprovals = approvals.filter(
    (a) => a.status === undefined || a.status === 'pending'
  ).length;
  const totalPending = pendingApprovals;
  const approvalBreakdown = pendingApprovals > 0
    ? `${pendingApprovals} action${pendingApprovals === 1 ? '' : 's'}`
    : '';
  const delegated = useMemo(
    () => classifyDelegatedSessions({ sessions, runtimeActivities }),
    [sessions, runtimeActivities]
  );
  const runningLaneCount = agents.filter((a) => a.status === 'active').length + delegated.runningNow.length;
  const watchLaneCount = delegated.createdEmpty.length + delegated.recentlyDelegated.length;
  const connectionChips = useMemo(
    () => buildConnectionChips({ runtime, detection, liveConnected }),
    [runtime, detection, liveConnected]
  );
  const primaryIssue = detectionLoading || !detection
    ? undefined
    : connectionChips.find((chip) => chip.tone === 'danger') ?? connectionChips.find((chip) => chip.tone === 'warn');
  const connectionHealthy = !detectionLoading && Boolean(detection) && connectionChips.every((chip) => chip.tone === 'ok');
  const connectionLabel = detectionLoading || !detection ? 'Checking Hermes' : primaryIssue?.label ?? 'Hermes connected';
  const okCount = connectionChips.filter((chip) => chip.tone === 'ok').length;

  const openSettings = () => {
    setConnectionOpen(false);
    setMobileMenuOpen(false);
    if (!hermesSettingsOpen) toggleHermesSettings();
  };

  const openCommandCenter = () => {
    setConnectionOpen(false);
    setMobileMenuOpen(false);
    if (!hermesCommandCenterOpen) toggleHermesCommandCenter();
  };

  const openApprovals = () => {
    setConnectionOpen(false);
    setMobileMenuOpen(false);
    if (!approvalsPanelOpen) toggleApprovalsPanel();
  };

  useEffect(() => {
    if (!connectionOpen && !mobileMenuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setConnectionOpen(false);
        setMobileMenuOpen(false);
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && topBarRef.current?.contains(target)) return;
      setConnectionOpen(false);
      setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [connectionOpen, mobileMenuOpen]);

  return (
    <header
      ref={topBarRef}
      className="shell-top-bar relative flex items-center justify-between gap-4 border-b px-4 py-2.5"
      style={{ background: 'var(--sl-chrome)', borderColor: 'var(--sl-divider)' }}
      role="banner"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
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
                {agentIdentity.name} {agentIdentity.roleLabel}
              </span>
            </div>
            <div className="text-[10px] font-mono text-ash hidden md:block">
              Your Hermes workspace · chats, tools, approvals
            </div>
          </div>
        </div>
      </div>

      <div className="relative hidden min-w-0 items-center justify-center lg:flex" aria-label="Hermes connection summary">
        <button
          type="button"
          onClick={() => setConnectionOpen((open) => !open)}
          aria-haspopup="dialog"
          aria-expanded={connectionOpen}
          aria-controls="connection-truth-popover"
          aria-label={`${connectionOpen ? 'Close' : 'Open'} Hermes connection truth: ${connectionLabel}`}
          className={cn(
            'inline-flex max-w-[56vw] items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-mono transition-colors',
            connectionHealthy
              ? 'border-emerald-300/15 bg-emerald-300/[0.045] text-emerald-200/80 hover:border-emerald-300/25'
              : 'border-brass/25 bg-brass/10 text-brass hover:border-brass/40'
          )}
          title={connectionChips.map((chip) => `${chip.label}: ${chip.detail}`).join(' · ')}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: connectionHealthy ? 'var(--mb-jade)' : 'var(--sl-decision)' }} />
          <span>{connectionLabel}</span>
          <span className="text-ash-muted">·</span>
          <span className="text-ash">{runningLaneCount} running</span>
          {watchLaneCount > 0 && (
            <>
              <span className="text-ash-muted">·</span>
              <span className="text-ash">{watchLaneCount} watching</span>
            </>
          )}
          <span className="hidden text-ash-muted xl:inline">·</span>
          <span className="hidden text-ash xl:inline">{okCount}/5 checks</span>
        </button>
        {connectionOpen && (
          <div id="connection-truth-popover" role="dialog" aria-label="Hermes connection truth" className="absolute left-1/2 top-[calc(100%+0.65rem)] z-50 -translate-x-1/2">
            <ConnectionTruthPanel chips={connectionChips} primaryLabel={connectionLabel} okCount={okCount} onOpenSettings={openSettings} />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={openCommandCenter}
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
          onClick={openSettings}
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
          type="button"
          onClick={openApprovals}
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
          <span className="top-approvals-label">Approvals</span>
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
        <div className="relative md:hidden">
          <button
            type="button"
            onClick={() => {
              setConnectionOpen(false);
              setMobileMenuOpen((open) => !open);
            }}
            aria-haspopup="menu"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-signal-menu"
            aria-label={`${mobileMenuOpen ? 'Close' : 'Open'} Signal Loom mobile actions`}
            className="top-review-button inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-ivory-dim transition hover:border-signal-teal/30 hover:text-signal-teal"
          >
            <span aria-hidden="true">☰</span>
            Menu
          </button>
          {mobileMenuOpen && (
            <div id="mobile-signal-menu" role="menu" aria-label="Signal Loom mobile actions" className="absolute right-0 top-[calc(100%+0.65rem)] z-50 w-[min(92vw,24rem)] rounded-3xl border border-white/10 bg-carbon/95 p-3 shadow-2xl shadow-black/45 backdrop-blur-xl">
              <div className="mb-3 rounded-2xl border border-white/8 bg-black/18 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brass">Hermes</span>
                  <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 font-mono text-[10px] text-ash">{okCount}/5 checks</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-ivory">{connectionLabel}</p>
                <div className="mt-2 grid gap-1.5">
                  {connectionChips.map((chip) => (
                    <div key={chip.id} className="flex items-start justify-between gap-2 rounded-xl border border-white/5 bg-white/[0.025] px-2.5 py-2">
                      <span className="text-xs font-semibold text-ivory-dim">{chip.label}</span>
                      <span className={cn('shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px]', toneClass(chip.tone))}>{chip.tone}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid gap-2">
                <button type="button" role="menuitem" onClick={openCommandCenter} className="min-h-11 rounded-2xl border border-signal-teal/20 bg-signal-teal-glow px-3 text-left text-sm font-semibold text-signal-teal">
                  Command center
                </button>
                <button type="button" role="menuitem" onClick={openSettings} className="min-h-11 rounded-2xl border border-brass/25 bg-brass-dim px-3 text-left text-sm font-semibold text-brass">
                  Connect / Settings
                </button>
                <button type="button" role="menuitem" onClick={openApprovals} className="min-h-11 rounded-2xl border border-white/10 bg-white/[0.03] px-3 text-left text-sm font-semibold text-ivory-dim">
                  Approvals {totalPending > 0 ? `· ${totalPending} waiting` : ''}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
