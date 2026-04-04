'use client';

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
  /** Number of child sessions delegated from this session (from DelegationEvent.childSessionIds) */
  delegationCount?: number;
  /** Sprint 8: Callback to open a child session in the secondary pane */
  onOpenChildSession?: (childId: string) => void;
}) {
  const { childToParentMap, threads } = useSignalLoomStore();

  // Sprint 8: If this is a child session, find the parent title for "↙ Working for" label
  const parentSessionId = childToParentMap[thread.id];
  const parentThread = parentSessionId ? threads.find((t) => t.id === parentSessionId) : null;
  const statusColor = STATUS_COLORS[thread.status];

  return (
    <div
      className="flex items-center justify-between px-4 py-3 border-b"
      style={{
        background: 'var(--mb-shell)',
        borderColor: 'rgba(255,255,255,0.05)',
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <h1
          className="text-sm font-semibold text-ivory truncate"
        >
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
        {thread.hasApproval && (
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

      {/* Linked agents */}
      {thread.linkedAgents.length > 0 && (
        <div className="flex items-center gap-1.5">
          {thread.linkedAgents.map((agentId) => (
            <AgentChip key={agentId} agentId={agentId} />
          ))}
        </div>
      )}

      {/* Sprint 8: Delegation count badge */}
      {delegationCount != null && delegationCount > 0 && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {onOpenChildSession ? (
            <button
              onClick={() => {
                // Open the first child session — find it via thread.linkedChildren[0]
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
          )}
        </div>
      )}

      {/* Sprint 8: "↙ Working for" label — shown on child sessions */}
      {parentThread && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
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
        </div>
      )}
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
      className={cn("text-xs font-mono px-2 py-0.5 rounded-full border")}
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
