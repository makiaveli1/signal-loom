'use client';

import { useState } from 'react';
import type { EmailGateStoreItem } from '@/lib/store';
import { cn } from '@/lib/utils';

const GATE_STATUS_CONFIG: Record<EmailGateStoreItem['gateStatus'], { label: string; color: string; bg: string; border: string }> = {
  draft: {
    label: 'Draft',
    color: 'var(--mb-ash)',
    bg: 'rgba(128,128,120,0.08)',
    border: 'rgba(128,128,120,0.15)',
  },
  needs_review: {
    label: 'Needs Review',
    color: 'var(--mb-red)',
    bg: 'rgba(232,96,58,0.10)',
    border: 'rgba(232,96,58,0.25)',
  },
  ready_for_approval: {
    label: 'Pending Approval',
    color: 'var(--mb-brass)',
    bg: 'rgba(201,160,58,0.08)',
    border: 'rgba(201,160,58,0.20)',
  },
  human_approved: {
    label: 'Approved',
    color: 'var(--mb-jade)',
    bg: 'rgba(80,200,120,0.06)',
    border: 'rgba(80,200,120,0.20)',
  },
  sending: {
    label: 'Sending…',
    color: 'var(--mb-brass)',
    bg: 'rgba(201,160,58,0.08)',
    border: 'rgba(201,160,58,0.20)',
  },
  sent: {
    label: 'Sent',
    color: 'var(--mb-jade)',
    bg: 'rgba(80,200,120,0.06)',
    border: 'rgba(80,200,120,0.20)',
  },
  send_failed: {
    label: 'Send Failed',
    color: 'var(--mb-red)',
    bg: 'rgba(232,96,58,0.10)',
    border: 'rgba(232,96,58,0.25)',
  },
  human_denied: {
    label: 'Denied',
    color: 'var(--mb-ember)',
    bg: 'rgba(232,96,58,0.08)',
    border: 'rgba(232,96,58,0.18)',
  },
};

const CONFIDENCE_CONFIG: Record<EmailGateStoreItem['confidence'], { label: string; color: string }> = {
  high:   { label: 'High confidence',  color: 'var(--mb-jade)' },
  medium: { label: 'Medium confidence', color: 'var(--mb-brass)' },
  low:    { label: 'Low confidence',   color: 'var(--mb-red)' },
};

interface EmailGateCardProps {
  gate: EmailGateStoreItem;
  onJumpToThread: () => void;
  onApprove?: (gate: EmailGateStoreItem) => void;
  onDeny?: (gate: EmailGateStoreItem) => void;
  onRetrySend?: (gate: EmailGateStoreItem) => void;
}

