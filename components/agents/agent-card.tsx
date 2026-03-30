'use client';

import { cn } from '@/lib/utils';
import type { Agent } from '@/lib/types';

const STATUS_CONFIG: Record<Agent['status'], { label: string; color: string }> = {
  active:  { label: 'Active',  color: 'var(--mb-teal)' },
  idle:    { label: 'Idle',   color: 'var(--mb-ash)' },
  waiting: { label: 'Waiting',color: 'var(--mb-brass)' },
  done:    { label: 'Done',   color: 'var(--mb-jade)' },
  blocked: { label: 'Blocked',color: 'var(--mb-rust)' },
};

interface AgentCardProps {
  agent: Agent;
  onClick?: () => void;
}

export function AgentCard({ agent, onClick }: AgentCardProps) {
  const statusCfg = STATUS_CONFIG[agent.status];
  const isActive  = agent.status === 'active';

  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-lg border p-3 transition-all duration-200",
        isActive ? "" : "hover:bg-elevated/40",
        onClick && "cursor-pointer"
      )}
      style={{
        background: 'var(--mb-panel)',
        borderColor: isActive ? `${agent.accentColor}35` : 'transparent',
        boxShadow: isActive
          ? `0 0 20px ${agent.accentColor}12, inset 0 0 0 1px ${agent.accentColor}08`
          : 'none',
        transitionProperty: 'box-shadow, border-color, background',
      }}
    >
      {/* Header — name + status */}
      <div className="flex items-start justify-between mb-2.5">
        <div className="flex items-center gap-2">
          {/* Avatar mark */}
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{
              background: `${agent.accentColor}20`,
              color: agent.accentColor,
              border: `1px solid ${agent.accentColor}30`,
            }}
          >
            {agent.name.charAt(0)}
          </div>
          <p className="text-xs font-semibold" style={{ color: agent.accentColor }}>
            {agent.name}
          </p>
        </div>

        {/* Status + browser badge */}
        <div className="flex items-center gap-2">
          {agent.browserEnabled && (
            <span title="Browser lane active">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-label="Browser enabled">
                <rect x="1" y="2" width="10" height="7" rx="1.5" stroke="var(--mb-teal)" strokeWidth="1.2" opacity="0.7" />
                <path d="M4 9.5h4" stroke="var(--mb-teal)" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
                <circle cx="6" cy="5" r="1" fill="var(--mb-teal)" opacity="0.5" />
              </svg>
            </span>
          )}
          <span
            className="flex items-center gap-1 text-xs font-mono"
            style={{ color: statusCfg.color }}
          >
            {isActive ? (
              <span
                className="w-1.5 h-1.5 rounded-full signal-pulse flex-shrink-0"
                style={{ background: statusCfg.color }}
              />
            ) : (
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: statusCfg.color, opacity: 0.4 }}
              />
            )}
            {statusCfg.label}
          </span>
        </div>
      </div>

      {/* Task preview — primary */}
      <p
        className="text-xs text-ivory-dim leading-snug mb-2"
        style={{
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {agent.taskPreview}
      </p>

      {/* Role subtitle — de-emphasized */}
      <p className="text-xs text-ash-muted font-mono leading-tight opacity-60">
        {agent.role.split('—')[1]?.trim()}
      </p>
    </div>
  );
}
