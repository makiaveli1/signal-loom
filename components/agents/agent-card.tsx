'use client';

import { cn } from '@/lib/utils';
import type { Agent } from '@/lib/types';
import { getAgentLaneMeta } from '@/lib/agents';

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
  const laneMeta = getAgentLaneMeta(agent.id);
  const stateVerb = laneMeta?.stateVerb ?? statusCfg.label;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'group relative w-full overflow-hidden rounded-xl border p-3 text-left transition-all duration-200 disabled:cursor-default',
        onClick && 'cursor-pointer hover:-translate-y-0.5 active:translate-y-0',
        !isActive && 'hover:bg-elevated/40'
      )}
      style={{
        background: isActive
          ? `linear-gradient(135deg, ${agent.accentColor}10 0%, var(--mb-panel) 45%, rgba(0,0,0,0.12) 100%)`
          : 'var(--mb-panel)',
        borderColor: isActive ? `${agent.accentColor}42` : 'rgba(255,255,255,0.06)',
        boxShadow: isActive
          ? `0 0 22px ${agent.accentColor}10, inset 3px 0 0 ${agent.accentColor}`
          : 'inset 3px 0 0 rgba(255,255,255,0.05)',
        transitionProperty: 'box-shadow, border-color, background, transform',
      }}
      title={onClick ? `${laneMeta?.visualName ?? agent.name}: open lane controls` : laneMeta?.visualName ?? agent.name}
    >
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-start gap-2 min-w-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{
              background: `${agent.accentColor}18`,
              color: agent.accentColor,
              border: `1px solid ${agent.accentColor}34`,
              boxShadow: isActive ? `0 0 14px ${agent.accentColor}16` : undefined,
            }}
            aria-hidden="true"
          >
            {agent.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: agent.accentColor }}>
                {laneMeta?.visualName ?? agent.name}
              </p>
            </div>
            <p className="mt-0.5 text-[10px] font-mono uppercase tracking-[0.18em] text-ash">
              {laneMeta?.laneName ?? agent.role}
            </p>
          </div>
        </div>

        <span
          className="flex items-center gap-1 text-[10px] font-mono flex-shrink-0"
          style={{ color: statusCfg.color }}
        >
          <span
            className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', isActive && 'signal-pulse')}
            style={{ background: statusCfg.color, opacity: isActive ? 1 : 0.5 }}
          />
          {statusCfg.label}
        </span>
      </div>

      <p
        className="text-xs text-ivory-dim leading-snug mb-2.5"
        style={{
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {agent.taskPreview}
      </p>

      <div className="flex items-center justify-between gap-2 border-t border-white/5 pt-2">
        <span className="text-[10px] font-mono" style={{ color: agent.accentColor }}>
          {stateVerb}
        </span>
        <span className="text-[10px] text-ash truncate" title={laneMeta?.outputLabel ?? agent.role}>
          {laneMeta?.outputLabel ?? agent.role}
        </span>
        {agent.browserEnabled && (
          <span className="flex-shrink-0" title="Browser lane active" aria-label="Browser lane active">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <rect x="1" y="2" width="10" height="7" rx="1.5" stroke="var(--mb-teal)" strokeWidth="1.2" opacity="0.7" />
              <path d="M4 9.5h4" stroke="var(--mb-teal)" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
              <circle cx="6" cy="5" r="1" fill="var(--mb-teal)" opacity="0.5" />
            </svg>
          </span>
        )}
      </div>
    </button>
  );
}