export function EmailGateCard({ gate, onJumpToThread, onApprove, onDeny, onRetrySend }: EmailGateCardProps) {
  const statusCfg = GATE_STATUS_CONFIG[gate.gateStatus];
  const confidenceCfg = CONFIDENCE_CONFIG[gate.confidence];
  const isSendable = gate.gateStatus === 'human_approved';
  const isDenied = gate.gateStatus === 'human_denied';
  const isSent = gate.gateStatus === 'sent' || gate.gateStatus === 'send_failed';
  const isSending = gate.gateStatus === 'sending';

  return (
    <div
      className="rounded-lg border p-4 transition-all duration-150"
      style={{
        background: 'var(--mb-elevated)',
        borderColor: statusCfg.border,
        borderLeftWidth: '3px',
        opacity: isSent ? '0.75' : '1',
      }}
      data-automation-id={`email-gate-card-${gate.id}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2.5 flex-wrap gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Email icon */}
          <span
            className="text-xs font-mono px-1.5 py-0.5 rounded"
            style={{ color: 'var(--mb-brass)', background: 'rgba(201,160,58,0.10)' }}
            title="Outbound email"
          >
            ✉ Email
          </span>
          {/* Gate status badge */}
          <span
            className="text-xs font-mono px-1.5 py-0.5 rounded"
            style={{ color: statusCfg.color, background: statusCfg.bg, border: `1px solid ${statusCfg.border}` }}
          >
            {statusCfg.label}
          </span>
          {/* Executive badge */}
          {gate.isExecutive && (
            <span
              className="text-xs font-mono px-1.5 py-0.5 rounded"
              style={{ color: 'var(--mb-red)', background: 'rgba(232,96,58,0.08)', border: '1px solid rgba(232,96,58,0.18)' }}
            >
              Executive
            </span>
          )}
        </div>
        {/* Confidence */}
        <span className="text-xs font-mono" style={{ color: confidenceCfg.color }}>
          {confidenceCfg.label}
        </span>
      </div>

      {/* Subject */}
      <p className="text-sm font-semibold text-ivory mb-1 leading-snug">
        {gate.proposedEmail.subject}
      </p>

      {/* Recipient */}
      <p className="text-xs text-ash-muted mb-2">
        To: {gate.toRecipient}
        {gate.toRole ? ` — ${gate.toRole}` : ''}
      </p>

      {/* Rationale */}
      <p className="text-xs text-ivory-dim leading-relaxed mb-3 italic">
        {gate.rationale}
      </p>

      {/* Send error */}
      {gate.sendError && (
        <div
          className="text-xs p-2 rounded mb-3"
          style={{
            background: 'rgba(232,96,58,0.08)',
            border: '1px solid rgba(232,96,58,0.18)',
            color: 'var(--mb-ember)',
          }}
        >
          <span className="font-semibold">Send failed: </span>
          {gate.sendError}
        </div>
      )}

      {/* Denied next-step cue */}
      {isDenied && (
        <div
          className="text-xs p-2 rounded mb-3"
          style={{
            background: 'rgba(201,160,58,0.06)',
            border: '1px solid rgba(201,160,58,0.18)',
            color: 'var(--mb-ivory-dim)',
          }}
        >
          <span className="font-semibold text-brass">Next step: </span>
          Revise the draft and resubmit — return to the linked thread to address the feedback.
        </div>
      )}

      {/* Actions */}
      {!isSent && !isSending && (
        <div className="flex items-center gap-2">
          {isSendable && onApprove && (
            <button
              onClick={() => onApprove(gate)}
              className="flex-1 text-xs font-semibold py-1.5 rounded-md transition-all duration-150 hover:opacity-90"
              style={{ background: 'var(--mb-jade)', color: 'var(--mb-carbon)' }}
              data-automation-id="email-gate-send-button"
            >
              Send ↗
            </button>
          )}
          {(gate.gateStatus === 'needs_review' || gate.gateStatus === 'ready_for_approval') && onDeny && (
            <>
              <button
                onClick={() => onDeny(gate)}
                className="flex-1 text-xs font-medium py-1.5 rounded-md transition-all duration-150"
                style={{
                  background: 'transparent',
                  color: 'var(--mb-ivory-dim)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
                data-automation-id="email-gate-deny-button"
              >
                Not yet
              </button>
            </>
          )}
          {gate.sendError && onRetrySend && (
            <button
              onClick={() => onRetrySend(gate)}
              className="flex-1 text-xs font-medium py-1.5 rounded-md transition-all duration-150 hover:opacity-90"
              style={{ background: 'var(--mb-brass)', color: 'var(--mb-carbon)' }}
            >
              ↻ Retry send
            </button>
          )}
          {/* Thread jump — always available when threadId exists */}
          {gate.threadId && (
            <button
              onClick={onJumpToThread}
              className="text-xs px-3 py-1.5 rounded-md"
              style={{
                background: 'transparent',
                color: 'var(--mb-brass)',
                border: '1px solid rgba(201,160,58,0.3)',
              }}
              title="Jump to linked thread"
              data-automation-id="email-gate-review-thread-button"
            >
              Review thread ↗
            </button>
          )}
        </div>
      )}

      {/* Sent state — thread jump only */}
      {isSent && gate.threadId && (
        <div className="flex items-center gap-2">
          <button
            onClick={onJumpToThread}
            className="flex-1 text-xs px-3 py-1.5 rounded-md transition-all duration-150"
            style={{
              background: 'transparent',
              color: 'var(--mb-brass)',
              border: '1px solid rgba(201,160,58,0.3)',
            }}
          >
            Review thread ↗
          </button>
        </div>
      )}
    </div>
  );
}
