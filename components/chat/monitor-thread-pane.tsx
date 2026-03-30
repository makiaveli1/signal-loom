'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useSignalLoomStore } from '@/lib/store';
import type { Thread } from '@/lib/types';
import { cn } from '@/lib/utils';
import { X, ChevronRight } from 'lucide-react';

interface MonitorThreadPaneProps {
  thread: Thread;
  isActive: boolean;
  collapsed: boolean;
  onExpand: () => void;
  onActivate: () => void;
  onClose?: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  waiting_on_nero: 'Waiting',
  waiting_on_specialist: 'Delegated',
  waiting_on_user: 'Needs You',
  blocked: 'Blocked',
  done: 'Done',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'var(--mb-teal)',
  waiting_on_nero: 'var(--mb-red)',
  waiting_on_specialist: 'var(--mb-brass)',
  waiting_on_user: 'var(--mb-violet)',
  blocked: 'var(--mb-rust)',
  done: 'var(--mb-jade)',
};

export function MonitorThreadPane({
  thread,
  isActive,
  collapsed,
  onExpand,
  onActivate,
  onClose,
}: MonitorThreadPaneProps) {
  const { approvals, agents } = useSignalLoomStore();
  const pendingApproval = approvals.find((a) => a.linkedThreadId === thread.id);
  const latestMessage = thread.messages[thread.messages.length - 1];
  const linkedAgents = thread.linkedAgents
    .map((id) => agents.find((a) => a.id === id))
    .filter(Boolean);
  const statusColor = STATUS_COLORS[thread.status] ?? 'var(--mb-ash)';

  return (
    /*
     * Outer container: fixed width managed by the flex row.
     * When collapsed: flex: 0 0 48px — fixed narrow strip.
     * When expanded: flex: 0 0 240px — fixed wide.
     * AnimatePresence fades content in/out on collapse/expand.
     */
    <div
      className="h-full flex flex-col min-h-0 overflow-hidden"
      style={{
        flex: `0 0 ${collapsed ? 48 : 240}px`,
        background: 'var(--mb-shell)',
        borderLeft: `2px solid ${isActive ? statusColor : 'rgba(255,255,255,0.06)'}`,
        transition: 'flex 0.22s cubic-bezier(0.25, 0.1, 0.25, 1)',
      }}
    >
      {/* Collapsed strip — only rendered when collapsed */}
      <AnimatePresence>
        {collapsed && (
          <motion.div
            key="collapsed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="h-full flex flex-col items-center py-3 cursor-pointer"
            onClick={onExpand}
            title={`Monitor: ${thread.title}`}
          >
            {/* Status color bar */}
            <div
              className="w-1 flex-shrink-0 rounded-full mb-2"
              style={{ background: statusColor, height: '40px' }}
            />
            {/* Rotated thread title */}
            <div
              className="flex-1 flex items-center overflow-hidden"
              style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
            >
              <span
                className="text-xs text-ivory-dim truncate px-0.5"
                style={{ fontSize: '10px', maxHeight: '100px' }}
              >
                {thread.title}
              </span>
            </div>
            {/* Approval indicator */}
            {pendingApproval && (
              <div
                className="w-2 h-2 rounded-full mt-2 signal-pulse flex-shrink-0"
                style={{ background: 'var(--mb-brass)' }}
                title="Approval pending"
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded pane — only rendered when expanded */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            key="expanded"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="h-full flex flex-col overflow-hidden min-h-0"
          >
            {/* Monitor header */}
            <div
              className="flex items-center justify-between px-3 py-2 border-b gap-2 flex-shrink-0"
              style={{ borderColor: 'rgba(255,255,255,0.04)', minHeight: '40px' }}
            >
              <div className="flex items-center gap-2 min-w-0">
                {isActive && (
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0 signal-pulse"
                    style={{ background: 'var(--mb-teal)' }}
                  />
                )}
                <span
                  className="text-xs font-mono uppercase tracking-widest flex-shrink-0"
                  style={{ color: 'var(--mb-ash)', fontSize: '9px' }}
                >
                  Monitor
                </span>
                <span
                  className="text-xs text-ivory-dim truncate"
                  style={{ fontSize: '11px' }}
                >
                  {thread.title}
                </span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={onExpand}
                  className="text-ash-muted hover:text-ivory transition-colors p-0.5 rounded"
                  title="Collapse monitor"
                >
                  <ChevronRight size={12} />
                </button>
                {onClose && (
                  <button
                    onClick={onClose}
                    className="text-ash-muted hover:text-ivory transition-colors p-0.5 rounded"
                    title="Close monitor"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto py-2 px-3 space-y-2">
              {/* Status */}
              <div className="flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: statusColor }}
                />
                <span
                  className="text-xs font-mono"
                  style={{ color: statusColor, fontSize: '10px' }}
                >
                  {STATUS_LABELS[thread.status] ?? thread.status}
                </span>
                {pendingApproval && (
                  <span
                    className="text-xs font-semibold ml-1"
                    style={{ color: 'var(--mb-brass)', fontSize: '10px' }}
                  >
                    ▲ {approvals.filter((a) => a.linkedThreadId === thread.id).length} pending
                  </span>
                )}
              </div>

              {/* Latest message preview */}
              {latestMessage && (
                <div
                  className="rounded p-2 text-xs leading-snug"
                  style={{
                    background: 'var(--mb-panel)',
                    color: 'var(--mb-ivory-dim)',
                    fontSize: '11px',
                  }}
                >
                  <span className="text-ivory-dim opacity-60 font-mono mr-1">
                    {latestMessage.role}:
                  </span>
                  {latestMessage.content.slice(0, 80)}
                  {latestMessage.content.length > 80 ? '…' : ''}
                </div>
              )}

              {/* Linked agents */}
              {linkedAgents.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {linkedAgents.map((agent) =>
                    agent ? (
                      <span
                        key={agent.id}
                        className="px-1.5 py-0.5 rounded text-xs font-mono"
                        style={{
                          background: `${agent.accentColor}15`,
                          color: agent.accentColor,
                          border: `1px solid ${agent.accentColor}25`,
                          fontSize: '10px',
                        }}
                      >
                        {agent.name}
                      </span>
                    ) : null
                  )}
                </div>
              )}
            </div>

            {/* Click to activate */}
            {!isActive && (
              <button
                onClick={onActivate}
                className="w-full py-2 text-xs font-mono text-center transition-colors border-t flex-shrink-0"
                style={{
                  borderColor: 'rgba(255,255,255,0.04)',
                  color: 'var(--mb-teal)',
                  fontSize: '10px',
                  background: 'var(--mb-shell)',
                }}
              >
                Click to activate
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
