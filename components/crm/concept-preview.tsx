'use client';

import { useCrmStore } from '@/lib/crm/store';
import type { Lead } from '@/lib/crm/types';
import { TIER_LABELS, CONCEPT_TYPE_LABELS } from '@/lib/crm/types';
import { CONCEPT_STATUS_LABELS } from '@/lib/crm/types';
import { getConceptBadgeColor, getConceptBadgeLabel, conceptHasOutput } from '@/lib/crm/concept';

interface ConceptPreviewProps {
  lead: Lead;
  /** Called when the outreach draft for this lead is ready to view/edit */
  onEditDraft?: () => void;
}

export function ConceptPreview({ lead }: ConceptPreviewProps) {
  const concept = lead.concept;
  const hasOutput = conceptHasOutput(concept);
  const isApproved = concept.status === 'approved' || concept.status === 'attached_to_outreach';
  const publicUrl = concept.publicPreviewUrl;

  const screenshots = concept.screenshots ?? [];
  const screenshotCount = screenshots.length;

  const openInNewTab = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const lastVerified = concept.verifiedAt
    ? new Date(concept.verifiedAt).toLocaleString('en-IE', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'Not verified';

  return (
    <div className="flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-mono px-2 py-0.5 rounded"
            style={{
              color: 'var(--mb-carbon)',
              background: 'var(--mb-teal)',
            }}
          >
            {TIER_LABELS[concept.tier]}
          </span>
          <span
            className="text-xs font-mono px-2 py-0.5 rounded"
            style={{
              color: getConceptBadgeColor(concept),
              background: `${getConceptBadgeColor(concept)}18`,
              border: `1px solid ${getConceptBadgeColor(concept)}35`,
            }}
          >
            {getConceptBadgeLabel(concept)}
          </span>
        </div>

        {/* Open in new tab — always available if URL exists */}
        {publicUrl && (
          <button
            onClick={() => openInNewTab(publicUrl)}
            className="text-xs font-mono px-2 py-1 rounded flex items-center gap-1 transition-all hover:opacity-80"
            style={{
              color: 'var(--mb-brass)',
              background: 'rgba(201,160,58,0.08)',
              border: '1px solid rgba(201,160,58,0.25)',
            }}
            title="Open preview in new tab"
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M7 1H11V5M11 1L5 7M4 3H2V10H9V8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Open preview ↗
          </button>
        )}
      </div>

      {/* Public preview URL */}
      <div>
        <p className="text-xs text-ash-muted mb-1">Public preview URL</p>
        {publicUrl ? (
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-mono px-2 py-1 rounded flex-1 truncate"
              style={{
                background: 'rgba(80,200,120,0.06)',
                border: '1px solid rgba(80,200,120,0.15)',
                color: 'var(--mb-jade)',
              }}
              title={publicUrl}
            >
              {publicUrl}
            </span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(publicUrl).catch(() => {});
              }}
              className="text-xs px-2 py-1 rounded flex-shrink-0"
              style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'var(--mb-ash)' }}
              title="Copy URL"
            >
              Copy
            </button>
          </div>
        ) : (
          <div
            className="text-xs font-mono px-2 py-1.5 rounded"
            style={{
              background: 'rgba(232,96,58,0.06)',
              border: '1px solid rgba(232,96,58,0.15)',
              color: 'var(--mb-red)',
            }}
          >
            ⚠ No public URL — preview not yet published
          </div>
        )}
        <p className="text-xs text-ash-muted mt-1">
          Last verified: <span className="text-ivory-dim">{lastVerified}</span>
        </p>
      </div>

      {/* Screenshot strip */}
      <div>
        <p className="text-xs text-ash-muted mb-1">
          Screenshots
          <span className="ml-1 text-ivory-dim">({screenshotCount})</span>
        </p>
        {screenshotCount > 0 ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {screenshots.map((src, i) => (
              <button
                key={i}
                onClick={() => openInNewTab(src)}
                className="flex-shrink-0 w-20 h-14 rounded overflow-hidden border transition-all hover:border-brass"
                style={{ borderColor: 'rgba(255,255,255,0.08)' }}
                title={`Screenshot ${i + 1} — click to open`}
              >
                <img
                  src={src}
                  alt={`Concept screenshot ${i + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.opacity = '0.3';
                  }}
                />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-ash-muted italic">No screenshots attached</p>
        )}
      </div>

      {/* Local preview server info */}
      {concept.buildPath && (
        <div>
          <p className="text-xs text-ash-muted mb-1">Build path</p>
          <p
            className="text-xs font-mono px-2 py-1 rounded truncate"
            style={{
              background: 'rgba(0,0,0,0.2)',
              border: '1px solid rgba(255,255,255,0.05)',
              color: 'var(--mb-ash)',
            }}
            title={concept.buildPath}
          >
            {concept.buildPath}
          </p>
        </div>
      )}

      {/* QA findings */}
      {concept.qaFindings && (
        <div
          className="rounded p-2.5 text-xs"
          style={{
            background: concept.qaFindings.overallPass
              ? 'rgba(80,200,120,0.05)'
              : 'rgba(232,96,58,0.05)',
            border: `1px solid ${concept.qaFindings.overallPass ? 'rgba(80,200,120,0.2)' : 'rgba(232,96,58,0.2)'}`,
          }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <span style={{ color: concept.qaFindings.overallPass ? 'var(--mb-jade)' : 'var(--mb-red)', fontSize: '10px' }}>
              {concept.qaFindings.overallPass ? '✓' : '✗'}
            </span>
            <span
              className="font-semibold"
              style={{ color: concept.qaFindings.overallPass ? 'var(--mb-jade)' : 'var(--mb-red)' }}
            >
              {concept.qaFindings.overallPass ? 'QA Passed' : 'QA Issues Found'}
            </span>
            {concept.qaFindings.reviewedBy && (
              <span className="text-ash-muted ml-auto">
                by {concept.qaFindings.reviewedBy}
              </span>
            )}
          </div>
          {concept.qaFindings.findings.length > 0 && (
            <ul className="ml-4 space-y-0.5">
              {concept.qaFindings.findings.map((f, i) => (
                <li key={i} className="text-ivory-dim">· {f}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Send readiness */}
      <SendReadinessBar lead={lead} />
    </div>
  );
}

/** Glanceable send readiness bar — the most important UX in the CRM */
function SendReadinessBar({ lead }: { lead: Lead }) {
  const { concept } = lead;
  const publicUrl = !!concept.publicPreviewUrl;
  const conceptStatusOk = concept.status === 'approved' || concept.status === 'attached_to_outreach';
  const hasOut = conceptHasOutput(concept);
  const draftOk = !!lead.outbound?.pitchEmail;

  const checks = [
    { label: 'Public preview', ok: publicUrl },
    { label: 'Concept approved', ok: conceptStatusOk },
    { label: 'Output / screenshots', ok: hasOut },
    { label: 'Outreach drafted', ok: draftOk },
    { label: 'Human approved', ok: false }, // always false in UI — requires manual step
  ];

  const allOk = checks.every((c) => c.ok);
  const blocking = checks.filter((c) => !c.ok);

  return (
    <div
      className="rounded p-2.5"
      style={{
        background: allOk ? 'rgba(80,200,120,0.05)' : 'rgba(201,160,58,0.05)',
        border: `1px solid ${allOk ? 'rgba(80,200,120,0.2)' : 'rgba(201,160,58,0.15)'}`,
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold" style={{ color: allOk ? 'var(--mb-jade)' : 'var(--mb-brass)' }}>
          {allOk ? '✓ Send ready' : '⚠ Send blocked'}
        </p>
        <span className="text-xs font-mono text-ash-muted">
          {checks.filter((c) => c.ok).length}/{checks.length} checks
        </span>
      </div>

      <div className="space-y-1">
        {checks.map(({ label, ok }) => (
          <div key={label} className="flex items-center gap-2">
            <span style={{ color: ok ? 'var(--mb-jade)' : 'var(--mb-red)', fontSize: '9px' }}>
              {ok ? '✓' : '✗'}
            </span>
            <span
              className="text-xs flex-1"
              style={{ color: ok ? 'var(--mb-jade)' : 'var(--mb-ivory-dim)' }}
            >
              {label}
            </span>
            {!ok && label === 'Public preview' && (
              <span className="text-xs text-brass italic">needs URL</span>
            )}
            {!ok && label === 'Concept approved' && (
              <span className="text-xs text-brass italic">awaiting approval</span>
            )}
            {!ok && label === 'Outreach drafted' && (
              <span className="text-xs text-brass italic">draft in progress</span>
            )}
            {!ok && label === 'Human approved' && (
              <span className="text-xs text-brass italic">manual step</span>
            )}
          </div>
        ))}
      </div>

      {!allOk && blocking.length > 0 && (
        <p className="text-xs text-ivory-dim mt-2 italic">
          Next: {blocking[0].label.toLowerCase()}
        </p>
      )}
    </div>
  );
}
