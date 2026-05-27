'use client';

import { useCallback, useEffect, useState } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { TopBar } from './top-bar';
import { RuntimeStrip } from './runtime-strip';
import { HermesCommandCenter } from './hermes-command-center';
import { HermesSettingsPanel } from './hermes-settings-panel';
import { ThreadDock } from '../threads/thread-dock';
import { NeroWorkspace } from '../chat/nero-workspace';
import { LiveAgentRail } from '../agents/live-agent-rail';
import { ApprovalsPanel } from '../approvals/approvals-panel';
import { HermesEmailComposer } from '../agents/hermes-email-composer';
import { ShellResizeHandle } from '@/components/ui/shell-resize-handle';
import { useSignalLoomStore } from '@/lib/store';
import { applySignalTheme, getStoredSignalTheme, persistSignalTheme, SIGNAL_THEMES, type SignalThemeId } from '@/lib/theme';
import { approveEmailGate, denyEmailGate, reviseEmailGate } from '@/lib/openclaw/adapter/email-gate';
import type { EmailGate } from '@/lib/openclaw/adapter/types';

const LAYOUT_STORAGE_KEY = 'signal-loom-layout-v2';
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

type ShellLayoutState = {
  signalWidth: number;
  laneWidth: number;
  composerWidth: number;
  signalsOpen: boolean;
  lanesOpen: boolean;
};

const DEFAULT_LAYOUT: ShellLayoutState = {
  signalWidth: 292,
  laneWidth: 300,
  composerWidth: 400,
  signalsOpen: true,
  lanesOpen: true,
};

