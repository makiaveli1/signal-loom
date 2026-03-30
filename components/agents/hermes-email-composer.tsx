'use client';

import { useState, useCallback } from 'react';
import { useSignalLoomStore } from '@/lib/store';
import type { EmailGate } from '@/lib/openclaw/adapter/types';
import { approveEmailGate, denyEmailGate, reviseEmailGate } from '@/lib/openclaw/adapter/email-gate';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Gate status → visual config
// ---------------------------------------------------------------------------

const GATE_CONFIG: Record<
  EmailGate['gateStatus'],
  { label: string; color: string; bg: string; border: string; icon: string; description: string }
> = {
  clear: {
    label: 'Hermès sends',
    color: 'var(--mb-teal)',
    bg: 'rgba(80,200,180,0.06)',
    border: 'rgba(80,200,180,0.2)',
    icon: '→',
    description: 'Hermès is handling this autonomously.',
  },
  ready_to_send: {
    label: 'Review in 4h',
    color: 'var(--mb-brass)',
    bg: 'rgba(201,160,58,0.08)',
    border: 'rgba(201,160,58,0.25)',
    icon: '⏱',
    description: "This will auto-send in ~4 hours unless you intervene.",
  },
  review_required: {
    label: 'Your call',
    color: 'var(--mb-red)',
    bg: 'rgba(232,96,58,0.08)',
    border: 'rgba(232,96,58,0.25)',
    icon: '⚠',
    description: 'Human approval required before this goes out.',
  },
  human_approved: {
    label: 'Approved ✓',
    color: 'var(--mb-jade)',
    bg: 'rgba(80,200,120,0.06)',
    border: 'rgba(80,200,120,0.2)',
    icon: '✓',
    description: 'You approved this. Queued for send.',
  },
  human_denied: {
    label: 'Blocked ✗',
    color: 'var(--mb-ash)',
    bg: 'rgba(128,128,120,0.08)',
    border: 'rgba(128,128,120,0.2)',
    icon: '✗',
    description: 'Blocked. Hermès must revise and resubmit.',
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
// Email gate card — shows proposed email and action buttons
// ---------------------------------------------------------------------------

export function EmailGateCard({ gate, onApproved, onDenied, onRevised }: EmailGateCardProps) {
  const config = GATE_CONFIG[gate.gateStatus];
  const [mode, setMode] = useState<'view' | 'revise'>('view');
  const [revisedSubject, setRevisedSubject] = useState(gate.proposedEmail.subject);
  const [revisedBody, setRevisedBody] = useState(gate.proposedEmail.body);
  const [note, setNote] = useState('');

  const isBlocked = gate.gateStatus === 'human_denied' || gate.gateStatus === 'review_required';
  const isPending = gate.gateStatus === 'ready_to_send' || gate.gateStatus === 'review_required';

  // Countdown timer for ready_to_send
  const [countdown, setCountdown] = useState<string>('');
  const updateCountdown = useCallback(() => {
    if (gate.gateStatus !== 'ready_to_send' || !gate.gateOpenedAt) return;
    const elapsed = Date.now() - new Date(gate.gateOpenedAt).getTime();
    const remaining = 4 * 60 * 60 * 1000 - elapsed;
    if (remaining <= 0) {
      setCountdown('0:00');
    } else {
      const h = Math.floor(remaining / (60 * 60 * 1000));
      const m = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
      setCountdown(`${h}:${String(m).padStart(2, '0')}`);
    }
  }, [gate.gateStatus, gate.gateOpenedAt]);

  // Start countdown timer
  useState(() => {
    updateCountdown();
    const interval = setInterval(updateCountdown, 30_000);
    return () => clearInterval(interval);
  });

  return (
    <div
      className="rounded-lg border p-3 space-y-2"
      style={{
        background: config.bg,
        borderColor: config.border,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-semibold px-1.5 py-0.5 rounded font-mono"
            style={{
              color: config.color,
              background: `${config.color}15`,
            }}
          >
            {config.label}
          </span>
          {countdown && gate.gateStatus === 'ready_to_send' && (
            <span
              className="text-xs font-mono"
              style={{ color: 'var(--mb-brass)' }}
            >
              ⏱ {countdown} remaining
            </span>
          )}
        </div>
        {isPending && onRevised && (
          <button
            onClick={() => setMode(mode === 'revise' ? 'view' : 'revise')}
            className="text-xs text-ash-muted hover:text-ivory-dim transition-colors"
          >
            {mode === 'revise' ? 'Preview' : 'Revise'}
          </button>
        )}
      </div>

      {/* Rationale */}
      <p className="text-xs text-ivory-dim leading-relaxed">
        {gate.rationale}
      </p>

      {/* Email preview */}
      {mode === 'view' ? (
        <div
          className="rounded border p-2 space-y-1.5"
          style={{
            background: 'rgba(0,0,0,0.2)',
            borderColor: 'rgba(255,255,255,0.06)',
          }}
        >
          <div className="flex items-start gap-2">
            <span className="text-xs font-mono text-ash-muted flex-shrink-0">To:</span>
            <span className="text-xs text-ivory-dim">
              {gate.toRecipient}
              {gate.toRole && (
                <span className="text-ash-muted ml-1">({gate.toRole})</span>
              )}
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-xs font-mono text-ash-muted flex-shrink-0">Subj:</span>
            <span className="text-xs text-ivory font-medium">
              {gate.proposedEmail.subject}
            </span>
          </div>
          <div
            className="text-xs text-ivory-dim leading-relaxed pl-7"
            style={{ whiteSpace: 'pre-wrap', maxHeight: '80px', overflow: 'hidden' }}
          >
            {gate.proposedEmail.body.slice(0, 120)}
            {gate.proposedEmail.body.length > 120 ? '…' : ''}
          </div>
          {gate.proposedEmail.footer && (
            <div
              className="text-xs text-ash-muted leading-relaxed pl-7 pt-1"
              style={{ whiteSpace: 'pre-wrap', fontStyle: 'italic' }}
            >
              {gate.proposedEmail.footer}
            </div>
          )}
        </div>
      ) : (
        /* Revise mode */
        <div className="space-y-2">
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
            rows={4}
            className="w-full text-xs px-2 py-1.5 rounded border bg-transparent text-ivory resize-none"
            style={{ borderColor: 'rgba(255,255,255,0.1)', outline: 'none' }}
            placeholder="Email body"
          />
          {isBlocked && (
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full text-xs px-2 py-1.5 rounded border bg-transparent text-ivory"
              style={{ borderColor: 'rgba(255,255,255,0.1)', outline: 'none' }}
              placeholder="Note for Hermès (optional)"
            />
          )}
          <div className="flex gap-2">
            <button
              onClick={() => onRevised?.(gate, { subject: revisedSubject, body: revisedBody })}
              className="text-xs px-3 py-1.5 rounded font-medium transition-colors"
              style={{
                background: 'var(--mb-brass)',
                color: 'var(--mb-carbon)',
              }}
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
        </div>
      )}

      {/* Action buttons — only for gates that need human action */}
      {mode === 'view' && (gate.gateStatus === 'ready_to_send' || gate.gateStatus === 'review_required') && (
        <div className="flex items-center gap-2 pt-1">
          {onApproved && (
            <button
              onClick={() => onApproved(gate, note || undefined)}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded font-medium transition-colors"
              style={{
                background: 'var(--mb-jade)',
                color: 'var(--mb-carbon)',
              }}
            >
              ✓ Approve
            </button>
          )}
          {onDenied && (
            <button
              onClick={() => onDenied(gate, note || undefined)}
              className="text-xs px-3 py-1.5 rounded font-medium transition-colors"
              style={{
                background: 'rgba(255,255,255,0.06)',
                color: 'var(--mb-ivory-dim)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              Block
            </button>
          )}
          {gate.gateStatus === 'ready_to_send' && (
            <span className="text-xs text-ash-muted flex-1">
              Or do nothing — it sends automatically in {countdown || '4h'}.
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hermes Email Composer tab — shows all pending email gates
// ---------------------------------------------------------------------------

export function HermesEmailComposer({ gates, onApproved, onDenied, onRevised }: HermesEmailComposerProps) {
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'sent' | 'blocked'>('pending');

  const pending = gates.filter(
    (g) => g.gateStatus === 'ready_to_send' || g.gateStatus === 'review_required'
  );
  const approved = gates.filter((g) => g.gateStatus === 'human_approved');
  const sent = gates.filter((g) => g.gateStatus === 'clear');
  const blocked = gates.filter((g) => g.gateStatus === 'human_denied');

  const tabs: { key: typeof activeTab; label: string; count: number; color?: string }[] = [
    { key: 'pending', label: 'Pending', count: pending.length },
    { key: 'approved', label: 'Approved', count: approved.length, color: 'var(--mb-jade)' },
    { key: 'sent', label: 'Sent', count: sent.length, color: 'var(--mb-teal)' },
    { key: 'blocked', label: 'Blocked', count: blocked.length, color: 'var(--mb-ash)' },
  ];

  const activeGates = {
    pending,
    approved,
    sent,
    blocked,
  }[activeTab];

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
              'flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-b-2',
              activeTab === tab.key
                ? 'text-ivory border-ivory/30'
                : 'text-ash-muted border-transparent hover:text-ivory-dim'
            )}
          >
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span
                className="text-xs rounded-full w-4 h-4 flex items-center justify-center text-[10px]"
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {activeGates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
              style={{ background: 'rgba(255,255,255,0.05)' }}
            >
              ✉
            </div>
            <p className="text-xs text-ash-muted">
              {activeTab === 'pending' ? 'No pending emails' : `No ${activeTab} emails`}
            </p>
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
