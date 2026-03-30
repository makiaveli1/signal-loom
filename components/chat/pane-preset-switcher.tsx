'use client';

import { useSignalLoomStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import type { WorkspacePreset } from '@/lib/types';

const PRESETS: { id: WorkspacePreset; label: string; icon: React.ReactNode }[] = [
  {
    id: 'focus',
    label: 'Focus',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    id: 'duo',
    label: 'Duo',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <rect x="1" y="1" width="5.5" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
        <rect x="7.5" y="1" width="5.5" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    id: 'duo_monitor',
    label: 'Duo+Mon',
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
    label: 'Operator',
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

  return (
    <div
      className="flex items-center gap-1 px-2 py-1.5 rounded-lg border"
      style={{
        background: 'var(--mb-shell)',
        borderColor: 'rgba(255,255,255,0.06)',
      }}
    >
      {PRESETS.map((preset) => (
        <button
          key={preset.id}
          onClick={() => setPreset(preset.id)}
          title={preset.label}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono transition-all duration-150',
            workspace.preset === preset.id
              ? 'text-ivory border'
              : 'text-ash-muted hover:text-ivory-dim'
          )}
          style={
            workspace.preset === preset.id
              ? {
                  background: 'rgba(255,255,255,0.07)',
                  borderColor: 'rgba(255,255,255,0.12)',
                  color: 'var(--mb-ivory)',
                }
              : undefined
          }
        >
          {preset.icon}
          <span>{preset.label}</span>
        </button>
      ))}
    </div>
  );
}
