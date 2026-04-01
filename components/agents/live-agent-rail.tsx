'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSignalLoomStore } from '@/lib/store';
import { AgentCard } from './agent-card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Agent } from '@/lib/types';

const HERMES_ID = 'hermes';

export function LiveAgentRail() {
  const { agents, toggleEmailComposer } = useSignalLoomStore();
  const [idleExpanded, setIdleExpanded] = useState(true);

  const visible = agents.filter(
    (a) => a.status === 'active' || a.status === 'waiting' || a.status === 'blocked'
  );
  const idleAgents = agents.filter((a) => a.status === 'idle' || a.status === 'done');

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
            className="w-1.5 h-1.5 rounded-full signal-pulse flex-shrink-0"
            style={{ background: 'var(--mb-teal)' }}
          />
          <span className="text-xs font-mono text-signal-teal">
            {agents.filter((a) => a.status === 'active').length} active
          </span>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {/* Honest empty state — no agents derived from real sessions */}
          {agents.length === 0 && (
            <div className="py-6 px-2 text-center">
              <p className="text-xs text-ash-muted italic">
                No active agents — Nero is running solo.
              </p>
              <p className="text-xs text-ash-dimmed mt-1">
                Refresh sessions to see live agent status.
              </p>
            </div>
          )}

          {/* Always-visible: active, waiting, blocked */}
          {visible.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onClick={agent.id === HERMES_ID ? toggleEmailComposer : undefined}
            />
          ))}

          {/* Idle/done collapsible section */}
          {idleAgents.length > 0 && (
            <CollapsibleIdleSection
              agents={idleAgents}
              expanded={idleExpanded}
              onToggle={() => setIdleExpanded((v) => !v)}
              toggleEmailComposer={toggleEmailComposer}
            />
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}

function CollapsibleIdleSection({
  agents,
  expanded,
  onToggle,
  toggleEmailComposer,
}: {
  agents: Agent[];
  expanded: boolean;
  onToggle: () => void;
  toggleEmailComposer: () => void;
}) {
  return (
    <div>
      {/* Section header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-1 py-1.5 text-xs font-mono text-ash-muted hover:text-ivory-dim transition-colors duration-150 rounded"
      >
        <span className="flex items-center gap-1.5">
          <svg
            width="8"
            height="8"
            viewBox="0 0 8 8"
            fill="none"
            className={cn(
              'transition-transform duration-200',
              expanded && 'rotate-90'
            )}
          >
            <path d="M2 1L6 4L2 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Idle
          <span
            className="rounded px-1 py-0.5 text-xs font-semibold"
            style={{
              background: 'rgba(255,255,255,0.06)',
              color: 'var(--mb-ash)',
              fontSize: '9px',
            }}
          >
            {agents.length}
          </span>
        </span>
      </button>

      {/* Collapsible agent list */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="idle-agents"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 pt-1">
              {agents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onClick={agent.id === HERMES_ID ? toggleEmailComposer : undefined}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