export function MissionShell() {
  const {
    emailComposerOpen,
    emailGates,
    updateEmailGate,
    sendEmail,
    loadSessions,
    loadAgents,
    loadApprovals,
    loadRuntimeHealth,
    initEmailGates,
    hydrateHiddenThreads,
    toggleHermesCommandCenter,
    toggleHermesSettings,
  } = useSignalLoomStore();

  const [layout, setLayout] = useState<ShellLayoutState>(DEFAULT_LAYOUT);
  const [themeId, setThemeId] = useState<SignalThemeId>('midnight-broadcast');
  const [isCompactShell, setIsCompactShell] = useState(false);

  useEffect(() => {
    const storedTheme = getStoredSignalTheme();
    applySignalTheme(storedTheme);
    queueMicrotask(() => setThemeId(storedTheme));
  }, []);

  const changeTheme = useCallback((nextTheme: SignalThemeId) => {
    setThemeId(nextTheme);
    applySignalTheme(nextTheme);
    persistSignalTheme(nextTheme);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 900px)');
    const syncCompactState = () => {
      const compact = mediaQuery.matches;
      queueMicrotask(() => {
        setIsCompactShell(compact);
        if (compact) {
          setLayout((current) => {
            if (!current.signalsOpen && !current.lanesOpen) return current;
            return { ...current, signalsOpen: false, lanesOpen: false };
          });
        }
      });
    };

    syncCompactState();
    mediaQuery.addEventListener('change', syncCompactState);
    return () => mediaQuery.removeEventListener('change', syncCompactState);
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as Partial<ShellLayoutState>;
      const compactNow = window.matchMedia('(max-width: 900px)').matches;

      queueMicrotask(() => {
        setLayout({
          signalWidth: clamp(parsed.signalWidth ?? DEFAULT_LAYOUT.signalWidth, 220, 420),
          laneWidth: clamp(parsed.laneWidth ?? DEFAULT_LAYOUT.laneWidth, 220, 440),
          composerWidth: clamp(parsed.composerWidth ?? DEFAULT_LAYOUT.composerWidth, 320, 560),
          signalsOpen: compactNow ? false : parsed.signalsOpen ?? DEFAULT_LAYOUT.signalsOpen,
          lanesOpen: compactNow ? false : parsed.lanesOpen ?? DEFAULT_LAYOUT.lanesOpen,
        });
      });
    } catch {
      window.localStorage.removeItem(LAYOUT_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  }, [layout]);

  const updateLayout = useCallback((patch: Partial<ShellLayoutState>) => {
    setLayout((current) => ({ ...current, ...patch }));
  }, []);

  // Load real data on mount.
  // Sessions are loaded via /api/openclaw/sessions (Next.js API route) — not via
  // the adapter's gatewayFetch which fails from browser (relative URL → Next.js → 404).
  useEffect(() => {
    hydrateHiddenThreads();
    initEmailGates();
    loadSessions();
    loadAgents();
    loadApprovals();
    loadRuntimeHealth();

    const interval = setInterval(loadRuntimeHealth, 30_000);
    return () => clearInterval(interval);
  }, [loadSessions, loadAgents, loadApprovals, loadRuntimeHealth, initEmailGates, hydrateHiddenThreads]);

  const resetLayout = useCallback(() => {
    setLayout(isCompactShell ? { ...DEFAULT_LAYOUT, signalsOpen: false, lanesOpen: false } : DEFAULT_LAYOUT);
  }, [isCompactShell]);

  const toggleSignals = useCallback(() => {
    setLayout((current) => ({
      ...current,
      signalsOpen: !current.signalsOpen,
      lanesOpen: isCompactShell && !current.signalsOpen ? false : current.lanesOpen,
    }));
  }, [isCompactShell]);

  const toggleLanes = useCallback(() => {
    setLayout((current) => ({
      ...current,
      lanesOpen: !current.lanesOpen,
      signalsOpen: isCompactShell && !current.lanesOpen ? false : current.signalsOpen,
    }));
  }, [isCompactShell]);

  const inlineSignalsOpen = layout.signalsOpen && !isCompactShell;
  const inlineLanesOpen = layout.lanesOpen && !isCompactShell;
  const compactDrawerOpen = isCompactShell && (layout.signalsOpen || layout.lanesOpen);

  return (
    <TooltipProvider>
      <div
        className="signal-loom-shell flex flex-col"
        style={{
          background: 'var(--mb-carbon)',
          height: '100dvh',
          overflow: 'hidden',
        }}
      >
        {/* Shell header */}
        <div className="flex-shrink-0">
          <TopBar />
        </div>

        {/* Main content area */}
        <div className="relative flex min-h-0 flex-1" style={{ height: '100%' }}>
          {compactDrawerOpen && (
            <button
              type="button"
              className="mobile-shell-backdrop"
              aria-label="Close mobile rail drawer"
              onClick={() => updateLayout({ signalsOpen: false, lanesOpen: false })}
            />
          )}

          {isCompactShell && layout.signalsOpen && (
            <div className="mobile-shell-drawer mobile-shell-drawer-left">
              <ThreadDock
                width={Math.min(layout.signalWidth, 320)}
                onCollapse={() => updateLayout({ signalsOpen: false })}
              />
            </div>
          )}

          {isCompactShell && layout.lanesOpen && (
            <div className="mobile-shell-drawer mobile-shell-drawer-right">
              <LiveAgentRail
                width={Math.min(layout.laneWidth, 320)}
                onCollapse={() => updateLayout({ lanesOpen: false })}
              />
            </div>
          )}

          {/* Thread dock — left */}
          {inlineSignalsOpen ? (
            <>
              <ThreadDock
                width={layout.signalWidth}
                onCollapse={() => updateLayout({ signalsOpen: false })}
              />
              <ShellResizeHandle
                ariaLabel="Resize chat list"
                onDrag={(deltaX) => updateLayout({ signalWidth: clamp(layout.signalWidth + deltaX, 220, 420) })}
                onReset={() => updateLayout({ signalWidth: DEFAULT_LAYOUT.signalWidth })}
              />
            </>
          ) : !isCompactShell ? (
            <CollapsedRailTab
              label="Loom"
              shortcut="Loom"
              side="left"
              onClick={() => updateLayout({ signalsOpen: true })}
            />
          ) : null}

          {/* Chat workspace — center */}
          <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
            <LayoutUtilityBar
              signalsOpen={layout.signalsOpen}
              lanesOpen={layout.lanesOpen}
              themeId={themeId}
              onThemeChange={changeTheme}
              onToggleSignals={toggleSignals}
              onToggleLanes={toggleLanes}
              onReset={resetLayout}
              onOpenHermesCommand={toggleHermesCommandCenter}
              onOpenHermesSettings={toggleHermesSettings}
            />
            <NeroWorkspace />
          </div>

          {/* Live agent rail — right */}
          {inlineLanesOpen ? (
            <>
              <ShellResizeHandle
                ariaLabel="Resize agent list"
                side="right"
                onDrag={(deltaX) => updateLayout({ laneWidth: clamp(layout.laneWidth + deltaX, 220, 440) })}
                onReset={() => updateLayout({ laneWidth: DEFAULT_LAYOUT.laneWidth })}
              />
              <LiveAgentRail
                width={layout.laneWidth}
                onCollapse={() => updateLayout({ lanesOpen: false })}
              />
            </>
          ) : !isCompactShell ? (
            <CollapsedRailTab
              label="Live Lanes"
              shortcut="Lanes"
              side="right"
              onClick={() => updateLayout({ lanesOpen: true })}
            />
          ) : null}

          {/* Approvals panel — slides in from right */}
          <ApprovalsPanel />
          <HermesCommandCenter />
          <HermesSettingsPanel />

          {/* Email draft review — slides in from right when opened */}
          {emailComposerOpen && (
            <>
              <ShellResizeHandle
                ariaLabel="Resize email draft review"
                side="right"
                onDrag={(deltaX) => updateLayout({ composerWidth: clamp(layout.composerWidth + deltaX, 320, 560) })}
                onReset={() => updateLayout({ composerWidth: DEFAULT_LAYOUT.composerWidth })}
              />
              <div
                className="flex flex-col h-full border-l"
                style={{
                  background: 'var(--mb-shell)',
                  borderColor: 'rgba(255,255,255,0.05)',
                  width: `${layout.composerWidth}px`,
                  minWidth: `${Math.min(layout.composerWidth, 360)}px`,
                }}
              >
                {/* Composer header */}
                <div
                  className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
                  style={{ borderColor: 'rgba(255,255,255,0.05)' }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-ivory">Email drafts</span>
                    <span className="text-xs text-ash-muted">Review before sending</span>
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-ash-muted">
                    drag the edge to resize
                  </span>
                </div>
                {/* Composer body */}
                <div className="flex-1 min-h-0">
                  <HermesEmailComposer
                    gates={emailGates}
                    onApproved={(gate: EmailGate) => {
                      const updated = approveEmailGate(gate);
                      updateEmailGate(updated);
                    }}
                    onDenied={(gate: EmailGate) => {
                      const updated = denyEmailGate(gate);
                      updateEmailGate(updated);
                    }}
                    onRevised={(gate: EmailGate, revised) => {
                      const updated = reviseEmailGate(gate, revised);
                      updateEmailGate(updated);
                    }}
                    onSend={(gate: EmailGate) => {
                      sendEmail(gate.id);
                    }}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Runtime health strip */}
        <div className="flex-shrink-0">
          <RuntimeStrip />
        </div>
      </div>
    </TooltipProvider>
  );
}

function LayoutUtilityBar({
  signalsOpen,
  lanesOpen,
  themeId,
  onThemeChange,
  onToggleSignals,
  onToggleLanes,
  onReset,
  onOpenHermesCommand,
  onOpenHermesSettings,
}: {
  signalsOpen: boolean;
  lanesOpen: boolean;
  themeId: SignalThemeId;
  onThemeChange: (themeId: SignalThemeId) => void;
  onToggleSignals: () => void;
  onToggleLanes: () => void;
  onReset: () => void;
  onOpenHermesCommand: () => void;
  onOpenHermesSettings: () => void;
}) {
  const selectedTheme = SIGNAL_THEMES.find((theme) => theme.id === themeId) ?? SIGNAL_THEMES[0];

  return (
    <div className="layout-utility-bar flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 sm:gap-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-ash-muted">
        <span className="layout-drag-dot" aria-hidden="true" />
        <span>View</span>
        <span className="hidden text-ash sm:inline normal-case tracking-normal">tuck rails, change theme, keep the stage clean</span>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <div className="theme-swatch-group desktop-theme-swatch-group" role="radiogroup" aria-label="Signal Loom theme">
          {SIGNAL_THEMES.map((theme) => {
            const isSelected = theme.id === themeId;
            return (
              <button
                key={theme.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={`${theme.label}: ${theme.description}`}
                title={theme.description}
                onClick={() => onThemeChange(theme.id)}
                className="theme-swatch-pill"
              >
                <span className="theme-swatch-stack" aria-hidden="true">
                  {theme.preview.map((color) => (
                    <span key={color} className="theme-swatch-dot" style={{ background: color }} />
                  ))}
                </span>
                <span className="theme-swatch-label">{theme.label}</span>
              </button>
            );
          })}
        </div>
        <label className="mobile-theme-select">
          <span>Theme</span>
          <select
            aria-label="Signal Loom theme"
            value={themeId}
            onChange={(event) => onThemeChange(event.currentTarget.value as SignalThemeId)}
          >
            {SIGNAL_THEMES.map((theme) => (
              <option key={theme.id} value={theme.id}>{theme.label}</option>
            ))}
          </select>
          <strong>{selectedTheme.label}</strong>
        </label>
        <button type="button" onClick={onToggleSignals} className="layout-pill" aria-pressed={signalsOpen}>
          {signalsOpen ? 'Tuck Loom' : 'Open Loom'}
        </button>
        <button type="button" onClick={onToggleLanes} className="layout-pill" aria-pressed={lanesOpen}>
          {lanesOpen ? 'Tuck Lanes' : 'Open Lanes'}
        </button>
        <button type="button" onClick={onReset} className="layout-pill subdued">
          Reset
        </button>
        <button type="button" onClick={onOpenHermesCommand} className="layout-pill command" aria-label="Open command center">
          <span className="hidden sm:inline">Command</span><span className="sm:hidden">Cmd</span>
        </button>
        <button type="button" onClick={onOpenHermesSettings} className="layout-pill command" aria-label="Open Hermes settings">
          <span className="hidden sm:inline">Settings</span><span className="sm:hidden">Set</span>
        </button>
      </div>
    </div>
  );
}

function CollapsedRailTab({
  label,
  shortcut,
  side,
  onClick,
}: {
  label: string;
  shortcut: string;
  side: 'left' | 'right';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="collapsed-rail-tab flex h-full w-10 flex-shrink-0 items-center justify-center border-x text-[10px] font-semibold uppercase tracking-[0.22em] text-ash transition-colors hover:text-ivory"
      style={{ borderColor: 'rgba(255,255,255,0.055)' }}
      title={`Show ${label} rail`}
      aria-label={`Show ${label} rail`}
    >
      <span className={side === 'left' ? '-rotate-90' : 'rotate-90'}>
        {shortcut}
      </span>
    </button>
  );
}
