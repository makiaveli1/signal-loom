'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSignalLoomStore } from '@/lib/store';
import { AgentCard } from './agent-card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Agent } from '@/lib/types';
import type { OpenClawSession } from '@/lib/openclaw/adapter/types';

export function LiveAgentRail({ width = 280, onCollapse }: { width?: number; onCollapse?: () => void }) {
  const { agents, sessions, openChildSession } = useSignalLoomStore();
  const [idleExpanded, setIdleExpanded] = useState(true);

  const childSessions = useMemo(() => sessions
    .filter((session) => session.parentSessionId)
    .sort((a, b) => {
      const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 6), [sessions]);

  const visible = agents.filter(
    (a) => a.status === 'active' || a.status === 'waiting' || a.status === 'blocked'
  );
  const idleAgents = agents.filter((a) => a.status === 'idle' || a.status === 'done');
  const activeCount = agents.filter((a) => a.status === 'active').length + childSessions.filter((s) => s.status === 'active').length;
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
              Helper agents and delegated sessions
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right font-mono text-[10px] text-ash">
              <motion.div key={`active-${activeCount}`} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} className="text-signal-teal">
                {activeCount} active
              </motion.div>
              <motion.div key={`waiting-${waitingCount}`} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }}>
                {waitingCount} waiting
              </motion.div>
            </div>
            {onCollapse && (
              <button
                type="button"
                onClick={onCollapse}
                className="agent-rail-collapse-button rounded-md border border-white/10 px-1.5 py-1 text-[10px] text-ash transition-colors hover:text-ivory"
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
            {agents.length === 0 && childSessions.length === 0 && (
              <div className="py-7 px-3 text-center rounded-xl border border-white/5 bg-black/10">
                <p className="text-xs text-ivory-dim font-medium">No helper agents active.</p>
                <p className="text-xs text-ash mt-1 leading-relaxed">
                  When work is delegated, helper sessions appear here.
                </p>
              </div>
            )}

            {childSessions.length > 0 && (
              <section className="space-y-2">
                <div className="flex items-center justify-between px-1 text-[10px] font-mono uppercase tracking-[0.16em] text-ash">
                  <span>Delegated now</span>
                  <span className="text-brass">{childSessions.length}</span>
                </div>
                <AnimatePresence initial={false}>
                  {childSessions.map((session) => (
                    <motion.div
                      key={session.id}
                      layout
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.98 }}
                      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <SubagentSessionCard session={session} onOpen={() => openChildSession(session.id)} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </section>
            )}

            <AnimatePresence initial={false}>
              {visible.map((agent) => (
                <motion.div
                  key={agent.id}
                  layout
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                >
                  <AgentCard agent={agent} />
                </motion.div>
              ))}
            </AnimatePresence>

            {idleAgents.length > 0 && (
              <CollapsibleIdleSection
                agents={idleAgents}
                expanded={idleExpanded}
                onToggle={() => setIdleExpanded((v) => !v)}
              />
            )}
          </div>
        </ScrollArea>
      </div>
    </aside>
  );
}

function SubagentSessionCard({ session, onOpen }: { session: OpenClawSession; onOpen: () => void }) {
  const active = session.status === 'active';
  const toolCount = session.toolCallCount ?? 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn('subagent-session-card group w-full rounded-xl border p-3 text-left transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0', active && 'is-active')}
      title={`Open delegated session ${session.shortId}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('h-1.5 w-1.5 rounded-full bg-signal-teal', active && 'signal-pulse')} aria-hidden="true" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-signal-teal">Subagent</span>
          </div>
          <p className="mt-1 truncate text-xs font-semibold text-ivory-dim">{session.title}</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[9px] font-mono text-ash">{session.shortId}</span>
      </div>
      <p className="line-clamp-2 text-xs leading-snug text-ash">{session.preview || 'Waiting for the delegated lane to write its first useful breadcrumb.'}</p>
      <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-2 text-[10px] font-mono text-ash-muted">
        <span>{session.messageCount} msg{session.messageCount !== 1 ? 's' : ''}</span>
        <span>{toolCount} tool{toolCount !== 1 ? 's' : ''}</span>
        <span>{active ? 'live' : session.status}</span>
      </div>
    </button>
  );
}

function CollapsibleIdleSection({
  agents,
  expanded,
  onToggle,
}: {
  agents: Agent[];
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="agent-idle-toggle w-full flex items-center justify-between px-1 py-1.5 text-xs font-mono text-ash hover:text-ivory-dim transition-colors duration-150 rounded"
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
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
