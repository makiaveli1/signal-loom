'use client';

import { useState } from 'react';
import type { Thread } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useSignalLoomStore } from '@/lib/store';

const STATUS_LABELS: Record<Thread['status'], string> = {
  active: 'Active',
  waiting_on_nero: 'Waiting on Nero',
  waiting_on_specialist: 'Waiting on Specialist',
  waiting_on_user: 'Waiting on You',
  blocked: 'Blocked',
  done: 'Done',
};

const STATUS_COLORS: Record<Thread['status'], string> = {
  active: 'var(--mb-teal)',
  waiting_on_nero: 'var(--mb-red)',
  waiting_on_specialist: 'var(--mb-brass)',
  waiting_on_user: 'var(--mb-violet)',
  blocked: 'var(--mb-rust)',
  done: 'var(--mb-jade)',
};

export function ThreadHeader({
  thread,
  delegationCount,
  onOpenChildSession,
}: {
  thread: Thread;
  delegationCount?: number;
  onOpenChildSession?: (childId: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const { childToParentMap, threads } = useSignalLoomStore();
  const parentSessionId = childToParentMap[thread.id];
  const parentThread = parentSessionId ? threads.find((t) => t.id === parentSessionId) : null;
  const statusColor = STATUS_COLORS[thread.status];

  const hasDelegation = (delegationCount ?? 0) > 0;
  const hasLinkedAgents = thread.linkedAgents.length > 0;
  const hasApproval = thread.hasApproval;
  const hasParent = !!parentThread;

  return (
    <div
      className="flex flex-col"
      style={{
        background: 'var(--mb-shell)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {/* Always-visible header strip */}
      <div
        className={cn(
          'flex items-center justify-between px-4 transition-all duration-200',
          collapsed ? 'py-2' : 'py-3'
        )}
      >
        {/* Left: toggle + title + core badges */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded transition-all duration-150 hover:bg-white/[0.06] active:scale-95 sm:h-6 sm:w-6"
            style={{ color: 'var(--mb-ash)' }}
            title={collapsed ? 'Expand thread header' : 'Collapse header — give more room to chat'}
            aria-label={collapsed ? 'Expand thread header' : 'Collapse thread header'}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              className={cn('transition-transform duration-200', !collapsed && 'rotate-90deg')}
            >
              <path d="M3 2L7 5L3 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <h1 className="text-sm font-semibold text-ivory truncate">
            {thread.title}
          </h1>

          <Badge
            variant="outline"
            className="flex-shrink-0 text-xs font-mono"
            style={{
              borderColor: `${statusColor}40`,
              color: statusColor,
              background: `${statusColor}10`,
            }}
          >
            {STATUS_LABELS[thread.status]}
          </Badge>

          {hasApproval && (
            <Badge
              variant="outline"
              className="flex-shrink-0 text-xs font-mono"
              style={{
                borderColor: 'rgba(201,160,58,0.4)',
                color: 'var(--mb-brass)',
                background: 'var(--mb-brass-dim)',
              }}
            >
              ▲ approval
            </Badge>
          )}
        </div>

        {/* Right: secondary badges (hidden when collapsed) */}
        {!collapsed && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {hasLinkedAgents && (
              <div className="flex items-center gap-1.5">
                {thread.linkedAgents.map((agentId) => (
                  <AgentChip key={agentId} agentId={agentId} />
                ))}
              </div>
            )}

            {hasDelegation && (
              onOpenChildSession ? (
                <button
                  onClick={() => {
                    const firstChildId = thread.linkedChildren?.[0];
                    if (firstChildId) onOpenChildSession(firstChildId);
                  }}
                  title="Open first child session"
                  className="text-xs font-mono px-2 py-0.5 rounded-full border cursor-pointer transition-all duration-100 hover:opacity-80 active:scale-95"
                  style={{
                    borderColor: 'rgba(155,141,200,0.3)',
                    color: '#9b8dc8',
                    background: 'rgba(155,141,200,0.08)',
                  }}
                >
                  {delegationCount} child{delegationCount !== 1 ? 's' : ''} ↗
                </button>
              ) : (
                <span
                  className="text-xs font-mono px-2 py-0.5 rounded-full border"
                  style={{
                    borderColor: 'rgba(155,141,200,0.3)',
                    color: '#9b8dc8',
                    background: 'rgba(155,141,200,0.08)',
                  }}
                >
                  {delegationCount} child session{delegationCount !== 1 ? 's' : ''}
                </span>
              )
            )}

            {hasParent && (
              <span
                className="text-xs font-mono px-2 py-0.5 rounded-full border"
                style={{
                  borderColor: 'rgba(58,184,200,0.3)',
                  color: '#3ab8c8',
                  background: 'rgba(58,184,200,0.08)',
                }}
                title={`Spawned from: ${parentThread.title}`}
              >
                ↙ {parentThread.title.length > 20 ? parentThread.title.slice(0, 20) + '…' : parentThread.title}
              </span>
            )}
          </div>
        )}

        {/* Collapsed: inline hints */}
        {collapsed && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-ivory-dim">Session Info</span>
            {hasDelegation && (
              <span
                className="text-[10px] font-mono px-1.5 py-0.5 rounded-full"
                style={{
                  background: 'rgba(155,141,200,0.10)',
                  border: '1px solid rgba(155,141,200,0.20)',
                  color: '#9b8dc8',
                }}
              >
                {delegationCount} delegated
              </span>
            )}
            {hasApproval && (
              <span className="text-[10px] font-mono" style={{ color: 'var(--mb-brass)' }}>
                · ▲
              </span>
            )}
            <span className="text-[10px] text-ash-muted">expand ↗</span>
          </div>
        )}
      </div>
    </div>
  );
}

const AGENT_NAMES: Record<string, string> = {
  hephaestus: 'Hephaestus',
  argus: 'Argus',
  ariadne: 'Ariadne',
  orion: 'Orion',
  hermes: 'Hermes',
};

const AGENT_COLORS: Record<string, string> = {
  hephaestus: '#e8733a',
  argus: '#c9943a',
  ariadne: '#9b8dc8',
  orion: '#3ab8c8',
  hermes: '#e8a04a',
};

function AgentChip({ agentId }: { agentId: string }) {
  const name = AGENT_NAMES[agentId] ?? agentId;
  const color = AGENT_COLORS[agentId] ?? 'var(--mb-ash)';

  return (
    <span
      className="text-xs font-mono px-2 py-0.5 rounded-full border"
      style={{
        borderColor: `${color}40`,
        color: color,
        background: `${color}10`,
      }}
    >
      {name}
    </span>
  );
}
