'use client';

import { useState } from 'react';
import type { EmailGate } from '@/lib/openclaw/adapter/types';
import { approveEmailGate, denyEmailGate, reviseEmailGate } from '@/lib/openclaw/adapter/email-gate';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Status → visual config
// No state is sendable without human_approved.
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  EmailGate['gateStatus'],
  { label: string; color: string; bg: string; border: string; canApprove: boolean; canRevise: boolean }
> = {
  draft: {
    label: 'Draft',
    color: 'var(--mb-ash)',
    bg: 'rgba(128,128,120,0.06)',
    border: 'rgba(128,128,120,0.2)',
    canApprove: false,
    canRevise: true,
  },
  needs_review: {
    label: 'Needs Review',
    color: 'var(--mb-red)',
    bg: 'rgba(232,96,58,0.08)',
    border: 'rgba(232,96,58,0.25)',
    canApprove: true,
    canRevise: true,
  },
  ready_for_approval: {
    label: 'Awaiting Your Approval',
    color: 'var(--mb-brass)',
    bg: 'rgba(201,160,58,0.08)',
    border: 'rgba(201,160,58,0.25)',
    canApprove: true,
    canRevise: true,
  },
  human_approved: {
    label: 'Approved ✓',
    color: 'var(--mb-jade)',
    bg: 'rgba(80,200,120,0.06)',
    border: 'rgba(80,200,120,0.2)',
    canApprove: false,
    canRevise: true, // revision invalidates — shown but not prominent
  },
  human_denied: {
    label: 'Not Approved',
    color: 'var(--mb-ash)',
    bg: 'rgba(128,128,120,0.06)',
    border: 'rgba(128,128,120,0.2)',
    canApprove: false,
    canRevise: true,
  },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface EmailGateCardProps {
  gate: EmailGate;
  onApproved?: (gate: EmailGate, note?: string) => void;
  onDenied?: (gate: EmailGate, note?: string) => void;
  onRevised?: (gate: EmailGate, revised: { subject: string; body: string }) => void;
}

interface HermesEmailComposerProps {
  gates: EmailGate[];
  onApproved?: (gate: EmailGate, note?: string) => void;
  onDenied?: (gate: EmailGate, note?: string) => void;
  onRevised?: (gate: EmailGate, revised: { subject: string; body: string }) => void;
}

// ---------------------------------------------------------------------------
// Email gate card
// ---------------------------------------------------------------------------

function EmailGateCard({ gate, onApproved, onDenied, onRevised }: EmailGateCardProps) {
  const config = STATUS_CONFIG[gate.gateStatus];
  const [mode, setMode] = useState<'view' | 'revise'>(gate.gateStatus === 'draft' ? 'revise' : 'view');
  const [revisedSubject, setRevisedSubject] = useState(gate.proposedEmail.subject);
  const [revisedBody, setRevisedBody] = useState(gate.proposedEmail.body);
  const [note, setNote] = useState('');

  // If approved email was revised, show invalidation notice
  const invalidated = gate.approvalInvalidated;

  return (
    <div
      className="rounded-lg border p-3 space-y-2.5"
      style={{
        background: config.bg,
        borderColor: config.border,
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-xs font-semibold px-1.5 py-0.5 rounded font-mono"
            style={{
              color: config.color,
              background: `${config.color}15`,
            }}
          >
            {config.label}
          </span>
          {/* Invalidated approval notice */}
          {invalidated && (
            <span
              className="text-xs px-1.5 py-0.5 rounded font-mono"
              style={{
                color: 'var(--mb-brass)',
                background: 'rgba(201,160,58,0.15)',
              }}
            >
              ⚠ Draft changed — approval reset
            </span>
          )}
          {/* Confidence badge */}
          {gate.confidence === 'low' && (
            <span
              className="text-xs px-1.5 py-0.5 rounded font-mono"
              style={{ color: 'var(--mb-ash)', background: 'rgba(128,128,120,0.1)' }}
            >
              Low confidence
            </span>
          )}
        </div>
        {config.canRevise && (
          <button
            onClick={() => setMode(mode === 'revise' ? 'view' : 'revise')}
            className="text-xs text-ash-muted hover:text-ivory-dim transition-colors flex-shrink-0"
          >
            {mode === 'revise' ? 'Preview' : 'Revise draft'}
          </button>
        )}
      </div>

      {/* Recipient */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-ash-muted">To:</span>
        <span className="text-xs text-ivory-dim">
          {gate.toRecipient}
          {gate.toRole && <span className="text-ash-muted ml-1">({gate.toRole})</span>}
        </span>
      </div>

      {/* Rationale — explains scrutiny level, not sendability */}
      <p className="text-xs text-ivory-dim leading-relaxed italic">
        {gate.rationale}
      </p>

      {/* Email preview or editor */}
      {mode === 'view' ? (
        <div
          className="rounded border p-2.5 space-y-1.5"
          style={{
            background: 'rgba(0,0,0,0.2)',
            borderColor: 'rgba(255,255,255,0.06)',
          }}
        >
          <div className="flex items-start gap-2">
            <span className="text-xs font-mono text-ash-muted flex-shrink-0 mt-0.5">Subj:</span>
            <span className="text-xs text-ivory font-medium leading-snug">
              {gate.proposedEmail.subject}
            </span>
          </div>
          <div
            className="text-xs text-ivory-dim leading-relaxed pl-7 whitespace-pre-wrap"
            style={{ maxHeight: '100px', overflow: 'hidden' }}
          >
            {gate.proposedEmail.body.slice(0, 150)}
            {gate.proposedEmail.body.length > 150 && '…'}
          </div>
          {gate.proposedEmail.footer && (
            <div
              className="text-xs text-ash-muted leading-relaxed pl-7 pt-1 whitespace-pre-wrap"
              style={{ fontStyle: 'italic' }}
            >
              {gate.proposedEmail.footer}
            </div>
          )}
        </div>
      ) : (
        /* Revision mode — edit the draft before approving */
        <div className="space-y-2">
          <div className="text-xs text-ash-muted">Edit draft:</div>
          <input
            value={revisedSubject}
            onChange={(e) => setRevisedSubject(e.target.value)}
            className="w-full text-xs px-2 py-1.5 rounded border bg-transparent text-ivory"
            style={{ borderColor: 'rgba(255,255,255,0.1)', outline: 'none' }}
            placeholder="Subject line"
          />
          <textarea
            value={revisedBody}
            onChange={(e) => setRevisedBody(e.target.value)}
            rows={5}
            className="w-full text-xs px-2 py-1.5 rounded border bg-transparent text-ivory resize-none"
            style={{ borderColor: 'rgba(255,255,255,0.1)', outline: 'none' }}
            placeholder="Email body"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full text-xs px-2 py-1.5 rounded border bg-transparent text-ivory"
            style={{ borderColor: 'rgba(255,255,255,0.1)', outline: 'none' }}
            placeholder="Note for Hermès (optional)"
          />
          <div className="flex gap-2">
            <button
              onClick={() => onRevised?.(gate, { subject: revisedSubject, body: revisedBody })}
              className="text-xs px-3 py-1.5 rounded font-medium"
              style={{ background: 'var(--mb-brass)', color: 'var(--mb-carbon)' }}
            >
              Submit revision
            </button>
            <button
              onClick={() => setMode('view')}
              className="text-xs text-ash-muted hover:text-ivory-dim px-2 py-1.5 transition-colors"
            >
              Cancel
            </button>
          </div>
          <p className="text-xs text-ash-muted">
            Submitting a revision will require your approval again before this can be sent.
          </p>
        </div>
      )}

      {/* Action buttons — approval / denial */}
      {mode === 'view' && config.canApprove && (
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => onApproved?.(gate, note || undefined)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded font-semibold"
            style={{ background: 'var(--mb-jade)', color: 'var(--mb-carbon)' }}
          >
            ✓ Approve to send
          </button>
          <button
            onClick={() => onDenied?.(gate, note || undefined)}
            className="text-xs px-3 py-1.5 rounded"
            style={{
              background: 'rgba(255,255,255,0.06)',
              color: 'var(--mb-ivory-dim)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            Not yet
          </button>
          <span className="text-xs text-ash-muted flex-1">
            {gate.proposedTiming}
          </span>
        </div>
      )}

      {/* Human approval confirmation */}
      {mode === 'view' && gate.gateStatus === 'human_approved' && !invalidated && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs" style={{ color: 'var(--mb-jade)' }}>
            ✓ Approved — this email is ready to send. Use Hermès to dispatch when ready.
          </span>
        </div>
      )}

      {/* Denial notice */}
      {mode === 'view' && gate.gateStatus === 'human_denied' && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs text-ash-muted">
            Blocked. Tap "Revise draft" to rework and resubmit.
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hermès Email Composer tab
// ---------------------------------------------------------------------------

export function HermesEmailComposer({
  gates,
  onApproved,
  onDenied,
  onRevised,
}: HermesEmailComposerProps) {
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'denied'>('pending');

  const pending = gates.filter(
    (g) => g.gateStatus === 'needs_review' || g.gateStatus === 'ready_for_approval'
  );
  const approved = gates.filter(
    (g) => g.gateStatus === 'human_approved' && !g.approvalInvalidated
  );
  const denied = gates.filter((g) => g.gateStatus === 'human_denied');

  // All gates that need attention
  const needsAttention = gates.filter(
    (g) =>
      (g.gateStatus === 'needs_review' || g.gateStatus === 'ready_for_approval') ||
      g.approvalInvalidated
  );

  const tabs: {
    key: typeof activeTab;
    label: string;
    count: number;
    color?: string;
  }[] = [
    {
      key: 'pending',
      label: 'Needs review',
      count: needsAttention.length,
      color: 'var(--mb-red)',
    },
    {
      key: 'approved',
      label: 'Approved',
      count: approved.length,
      color: 'var(--mb-jade)',
    },
    {
      key: 'denied',
      label: 'Not approved',
      count: denied.length,
    },
  ];

  const activeGates = { pending: needsAttention, approved, denied }[activeTab];

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div
        className="flex border-b flex-shrink-0"
        style={{ borderColor: 'rgba(255,255,255,0.05)' }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors',
              activeTab === tab.key
                ? 'text-ivory border-ivory/30'
                : 'text-ash-muted border-transparent hover:text-ivory-dim'
            )}
          >
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span
                className="rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-semibold"
                style={{
                  background: tab.color ? `${tab.color}20` : 'rgba(255,255,255,0.1)',
                  color: tab.color ?? 'var(--mb-ivory-dim)',
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Gate list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {activeGates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm"
              style={{ background: 'rgba(255,255,255,0.05)' }}
            >
              ✉
            </div>
            <p className="text-xs text-ash-muted">
              {activeTab === 'pending' && 'No emails need your review'}
              {activeTab === 'approved' && 'No approved emails yet'}
              {activeTab === 'denied' && 'No blocked emails'}
            </p>
            {activeTab === 'approved' && (
              <p className="text-xs text-ash-muted opacity-60">
                Approved emails appear here. Send via Hermès when ready.
              </p>
            )}
          </div>
        ) : (
          activeGates.map((gate) => (
            <EmailGateCard
              key={gate.id}
              gate={gate}
              onApproved={onApproved}
              onDenied={onDenied}
              onRevised={onRevised}
            />
          ))
        )}
      </div>
    </div>
  );
}
