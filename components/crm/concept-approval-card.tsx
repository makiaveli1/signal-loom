'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useCrmStore } from '@/lib/crm/store';
import type { Lead, ConceptPackage } from '@/lib/crm/types';
import { getConceptBadgeLabel, getConceptBadgeColor } from '@/lib/crm/concept';

interface ConceptApprovalCardProps {
  lead: Lead;
  onApproved?: (leadId: string) => void;
  onRework?: (leadId: string, note: string) => void;
}

/** QA findings as a compact list */
function QAFindings({ pkg }: { pkg: ConceptPackage }) {
  if (!pkg.qaFindings?.findings?.length) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-semibold text-ash-muted uppercase tracking-wide">QA Findings</span>
      <ul className="flex flex-col gap-0.5 pl-2">
        {pkg.qaFindings.findings.map((f, i) => (
          <li key={i} className="text-xs text-ivory-dim flex items-start gap-1.5">
            <span className="text-brass flex-shrink-0 mt-0.5">•</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Send gate checklist — shows which conditions are met vs. missing */
function SendGateChecklist({ lead }: { lead: Lead }) {
  const checks = [
    { label: 'Concept exists', ok: !!lead.concept && lead.concept.status !== 'not_started' },
    { label: 'Concept approved', ok: lead.concept.status === 'approved' || lead.concept.status === 'attached_to_outreach' },
    { label: 'Has output (preview/screenshots)', ok: !!(lead.concept.previewUrl || (lead.concept.screenshots?.length ?? 0) > 0) },
    { label: 'Public preview URL', ok: !!lead.concept.publicPreviewUrl },
    { label: 'Outreach drafted', ok: !!lead.outbound?.pitchEmail },
  ];

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-semibold text-ash-muted uppercase tracking-wide">Send Gate</span>
      {checks.map((c) => (
        <div key={c.label} className="flex items-center gap-1.5">
          <span style={{ color: c.ok ? 'var(--mb-jade)' : 'var(--mb-rust)' }}>
            {c.ok ? '✓' : '✗'}
          </span>
          <span className={cn('text-xs', c.ok ? 'text-ivory-dim' : 'text-ivory-dim opacity-60')}>
            {c.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ConceptApprovalCard({ lead, onApproved, onRework }: ConceptApprovalCardProps) {
  const setConceptStatus = useCrmStore((s) => s.setConceptStatus);
  const [reworkNote, setReworkNote] = useState('');
  const [showReworkForm, setShowReworkForm] = useState(false);
  const [submitted, setSubmitted] = useState<'approved' | 'rework' | null>(null);

  const { concept } = lead;
  const badgeLabel = getConceptBadgeLabel(concept);
  const badgeColor = getConceptBadgeColor(concept);
  const isInReview = concept.status === 'internal_review';

  function handleApprove() {
    setConceptStatus(lead.id, 'approved', 'nero');
    setSubmitted('approved');
    onApproved?.(lead.id);
  }

  function handleReworkRequest() {
    if (!reworkNote.trim()) return;
    setConceptStatus(lead.id, 'rework_needed');
    setSubmitted('rework');
    onRework?.(lead.id, reworkNote);
  }

  // Already decided — show the outcome
  if (submitted === 'approved' || concept.status === 'approved' || concept.status === 'attached_to_outreach') {
    return (
      <div
        className="rounded-lg border p-4"
        style={{
          background: 'rgba(80,200,120,0.04)',
          borderColor: 'rgba(80,200,120,0.20)',
        }}
        data-automation-id={`concept-approval-card-${lead.id}-approved`}
      >
        <div className="flex items-center gap-2 mb-3">
          <span
            className="text-xs font-mono px-1.5 py-0.5 rounded"
            style={{ color: 'var(--mb-jade)', background: 'rgba(80,200,120,0.10)' }}
          >
            ✓ Concept Approved
          </span>
          {concept.approvedBy && (
            <span className="text-xs text-ivory-dim">
              by {concept.approvedBy} • {concept.approvedAt ? new Date(concept.approvedAt).toLocaleDateString() : 'just now'}
            </span>
          )}
        </div>
        <p className="text-xs text-ivory-dim">
          Brian's homepage concept is approved. Outreach can proceed once durable preview URL is live
          and Likwid human-approves the outreach email.
        </p>
      </div>
    );
  }

  if (concept.status === 'rework_needed') {
    return (
      <div
        className="rounded-lg border p-4"
        style={{
          background: 'rgba(232,96,58,0.04)',
          borderColor: 'rgba(232,96,58,0.20)',
        }}
        data-automation-id={`concept-approval-card-${lead.id}-rework`}
      >
        <div className="flex items-center gap-2 mb-3">
          <span
            className="text-xs font-mono px-1.5 py-0.5 rounded"
            style={{ color: 'var(--mb-red)', background: 'rgba(232,96,58,0.10)' }}
          >
            ⚠ Rework Needed
          </span>
        </div>
        <p className="text-xs text-ivory-dim">
          Concept has been sent back for rework. Forge must address feedback before re-submission.
        </p>
      </div>
    );
  }

  // In review — show the approval controls
  return (
    <div
      className="rounded-lg border p-4"
      style={{
        background: 'var(--mb-elevated)',
        borderColor: 'rgba(96,165,250,0.25)',
        borderLeftWidth: '3px',
      }}
      data-automation-id={`concept-approval-card-${lead.id}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3 flex-col gap-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-ivory">Concept Review</span>
            <span
              className="text-xs font-mono px-1.5 py-0.5 rounded"
              style={{ color: badgeColor, background: `${badgeColor}15` }}
            >
              {badgeLabel}
            </span>
          </div>
          <span className="text-xs text-ivory-dim">
            {lead.businessName} — {lead.contact.name}
          </span>
        </div>
      </div>

      {/* Concept summary */}
      <div className="flex flex-col gap-2 mb-3 text-xs text-ivory-dim">
        {concept.qaFindings?.overallPass !== undefined && (
          <div className="flex items-center gap-1.5">
            <span style={{ color: concept.qaFindings.overallPass ? 'var(--mb-jade)' : 'var(--mb-red)' }}>
              {concept.qaFindings.overallPass ? '✓' : '✗'}
            </span>
            <span>QA {concept.qaFindings.overallPass ? 'passed' : 'issues found'}</span>
            {concept.qaFindings.reviewedBy && (
              <span className="text-ash-muted">by {concept.qaFindings.reviewedBy}</span>
            )}
          </div>
        )}
        {concept.publicPreviewUrl && (
          <div className="flex items-center gap-1.5">
            <span style={{ color: 'var(--mb-brass)' }}>🔗</span>
            <a
              href={concept.publicPreviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brass underline underline-offset-2 truncate max-w-[200px]"
            >
              Preview URL
            </a>
          </div>
        )}
      </div>

      {/* QA findings */}
      <QAFindings pkg={concept} />

      {/* Rework note form */}
      {showReworkForm && (
        <div className="mt-3 flex flex-col gap-2">
          <textarea
            value={reworkNote}
            onChange={(e) => setReworkNote(e.target.value)}
            placeholder="Describe what needs to be reworked…"
            rows={3}
            className="w-full text-xs bg-graphite border border-white/10 rounded px-3 py-2 text-ivory placeholder:text-ash resize-none focus:outline-none focus:border-brass/40"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={() => setShowReworkForm(false)}
              className="flex-1 text-xs py-1.5 rounded border border-white/10 text-ivory-dim hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleReworkRequest}
              disabled={!reworkNote.trim()}
              className={cn(
                'flex-1 text-xs py-1.5 rounded font-semibold transition-all',
                reworkNote.trim()
                  ? 'bg-red text-ivory hover:opacity-90'
                  : 'bg-graphite text-ash cursor-not-allowed'
              )}
            >
              Send back for rework
            </button>
          </div>
        </div>
      )}

      {/* Action buttons — only shown when in review */}
      {!showReworkForm && isInReview && (
        <div className="flex gap-2 mt-3 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <button
            onClick={handleApprove}
            className="flex-1 text-xs font-semibold py-2 rounded-md transition-all hover:opacity-90"
            style={{ background: 'var(--mb-jade)', color: 'var(--mb-carbon)' }}
            data-automation-id="concept-approve-button"
          >
            ✓ Approve concept
          </button>
          <button
            onClick={() => setShowReworkForm(true)}
            className="flex-1 text-xs py-2 rounded-md border border-white/10 text-ivory-dim hover:bg-white/5 transition-colors"
            data-automation-id="concept-rework-button"
          >
            Request rework
          </button>
        </div>
      )}

      {/* Not in review but not yet approved */}
      {!isInReview && submitted === null && (
        <div className="mt-3 pt-3 border-t text-xs text-ivory-dim" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <SendGateChecklist lead={lead} />
        </div>
      )}
    </div>
  );
}
