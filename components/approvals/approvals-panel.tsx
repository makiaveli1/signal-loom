'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useSignalLoomStore } from '@/lib/store';
import { useCrmStore } from '@/lib/crm/store';
import { ApprovalCard } from './approval-card';
import { EmailGateCard } from './email-gate-card';
import { ConceptApprovalCard } from '../crm/concept-approval-card';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Approval } from '@/lib/types';

const EMAIL_ACTION_STATUSES = new Set(['needs_review', 'ready_for_approval', 'human_approved', 'send_failed']);

export function ApprovalsPanel() {
  const {
    approvals,
    approvalsPanelOpen,
    toggleApprovalsPanel,
    selectThread,
    resolveApproval,
    emailGates,
    updateEmailGate,
    sendEmail,
  } = useSignalLoomStore();
  const { leads } = useCrmStore();

  // Sort: pending first, then by urgency, then by recency
  const sortedApprovals = approvals
    .slice()
    .sort((a, b) => {
      const isPending = (ap: Approval) =>
        ap.status === undefined || ap.status === 'pending';
      if (isPending(a) !== isPending(b)) return isPending(b) ? 1 : -1;
      const order = { high: 0, medium: 1, low: 2 };
      const u = order[a.urgency] - order[b.urgency];
      if (u !== 0) return u;
      const ta = a.raisedAt ? new Date(a.raisedAt).getTime() : 0;
      const tb = b.raisedAt ? new Date(b.raisedAt).getTime() : 0;
      return tb - ta;
    });

  const isPendingApproval = (approval: Approval) => approval.status === undefined || approval.status === 'pending';
  const pendingApprovals = sortedApprovals.filter(isPendingApproval);
  const pendingCount = pendingApprovals.length;

  const gatewayCount = pendingApprovals.filter((approval) => approval.source === 'gateway').length;
  const derivedCount = pendingApprovals.filter((approval) => approval.source === undefined || approval.source === 'derived').length;
  const mockCount = pendingApprovals.filter((approval) => approval.source === 'mock').length;

  // Email gates: show only gates that still need a human action.
  const visibleEmailGates = emailGates.filter((gate) => EMAIL_ACTION_STATUSES.has(gate.gateStatus));
  const pendingEmailGateCount = visibleEmailGates.length;

  // Concept reviews: leads in internal_review awaiting Nero approval
  const conceptReviewLeads = leads.filter((l) => l.concept.status === 'internal_review');
  const conceptReviewCount = conceptReviewLeads.length;

  const totalPending = pendingCount + pendingEmailGateCount + conceptReviewCount;
  const totalSourcePills = [
    gatewayCount > 0 ? { label: `${gatewayCount} gateway`, tone: 'gateway' } : null,
    derivedCount > 0 ? { label: `${derivedCount} derived`, tone: 'derived' } : null,
    mockCount > 0 ? { label: `${mockCount} dev mock`, tone: 'mock' } : null,
    pendingEmailGateCount > 0 ? { label: `${pendingEmailGateCount} email`, tone: visibleEmailGates.some((gate) => gate.source === 'demo') ? 'mock' : 'email' } : null,
    conceptReviewCount > 0 ? { label: `${conceptReviewCount} concept`, tone: 'concept' } : null,
  ].filter((pill): pill is { label: string; tone: string } => Boolean(pill));

  return (
    <AnimatePresence>
      {approvalsPanelOpen && (
        <motion.aside
          initial={{ opacity: 0, x: '100%' }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: '100%' }}
          transition={{ type: 'spring', stiffness: 380, damping: 32, mass: 0.8 }}
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
                  background: totalPending > 0 ? 'rgba(201,160,58,0.15)' : 'rgba(80,200,120,0.1)',
                  color: totalPending > 0 ? 'var(--mb-brass)' : 'var(--mb-jade)',
                }}
              >
                {totalPending} pending
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

          {/* Source + decision hint */}
          <div
            className="approval-source-summary px-4 py-3 border-b text-xs"
            style={{
              borderColor: 'rgba(255,255,255,0.04)',
              color: 'var(--mb-ash)',
              background: 'rgba(201,160,58,0.04)',
            }}
          >
            <p>Pending decisions surface first. Demo email gates stay hidden unless explicitly enabled.</p>
            {totalSourcePills.length > 0 && (
              <div className="approval-source-pills" aria-label="Approval source breakdown">
                {totalSourcePills.map((pill) => (
                  <span key={`${pill.tone}-${pill.label}`} className={`approval-source-pill approval-source-pill-${pill.tone}`}>
                    {pill.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Approval cards */}
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-3">
              {pendingApprovals.length === 0 && visibleEmailGates.length === 0 && conceptReviewLeads.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                  <span className="text-lg opacity-30">✓</span>
                  <p className="text-xs text-ash-muted">No approvals pending</p>
                  <p className="text-xs text-ash-muted opacity-60">
                    Decisions appear here as agents request them
                  </p>
                </div>
              ) : (
                <>
                  {pendingApprovals.length > 0 && (
                    <>
                      <div className="text-xs font-semibold uppercase tracking-wider text-ash-muted px-1">
                        Delegation Approvals
                      </div>
                      {pendingApprovals.map((approval) => (
                        <ApprovalCard
                          key={approval.id}
                          approval={approval}
                          onJumpToThread={() => {
                            selectThread(approval.linkedThreadId);
                            toggleApprovalsPanel();
                          }}
                          onApprove={(appr, note) => resolveApproval(appr.id, 'approved', note)}
                          onDeny={(appr, note) => resolveApproval(appr.id, 'denied', note)}
                          onRevise={(appr, note) => resolveApproval(appr.id, 'revised', note)}
                        />
                      ))}
                    </>
                  )}

                  {visibleEmailGates.length > 0 && (
                    <>
                      <div className="text-xs font-semibold uppercase tracking-wider text-ash-muted px-1 pt-1">
                        Email Outbound
                      </div>
                      {visibleEmailGates.map((gate) => (
                        <EmailGateCard
                          key={gate.id}
                          gate={gate}
                          onJumpToThread={() => {
                            if (gate.threadId) selectThread(gate.threadId);
                            toggleApprovalsPanel();
                          }}
                          onApprove={gate.gateStatus === 'human_approved' ? () => sendEmail(gate.id).catch(() => {}) : undefined}
                          onDeny={
                            gate.gateStatus === 'needs_review' || gate.gateStatus === 'ready_for_approval'
                              ? (g) => {
                                  // Transition to denied locally
                                  updateEmailGate({
                                    ...g,
                                    gateStatus: 'human_denied',
                                    lastChangedAt: new Date().toISOString(),
                                    auditLog: [
                                      ...(g.auditLog ?? []),
                                      { at: new Date().toISOString(), action: 'denied' },
                                    ],
                                  });
                                }
                              : undefined
                          }
                        />
                      ))}
                    </>
                  )}

                  {conceptReviewLeads.length > 0 && (
                    <>
                      <div className="text-xs font-semibold uppercase tracking-wider text-ash-muted px-1 pt-1">
                        Concept Review
                      </div>
                      {conceptReviewLeads.map((lead) => (
                        <ConceptApprovalCard
                          key={lead.id}
                          lead={lead}
                          onApproved={() => {
                            // Status already updated in store via setConceptStatus in the card
                          }}
                          onRework={() => {
                            // Status already updated in store via setConceptStatus in the card
                          }}
                        />
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
