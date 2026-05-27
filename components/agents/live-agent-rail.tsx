'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSignalLoomStore } from '@/lib/store';
import { AgentCard } from './agent-card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Agent } from '@/lib/types';

const HERMES_ID = 'hermes';

export function LiveAgentRail({ width = 280, onCollapse }: { width?: number; onCollapse?: () => void }) {
  const { agents, toggleEmailComposer } = useSignalLoomStore();
  const [idleExpanded, setIdleExpanded] = useState(true);

  const visible = agents.filter(
    (a) => a.status === 'active' || a.status === 'waiting' || a.status === 'blocked'
  );
  const idleAgents = agents.filter((a) => a.status === 'idle' || a.status === 'done');
  const activeCount = agents.filter((a) => a.status === 'active').length;
  const waitingCount = agents.filter((a) => a.status === 'waiting' || a.status === 'blocked').length;

  return (
    <aside
      className="flex flex-col h-full border-l"
      style={{
        background: 'linear-gradient(180deg, var(--mb-shell) 0%, rgba(12,14,18,0.96) 100%)',
        borderColor: 'rgba(255,255,255,0.05)',
        width: `${width}px`,
        minWidth: '220px',
        maxWidth: '440px',
      }}
      aria-label="Hermes agent list"
    >
      <div
        className="px-4 py-3 border-b"
        style={{ borderColor: 'rgba(255,255,255,0.05)' }}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-brass">
              Live Lanes
            </span>
            <p className="mt-1 text-[11px] text-ash leading-tight">
              Helper agents working on tasks
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right font-mono text-[10px] text-ash">
              <div className="text-signal-teal">{activeCount} active</div>
              <div>{waitingCount} waiting</div>
            </div>
            {onCollapse && (
              <button
                type="button"
                onClick={onCollapse}
                className="rounded-md border border-white/10 px-1.5 py-1 text-[10px] text-ash transition-colors hover:text-ivory"
                title="Collapse Live Lanes"
                aria-label="Collapse Live Lanes"
              >
                ›
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
        <ScrollArea className="flex-1">
          <div className="p-2.5 space-y-2">
            {agents.length === 0 && (
              <div className="py-7 px-3 text-center rounded-xl border border-white/5 bg-black/10">
                <p className="text-xs text-ivory-dim font-medium">No helper agents active.</p>
                <p className="text-xs text-ash mt-1 leading-relaxed">
                  When work is delegated, helper agents appear here.
                </p>
              </div>
            )}

            {visible.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onClick={agent.id === HERMES_ID ? toggleEmailComposer : undefined}
              />
            ))}

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
      </div>
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
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-1 py-1.5 text-xs font-mono text-ash hover:text-ivory-dim transition-colors duration-150 rounded"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-1.5">
          <svg
            width="8"
            height="8"
            viewBox="0 0 8 8"
            fill="none"
            className={cn('transition-transform duration-200', expanded && 'rotate-90')}
            aria-hidden="true"
          >
            <path d="M2 1L6 4L2 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Idle agents
          <span
            className="rounded px-1 py-0.5 text-xs font-semibold"
            style={{
              background: 'rgba(255,255,255,0.06)',
              color: 'var(--mb-ivory-dim)',
              fontSize: '9px',
            }}
          >
            {agents.length}
          </span>
        </span>
      </button>

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
