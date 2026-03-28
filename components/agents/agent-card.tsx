'use client';

import { cn } from '@/lib/utils';
import type { Agent } from '@/lib/types';

const STATUS_CONFIG: Record<Agent['status'], { label: string; color: string }> = {
  active:     { label: 'Active',    color: 'var(--mb-teal)' },
  idle:       { label: 'Idle',     color: 'var(--mb-ash)' },
  waiting:    { label: 'Waiting',  color: 'var(--mb-brass)' },
  done:       { label: 'Done',     color: 'var(--mb-jade)' },
  blocked:    { label: 'Blocked',  color: 'var(--mb-rust)' },
};

interface AgentCardProps {
  agent: Agent;
}

export function AgentCard({ agent }: AgentCardProps) {
  const statusCfg = STATUS_CONFIG[agent.status];
  const isActive = agent.status === 'active';

  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-all duration-200",
        isActive ? "border" : "border-transparent"
      )}
      style={{
        background: 'var(--mb-panel)',
        borderColor: isActive ? `${agent.accentColor}30` : 'transparent',
        boxShadow: isActive ? `0 0 16px ${agent.accentColor}15, inset 0 0 0 1px ${agent.accentColor}08` : 'none',
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {/* Avatar mark */}
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{
              background: `${agent.accentColor}20`,
              color: agent.accentColor,
              border: `1px solid ${agent.accentColor}30`,
            }}
          >
            {agent.name.charAt(0)}
          </div>
          <div>
            <p
              className="text-xs font-semibold"
              style={{ color: agent.accentColor }}
            >
              {agent.name}
            </p>
            <p className="text-xs text-ash-muted leading-tight">
              {agent.role.split('—')[0].trim()}
            </p>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-1.5">
          {agent.browserEnabled && (
            <span
              className="text-xs"
              title="Browser lane active"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="1" y="2" width="10" height="7" rx="1.5" stroke="var(--mb-teal)" strokeWidth="1.2" />
                <path d="M4 9.5h4" stroke="var(--mb-teal)" strokeWidth="1.2" strokeLinecap="round" />
                <circle cx="6" cy="5" r="1" fill="var(--mb-teal)" opacity="0.6" />
              </svg>
            </span>
          )}
          <span
            className="flex items-center gap-1 text-xs font-mono"
            style={{ color: statusCfg.color }}
          >
            {isActive && (
              <span
                className="w-1.5 h-1.5 rounded-full signal-pulse"
                style={{ background: statusCfg.color }}
              />
            )}
            {!isActive && (
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: statusCfg.color, opacity: 0.5 }}
              />
            )}
            {statusCfg.label}
          </span>
        </div>
      </div>

      {/* Task preview */}
      <p
        className="text-xs text-ivory-dim leading-snug"
        style={{
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {agent.taskPreview}
      </p>

      {/* Role subtitle */}
      <p className="text-xs text-ash-muted font-mono mt-1.5 leading-tight">
        {agent.role.split('—')[1]?.trim()}
      </p>
    </div>
  );
}
