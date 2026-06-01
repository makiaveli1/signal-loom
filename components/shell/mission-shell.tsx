'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { TopBar } from './top-bar';
import { RuntimeStrip } from './runtime-strip';
import { HermesCommandCenter } from './hermes-command-center';
import { HermesSettingsPanel } from './hermes-settings-panel';
import { ThreadDock } from '../threads/thread-dock';
import { NeroWorkspace } from '../chat/nero-workspace';
import { LiveAgentRail } from '../agents/live-agent-rail';
import { ApprovalsPanel } from '../approvals/approvals-panel';
import { ShellResizeHandle } from '@/components/ui/shell-resize-handle';
import { useSignalLoomStore } from '@/lib/store';
import { applySignalTheme, getStoredSignalTheme, persistSignalTheme, SIGNAL_THEMES, type SignalThemeId } from '@/lib/theme';

const LAYOUT_STORAGE_KEY = 'signal-loom-layout-v3';
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

type ShellLayoutState = {
  signalWidth: number;
  laneWidth: number;
  signalsOpen: boolean;
  lanesOpen: boolean;
};

const DEFAULT_LAYOUT: ShellLayoutState = {
  signalWidth: 292,
  laneWidth: 300,
  signalsOpen: false,
  lanesOpen: false,
};

export function MissionShell() {
  const {
    loadSessions,
    loadAgents,
    loadApprovals,
    loadRuntimeHealth,
    hydrateHiddenThreads,
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
    loadSessions();
    loadAgents();
    loadApprovals();
    loadRuntimeHealth();

    const interval = setInterval(loadRuntimeHealth, 30_000);
    return () => clearInterval(interval);
  }, [loadSessions, loadAgents, loadApprovals, loadRuntimeHealth, hydrateHiddenThreads]);

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
        className="signal-loom-shell flex min-w-0 flex-col"
        style={{
          background: 'var(--sl-shell-gradient)',
          height: '100dvh',
          overflow: 'hidden',
        }}
      >
        {/* Shell header */}
        <div className="flex-shrink-0">
          <TopBar />
        </div>

        {/* Main content area */}
        <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden" style={{ height: '100%' }}>
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
}: {
  signalsOpen: boolean;
  lanesOpen: boolean;
  themeId: SignalThemeId;
  onThemeChange: (themeId: SignalThemeId) => void;
  onToggleSignals: () => void;
  onToggleLanes: () => void;
  onReset: () => void;
}) {
  const menuRef = useRef<HTMLDetailsElement | null>(null);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const selectedTheme = SIGNAL_THEMES.find((theme) => theme.id === themeId) ?? SIGNAL_THEMES[0];
  const selectedThemeIndex = Math.max(0, SIGNAL_THEMES.findIndex((theme) => theme.id === themeId));

  useEffect(() => {
    if (!themeMenuOpen) return;

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setThemeMenuOpen(false);
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && menuRef.current?.contains(target)) return;
      setThemeMenuOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [themeMenuOpen]);

  const moveThemeSelection = (direction: 1 | -1) => {
    const nextIndex = (selectedThemeIndex + direction + SIGNAL_THEMES.length) % SIGNAL_THEMES.length;
    onThemeChange(SIGNAL_THEMES[nextIndex].id);
  };

  const handleThemeKeyDown = (event: KeyboardEvent<HTMLButtonElement>, themeIndex: number) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      moveThemeSelection(1);
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveThemeSelection(-1);
    }
    if (event.key === 'Home') {
      event.preventDefault();
      onThemeChange(SIGNAL_THEMES[0].id);
    }
    if (event.key === 'End') {
      event.preventDefault();
      onThemeChange(SIGNAL_THEMES[SIGNAL_THEMES.length - 1].id);
    }
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      onThemeChange(SIGNAL_THEMES[themeIndex].id);
    }
  };

  return (
    <div className="layout-utility-bar calm-workbench-bar flex items-center justify-between gap-3 border-b px-3 py-2 sm:px-4" role="toolbar" aria-label="Workspace layout controls">
      <div className="layout-workbench-title min-w-0">
        <span className="layout-signal-dot" aria-hidden="true" />
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.16em] text-ash-muted">
            <span>Workspace</span>
            <span className="theme-current-chip" title={selectedTheme.intent}>{selectedTheme.shortLabel}</span>
          </div>
          <p className="hidden truncate text-[11px] text-ash sm:block">
            Clean chat surface · rails and theme are tucked into intentional controls
          </p>
        </div>
      </div>

      <div className="layout-workbench-actions flex flex-shrink-0 items-center justify-end gap-1.5">
        <button type="button" onClick={onToggleSignals} className="layout-pill rail-toggle" aria-pressed={signalsOpen} aria-label={`${signalsOpen ? 'Hide' : 'Show'} Loom rail`}>
          <span className="rail-toggle-dot" aria-hidden="true" />
          Loom
        </button>
        <button type="button" onClick={onToggleLanes} className="layout-pill rail-toggle" aria-pressed={lanesOpen} aria-label={`${lanesOpen ? 'Hide' : 'Show'} Live Lanes rail`}>
          <span className="rail-toggle-dot" aria-hidden="true" />
          Lanes
        </button>

        <details ref={menuRef} className="layout-menu" open={themeMenuOpen} onToggle={(event) => setThemeMenuOpen(event.currentTarget.open)}>
          <summary className="layout-pill layout-menu-summary">
            View
            <span className="hidden sm:inline">· {selectedTheme.shortLabel}</span>
          </summary>
          <div className="layout-menu-panel" role="group" aria-label="View and theme controls">
            <div className="layout-menu-section">
              <div className="theme-board-header">
                <span className="layout-menu-label">Theme board</span>
                <span className="theme-board-current">{selectedTheme.label}</span>
              </div>
              <div className="theme-board" role="radiogroup" aria-label="Signal Loom theme">
                {SIGNAL_THEMES.map((theme, themeIndex) => {
                  const isSelected = theme.id === themeId;
                  const previewStyle = {
                    '--theme-canvas': theme.preview.canvas,
                    '--theme-surface': theme.preview.surface,
                    '--theme-accent': theme.preview.accent,
                    '--theme-decision': theme.preview.decision,
                    '--theme-danger': theme.preview.danger,
                  } as CSSProperties;

                  return (
                    <button
                      key={theme.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={`${theme.label}: ${theme.intent} Control ${theme.control}, depth ${theme.depth}, rhythm ${theme.rhythm}. ${theme.description}`}
                      title={`${theme.intent} ${theme.description}`}
                      tabIndex={isSelected ? 0 : -1}
                      onClick={() => onThemeChange(theme.id)}
                      onKeyDown={(event) => handleThemeKeyDown(event, themeIndex)}
                      className="theme-card theme-calibration boxed-corner-mark"
                      data-theme-texture={theme.texture}
                      data-theme-control={theme.control}
                      data-theme-depth={theme.depth}
                      data-theme-tone={theme.tone}
                      style={previewStyle}
                    >
                      <span className="theme-card-preview" aria-hidden="true">
                        <span className="theme-card-canvas" />
                        <span className="theme-card-panel theme-card-panel-main" />
                        <span className="theme-card-panel theme-card-panel-side" />
                        <span className="theme-card-route" />
                        <span className="theme-card-alert" />
                      </span>
                      <span className="theme-card-copy">
                        <span className="theme-card-title">{theme.shortLabel}</span>
                        <span className="theme-card-intent">{theme.intent}</span>
                      </span>
                      <span className="theme-card-meta" aria-hidden="true">
                        <span>{theme.control}</span>
                        <span>{theme.depth}</span>
                        <span>{theme.rhythm}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="layout-menu-footer">
              <span>{selectedTheme.intent}</span>
              <button type="button" onClick={() => { onReset(); setThemeMenuOpen(false); }} className="layout-pill subdued" aria-label="Reset layout">
                Reset layout
              </button>
            </div>
          </div>
        </details>
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
      className={`collapsed-rail-tab collapsed-rail-tab-${side} flex h-full w-11 flex-shrink-0 items-center justify-center border-x text-[11px] font-semibold uppercase tracking-[0.18em] text-ash transition-colors hover:text-ivory`}
      title={`Show ${label} rail`}
      aria-label={`Show ${label} rail`}
    >
      <span className={side === 'left' ? '-rotate-90' : 'rotate-90'}>
        {shortcut}
      </span>
    </button>
  );
}
