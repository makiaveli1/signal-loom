'use client';

import type { Thread } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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

export function ThreadHeader({ thread }: { thread: Thread }) {
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
