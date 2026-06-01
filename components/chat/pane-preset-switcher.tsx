'use client';

import { useSignalLoomStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import type { WorkspacePreset } from '@/lib/types';

const PRESETS: { id: WorkspacePreset; label: string; description: string; icon: React.ReactNode }[] = [
  {
    id: 'focus',
    label: 'Focus',
    description: 'one clean agent conversation',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    id: 'duo',
    label: 'Dual',
    description: 'compare two sessions side by side',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <rect x="1" y="1" width="5.5" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
        <rect x="7.5" y="1" width="5.5" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    id: 'duo_monitor',
    label: 'Dual + watch',
    description: 'conversation pair with a monitor strip',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <rect x="1" y="1" width="4" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
        <rect x="6" y="1" width="4" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
        <rect x="11" y="1" width="2" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
      </svg>
    ),
  },
  {
    id: 'operator',
    label: 'Ops',
    description: 'main chat plus live monitor',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <rect x="1" y="1" width="8" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
        <rect x="10" y="1" width="3" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
      </svg>
    ),
  },
];

export function PanePresetSwitcher() {
  const { workspace, setPreset } = useSignalLoomStore();
  const activePreset = PRESETS.find((preset) => preset.id === workspace.preset) ?? PRESETS[0];

  return (
    <div className="pane-mode-switcher pane-mode-switcher-quiet border-b px-4 py-1.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brass">Layout</span>
            <span className="hidden truncate text-[11px] text-ash sm:inline">{activePreset.description}</span>
          </div>
        </div>
        <details className="layout-menu pane-layout-menu">
          <summary className="view-mode-button is-active inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-mono transition-all duration-150">
            {activePreset.icon}
            <span>{activePreset.label}</span>
          </summary>
          <div className="layout-menu-panel pane-layout-panel" role="group" aria-label="Workspace layout presets">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => setPreset(preset.id)}
                title={`${preset.label}: ${preset.description}`}
                aria-pressed={workspace.preset === preset.id}
                className={cn(
                  'view-mode-button inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-mono transition-all duration-150',
                  workspace.preset === preset.id && 'is-active'
                )}
              >
                {preset.icon}
                <span>{preset.label}</span>
              </button>
            ))}
            <span className="px-1 text-[10px] text-ash-muted">Drag dividers only when you need a custom split.</span>
          </div>
        </details>
      </div>
    </div>
  );
}
