'use client';

import { useState } from 'react';
import type { Approval } from '@/lib/types';

/** Denied-state next-step cue for local/gateway approval cards. */
const DENIAL_NEXT_STEP = 'Revise and resubmit — return to the linked thread to address feedback.';

const URGENCY_CONFIG: Record<Approval['urgency'], { label: string; color: string; bg: string; border: string }> = {
  high:   { label: 'High',   color: 'var(--mb-red)',   bg: 'rgba(232,96,58,0.10)',  border: 'rgba(232,96,58,0.25)' },
  medium: { label: 'Medium', color: 'var(--mb-brass)', bg: 'rgba(201,160,58,0.10)', border: 'rgba(201,160,58,0.22)' },
  low:    { label: 'Low',    color: 'var(--mb-ash)',    bg: 'rgba(122,120,112,0.08)',border: 'rgba(122,120,112,0.15)' },
};

const STATUS_CONFIG: Record<
  NonNullable<Approval['status']>,
  { label: string; color: string; bg: string; border: string; visible: boolean }
> = {
  pending: {
    label: 'Pending',
    color: 'var(--mb-brass)',
    bg: 'rgba(201,160,58,0.08)',
    border: 'rgba(201,160,58,0.20)',
    visible: true,
  },
  approved: {
    label: 'Approved',
    color: 'var(--mb-jade)',
    bg: 'rgba(80,200,120,0.06)',
    border: 'rgba(80,200,120,0.20)',
    visible: true,
  },
  denied: {
    label: 'Not Approved',
    color: 'var(--mb-ash)',
    bg: 'rgba(128,128,120,0.06)',
    border: 'rgba(128,128,120,0.15)',
    visible: true,
  },
  revised: {
    label: 'Revised',
    color: 'var(--mb-brass)',
    bg: 'rgba(201,160,58,0.08)',
    border: 'rgba(201,160,58,0.20)',
    visible: true,
  },
};

const SOURCE_CONFIG: Record<NonNullable<Approval['source']>, { label: string; color: string }> = {
  gateway: { label: 'Gateway', color: 'var(--mb-jade)' },
  derived: { label: 'Derived', color: 'var(--mb-brass)' },
  mock:   { label: 'Dev mock', color: 'var(--mb-ash)' },
};

interface ApprovalCardProps {
  approval: Approval;
  onJumpToThread: () => void;
  onApprove?: (approval: Approval, note?: string) => void;
  onDeny?: (approval: Approval, note?: string) => void;
  onRevise?: (approval: Approval, note?: string) => void;
}

