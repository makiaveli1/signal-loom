'use client';

import type { Approval } from '@/lib/types';
import { cn } from '@/lib/utils';

const URGENCY_CONFIG: Record<Approval['urgency'], { label: string; color: string; bg: string; border: string }> = {
  high:   { label: 'High',   color: 'var(--mb-red)',   bg: 'rgba(232,96,58,0.10)',  border: 'rgba(232,96,58,0.25)' },
  medium: { label: 'Medium', color: 'var(--mb-brass)', bg: 'rgba(201,160,58,0.10)', border: 'rgba(201,160,58,0.22)' },
  low:    { label: 'Low',    color: 'var(--mb-ash)',    bg: 'rgba(122,120,112,0.08)',border: 'rgba(122,120,112,0.15)' },
};

interface ApprovalCardProps {
  approval: Approval;
  onJumpToThread: () => void;
}

export function ApprovalCard({ approval, onJumpToThread }: ApprovalCardProps) {
  const cfg = URGENCY_CONFIG[approval.urgency];

  return (
    <div
      className="rounded-lg border p-4 transition-all duration-150 hover:scale-[1.01]"
      style={{
        background: 'var(--mb-elevated)',
        borderColor: cfg.border,
        borderLeftWidth: '3px',
      }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-mono font-semibold px-1.5 py-0.5 rounded"
            style={{ color: cfg.color, background: cfg.bg }}
          >
            {cfg.label}
          </span>
          <span className="text-xs text-ash-muted font-mono">
            by {approval.raisedBy}
          </span>
        </div>
        {/* Arrow icon */}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M1 6L11 1L6 11L5 7L1 6Z" fill="var(--mb-brass)" opacity="0.6" />
        </svg>
      </div>

      {/* Title */}
      <p className="text-sm font-semibold text-ivory mb-2 leading-snug">
        {approval.title}
      </p>

      {/* Recommendation */}
      <p className="text-xs text-ivory-dim leading-relaxed mb-3 italic">
        &ldquo;{approval.recommendation}&rdquo;
      </p>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          className="flex-1 text-xs font-medium py-1.5 rounded-md transition-all duration-150 hover:opacity-90"
          style={{
            background: cfg.bg,
            color: cfg.color,
            border: `1px solid ${cfg.border}`,
          }}
        >
          Approve
        </button>
        <button
          className="flex-1 text-xs font-medium py-1.5 rounded-md transition-all duration-150"
          style={{
            background: 'transparent',
            color: 'var(--mb-ivory-dim)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
          onClick={onJumpToThread}
        >
          Review
        </button>
      </div>
    </div>
  );
}
