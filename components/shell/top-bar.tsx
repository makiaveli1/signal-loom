'use client';

import { Badge } from '@/components/ui/badge';
import { useSignalLoomStore } from '@/lib/store';
import { useCrmStore } from '@/lib/crm/store';
import { cn } from '@/lib/utils';

export function TopBar() {
  const { runtime, approvals, approvalsPanelOpen, toggleApprovalsPanel, emailGates, crmPanelOpen, toggleCrmPanel } = useSignalLoomStore();
  const { leads } = useCrmStore();

  const pendingApprovals = approvals.filter(
    (a) => a.status === undefined || a.status === 'pending'
  ).length;
  const pendingEmailGates = emailGates.filter(
    (g) => g.gateStatus === 'needs_review' || g.gateStatus === 'ready_for_approval'
  ).length;
  const totalPending = pendingApprovals + pendingEmailGates;

  // Leads missing concept or needing concept approval
  const leadsNeedingConcept = leads.filter(
    (l) => l.concept.status !== 'approved' && l.concept.status !== 'attached_to_outreach'
  ).length;

  return (
    <header
      className="flex items-center justify-between px-4 py-2.5 border-b"
      style={{ background: 'var(--mb-shell)', borderColor: 'rgba(255,255,255,0.05)' }}
      role="banner"
    >
      {/* Logo + wordmark */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {/* Signal Loom icon — stylized weave/signal mark */}
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            role="img"
          >
            <circle cx="12" cy="12" r="3" fill="var(--mb-teal)" opacity="0.9" />
            <circle cx="12" cy="12" r="7" stroke="var(--mb-teal)" strokeWidth="1.5" opacity="0.4" />
            <circle cx="12" cy="12" r="11" stroke="var(--mb-teal)" strokeWidth="1" opacity="0.15" />
            <line x1="1" y1="12" x2="5" y2="12" stroke="var(--mb-red)" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
            <line x1="19" y1="12" x2="23" y2="12" stroke="var(--mb-red)" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
          </svg>
          <span className="font-semibold text-sm tracking-wide text-ivory">
            Signal Loom
          </span>
        </div>
        <span className="text-xs text-ash-muted font-mono" aria-hidden="true">// nero@openclaw</span>
      </div>

      {/* Center — gateway + queue health */}
      <div className="flex items-center gap-3">
        <HealthChip label="Gateway" status={runtime.gateway} />
        <HealthChip label="Queue" status={runtime.queue} />
        {runtime.heartbeatFreshness === 'fresh' ? (
          <span className="flex items-center gap-1.5 text-xs text-state-jade font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-state-jade signal-pulse" />
            heartbeat live
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-state-rust font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-state-rust" />
            heartbeat stale
          </span>
        )}
      </div>

      {/* Right — approvals + CRM */}
      <div className="flex items-center gap-2">
        {/* CRM Lead Dossier — concept-first workflow */}
        <button
          onClick={toggleCrmPanel}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150",
            crmPanelOpen
              ? "bg-teal-dim text-teal border border-teal/30"
              : "bg-graphite text-ash hover:text-ivory border border-transparent hover:border-white/08"
          )}
          title="CRM Lead Dossier — concept packages and send gating"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <rect x="1" y="1" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
            <line x1="1" y1="4" x2="11" y2="4" stroke="currentColor" strokeWidth="1" opacity="0.5" />
            <line x1="1" y1="7" x2="11" y2="7" stroke="currentColor" strokeWidth="1" opacity="0.5" />
            <circle cx="3.5" cy="2.5" r="0.8" fill="currentColor" />
          </svg>
          CRM
          {leadsNeedingConcept > 0 && (
            <Badge
              variant="outline"
              className="text-xs font-mono min-w-5 h-5 justify-center"
              style={{ borderColor: 'var(--mb-teal)', color: 'var(--mb-teal)', background: 'rgba(61,201,196,0.1)' }}
            >
              {leadsNeedingConcept}
            </Badge>
          )}
        </button>

        <button
          onClick={toggleApprovalsPanel}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150",
            approvalsPanelOpen
              ? "bg-brass-dim text-brass border border-brass/30"
              : "bg-graphite text-ash hover:text-ivory border border-transparent hover:border-white/08"
          )}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M6 1L7.5 4.5L11 5L8.5 7.5L9 11L6 9.5L3 11L3.5 7.5L1 5L4.5 4.5L6 1Z"
              fill={approvalsPanelOpen ? 'var(--mb-brass)' : 'var(--mb-ash)'} />
          </svg>
          Approvals
          {totalPending > 0 && (
            <Badge
              variant="outline"
              className="text-xs font-mono min-w-5 h-5 justify-center"
              style={{ borderColor: 'var(--mb-brass)', color: 'var(--mb-brass)', background: 'var(--mb-brass-dim)' }}
            >
              {totalPending}
            </Badge>
          )}
        </button>
      </div>
    </header>
  );
}

function HealthChip({ label, status }: { label: string; status: string }) {
  const isHealthy = status === 'healthy';
  return (
    <span className="flex items-center gap-1.5 text-xs font-mono">
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: isHealthy ? 'var(--mb-jade)' : 'var(--mb-rust)' }}
      />
      <span className="text-ash">{label}:</span>
      <span style={{ color: isHealthy ? 'var(--mb-jade)' : 'var(--mb-rust)' }}>
        {status}
      </span>
    </span>
  );
}