export function ApprovalCard({
  approval,
  onJumpToThread,
  onApprove,
  onDeny,
  onRevise,
}: ApprovalCardProps) {
  const cfg = URGENCY_CONFIG[approval.urgency];
  const status = approval.status ?? 'pending';
  const statusCfg = STATUS_CONFIG[status];
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const isDecided = status === 'approved' || status === 'denied' || status === 'revised';
  const source = approval.source ?? 'derived';

  return (
    <div
      className="approval-card rounded-xl border p-4 transition-all duration-150"
      style={{
        background: 'var(--mb-elevated)',
        borderColor: cfg.border,
        borderLeftWidth: '3px',
        opacity: isDecided ? '0.75' : '1',
      }}
      data-automation-id={`approval-card-${approval.id}`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between mb-2.5 flex-wrap gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-xs font-mono font-semibold px-1.5 py-0.5 rounded"
            style={{ color: cfg.color, background: cfg.bg }}
          >
            {cfg.label}
          </span>
          <span
            className="text-xs font-mono px-1.5 py-0.5 rounded"
            style={{
              color: statusCfg.color,
              background: statusCfg.bg,
              border: `1px solid ${statusCfg.border}`,
            }}
          >
            {statusCfg.label}
          </span>
          <span
            className="text-xs font-mono px-1.5 py-0.5 rounded"
            style={{ color: SOURCE_CONFIG[source]?.color ?? 'var(--mb-ash)', background: 'transparent' }}
            title={
              source === 'gateway'
                ? 'Real approval request from the gateway'
                : source === 'derived'
                  ? 'Derived from real session data — may need verification'
                  : 'Development mock data — not from the gateway'
            }
          >
            {SOURCE_CONFIG[source]?.label ?? source}
          </span>
        </div>
        <span className="text-xs text-ash-muted font-mono">
          by {approval.raisedBy}
        </span>
      </div>

      {/* Title */}
      <p className="text-sm font-semibold text-ivory mb-2 leading-snug">
        {approval.title}
      </p>

      {source === 'mock' && (
        <p className="mb-3 rounded-md border border-white/10 px-2 py-1.5 text-xs text-ash-muted">
          Demo approval — not from a live gateway request.
        </p>
      )}

      {/* Recommendation */}
      <p className="text-xs text-ivory-dim leading-relaxed mb-3 italic">
        &ldquo;{approval.recommendation}&rdquo;
      </p>

      {/* Decision note */}
      {approval.decisionNote && (
        <div
          className="text-xs p-2 rounded mb-3"
          style={{
            background: 'rgba(0,0,0,0.15)',
            border: `1px solid ${statusCfg.border}`,
            color: 'var(--mb-ivory-dim)',
          }}
        >
          <span className="font-semibold" style={{ color: statusCfg.color }}>
            {statusCfg.label}:
          </span>{' '}
          {approval.decisionNote}
          {approval.decidedAt && (
            <span className="block mt-0.5 opacity-60">
              {new Date(approval.decidedAt).toLocaleString('en-IE', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </span>
          )}
        </div>
      )}

      {/* Next-step cue for denied items */}
      {status === 'denied' && (
        <div
          className="text-xs p-2 rounded mb-3"
          style={{
            background: 'rgba(201,160,58,0.06)',
            border: '1px solid rgba(201,160,58,0.18)',
            color: 'var(--mb-ivory-dim)',
          }}
        >
          <span className="font-semibold text-brass">Next step: </span>
          {DENIAL_NEXT_STEP}
        </div>
      )}

      {/* Revision note input */}
      {showNote && (
        <div className="mb-3 space-y-1.5">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Note for the agent (optional)"
            className="w-full text-xs px-2 py-1.5 rounded border bg-transparent text-ivory resize-none"
            style={{ borderColor: 'rgba(255,255,255,0.1)', outline: 'none' }}
          />
          <div className="flex gap-2">
            <button
              onClick={() => { onRevise?.(approval, note || undefined); setShowNote(false); setNote(''); }}
              className="text-xs px-3 py-1.5 rounded font-medium"
              style={{ background: 'var(--mb-brass)', color: 'var(--mb-carbon)' }}
            >
              Submit revision
            </button>
            <button
              onClick={() => { setShowNote(false); setNote(''); }}
              className="text-xs text-ash-muted hover:text-ivory-dim px-2 py-1.5 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      {!isDecided && !showNote && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => onApprove?.(approval, note || undefined)}
            className="flex-1 text-xs font-semibold py-1.5 rounded-md transition-all duration-150 hover:opacity-90 disabled:opacity-40"
            style={{ background: 'var(--mb-jade)', color: 'var(--mb-carbon)' }}
            data-automation-id="approve-button"
          >
            ✓ Approve
          </button>
          <button
            onClick={() => onDeny?.(approval)}
            className="flex-1 text-xs font-medium py-1.5 rounded-md transition-all duration-150 disabled:opacity-40"
            style={{
              background: 'transparent',
              color: 'var(--mb-ivory-dim)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
            data-automation-id="deny-button"
          >
            ✗ Not yet
          </button>
          <button
            onClick={() => onJumpToThread()}
            aria-label="Open linked thread for this approval"
            className="approval-secondary-action text-xs px-3 py-1.5 rounded-md"
            style={{
              background: 'transparent',
              color: 'var(--mb-brass)',
              border: '1px solid rgba(201,160,58,0.3)',
            }}
            title="Jump to linked thread"
            data-automation-id="review-thread-button"
          >
            Open thread ↗
          </button>
        </div>
      )}

      {/* Thread jump for decided approvals */}
      {isDecided && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => onJumpToThread()}
            aria-label="Open linked thread for this approval"
            className="approval-secondary-action flex-1 text-xs px-3 py-1.5 rounded-md transition-all duration-150"
            style={{
              background: 'transparent',
              color: 'var(--mb-brass)',
              border: '1px solid rgba(201,160,58,0.3)',
            }}
            title="Jump to linked thread"
          >
            Open thread ↗
          </button>
        </div>
      )}
    </div>
  );
}
