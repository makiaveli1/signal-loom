'use client';

import { useSignalLoomStore } from '@/lib/store';
import { AgentCard } from './agent-card';
import { ScrollArea } from '@/components/ui/scroll-area';

export function LiveAgentRail() {
  const { agents } = useSignalLoomStore();

  return (
    <aside
      className="flex flex-col h-full border-l"
      style={{
        background: 'var(--mb-shell)',
        borderColor: 'rgba(255,255,255,0.05)',
        width: '260px',
        minWidth: '260px',
      }}
    >
      {/* Rail header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'rgba(255,255,255,0.05)' }}
      >
        <span className="text-xs font-semibold uppercase tracking-widest text-ash-muted">
          Agent Roster
        </span>
        <div className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full signal-pulse"
            style={{ background: 'var(--mb-teal)' }}
          />
          <span className="text-xs font-mono text-signal-teal">
            {agents.filter((a) => a.status === 'active').length} active
          </span>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}
