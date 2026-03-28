'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useSignalLoomStore } from '@/lib/store';
import { ApprovalCard } from './approval-card';
import { ScrollArea } from '@/components/ui/scroll-area';

export function ApprovalsPanel() {
  const { approvals, approvalsPanelOpen, toggleApprovalsPanel, selectThread } = useSignalLoomStore();

  return (
    <AnimatePresence>
      {approvalsPanelOpen && (
        <motion.aside
          initial={{ x: 280, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 280, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          className="flex flex-col h-full border-l"
          style={{
            background: 'var(--mb-shell)',
            borderColor: 'rgba(255,255,255,0.05)',
            width: '300px',
            minWidth: '300px',
          }}
        >
          {/* Panel header */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: 'rgba(255,255,255,0.05)' }}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-brass">
                Approvals
              </span>
              <span
                className="text-xs font-mono px-1.5 py-0.5 rounded"
                style={{
                  background: 'var(--mb-brass-dim)',
                  color: 'var(--mb-brass)',
                }}
              >
                {approvals.length}
              </span>
            </div>
            <button
              onClick={toggleApprovalsPanel}
              className="text-ash-muted hover:text-ivory transition-colors"
              aria-label="Close approvals panel"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Urgency hint */}
          <div
            className="px-4 py-2 border-b text-xs"
            style={{
              borderColor: 'rgba(255,255,255,0.04)',
              color: 'var(--mb-ash)',
              background: 'rgba(201,160,58,0.04)',
            }}
          >
            High urgency items surface first — decisions are live.
          </div>

          {/* Approval cards */}
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-3">
              {/* Sort: high first */}
              {approvals
                .slice()
                .sort((a, b) => {
                  const order = { high: 0, medium: 1, low: 2 };
                  return order[a.urgency] - order[b.urgency];
                })
                .map((approval) => (
                  <ApprovalCard
                    key={approval.id}
                    approval={approval}
                    onJumpToThread={() => {
                      selectThread(approval.linkedThreadId);
                      toggleApprovalsPanel();
                    }}
                  />
                ))}
            </div>
          </ScrollArea>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
