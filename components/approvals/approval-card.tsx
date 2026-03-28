'use client';

import type { Approval } from '@/lib/types';
import { cn } from '@/lib/utils';

const URGENCY_CONFIG: Record<Approval['urgency'], { label: string; color: string; bg: string }> = {
  high:   { label: 'HIGH',   color: 'var(--mb-red)',   bg: 'var(--mb-red-dim)' },
  medium: { label: 'MED',   color: 'var(--mb-brass)',  bg: 'var(--mb-brass-dim)' },
  low:    { label: 'LOW',    color: 'var(--mb-ash)',    bg: 'rgba(122,120,112,0.12)' },
};

interface ApprovalCardProps {
  approval: Approval;
  onJumpToThread: () => void;
}

export function ApprovalCard({ approval, onJumpToThread }: ApprovalCardProps) {
  const cfg = URGENCY_CONFIG[approval.urgency];

  return (
    <div
      className="rounded-lg border p-4 transition-all duration-150"
      style={{
        background: 'var(--mb-elevated)',
        borderColor: `${cfg.color}30`,
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
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
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M1 6L11 1L6 11L5 7L1 6Z" fill="var(--mb-brass)" opacity="0.6" />
        </svg>
      </div>

      {/* Title */}
      <p className="text-sm font-medium text-ivory mb-2 leading-snug">
        {approval.title}
      </p>

      {/* Recommendation */}
      <p className="text-xs text-ivory-dim leading-relaxed mb-3 italic">
        &ldquo;{approval.recommendation}&rdquo;
      </p>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          className="flex-1 text-xs font-medium py-1.5 rounded-md transition-all duration-150"
          style={{
            background: cfg.bg,
            color: cfg.color,
            border: `1px solid ${cfg.color}30`,
          }}
        >
          Approve
        </button>
        <button
          className="flex-1 text-xs font-medium py-1.5 rounded-md transition-all duration-150"
          style={{
            background: 'transparent',
            color: 'var(--mb-ash)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
          onClick={onJumpToThread}
        >
          Review
        </button>
      </div>
    </div>
  );
}
