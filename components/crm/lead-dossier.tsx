'use client';

import { useCrmStore } from '@/lib/crm/store';
import {
  LEAD_STAGE_LABELS,
  CONCEPT_STATUS_LABELS,
  TIER_LABELS,
} from '@/lib/crm/types';
import {
  getConceptBadgeLabel,
  getConceptBadgeColor,
  conceptHasOutput,
  conceptIsApproved,
  getTierDescription,
} from '@/lib/crm/concept';
import type { Lead, ConceptStatus } from '@/lib/crm/types';

const STAGE_ORDER: Lead['stage'][] = [
  'lead_found', 'qualified', 'researched', 'opportunity_brief_ready',
  'concept_brief_ready', 'concept_in_build', 'concept_in_review',
  'concept_approved', 'outreach_drafted', 'awaiting_human_approval',
  'sent', 'monitor', 'parked', 'suppressed',
];

const STAGE_COLORS: Record<Lead['stage'], string> = {
  lead_found:               'var(--mb-ash)',
  qualified:               'var(--mb-brass)',
  researched:              'var(--mb-teal)',
  opportunity_brief_ready: 'var(--mb-brass)',
  concept_brief_ready:     'rgba(96,165,250,0.85)',
  concept_in_build:        'rgba(96,165,250,0.85)',
  concept_in_review:       'rgba(96,165,250,0.85)',
  concept_approved:       'var(--mb-jade)',
  outreach_drafted:        'var(--mb-jade)',
  awaiting_human_approval: 'var(--mb-brass)',
  sent:                   'var(--mb-jade)',
  monitor:                'var(--mb-teal)',
  parked:                 'var(--mb-ash)',
  suppressed:             'var(--mb-red)',
};

export function LeadDossier() {
  const { leads, selectedLeadId, selectLead, setStage, setConceptStatus } = useCrmStore();
  const lead = selectedLeadId ? leads.find((l) => l.id === selectedLeadId) : null;

  if (!lead) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-lg"
          style={{ background: 'rgba(255,255,255,0.05)' }}
        >
          👤
        </div>
        <p className="text-sm font-medium text-ash-muted">No lead selected</p>
        <p className="text-xs text-ash-muted opacity-60 max-w-[200px]">
          Select a lead from the list to view their concept package and outreach status.
        </p>
      </div>
    );
  }

  const concept = lead.concept;
  const conceptLabel = getConceptBadgeLabel(concept);
  const conceptColor = getConceptBadgeColor(concept);
  const hasOutput = conceptHasOutput(concept);
  const isApproved = conceptIsApproved(concept);
  const stageColor = STAGE_COLORS[lead.stage];

  const conceptStatuses: ConceptStatus[] = [
    'not_started', 'brief_ready', 'building', 'internal_review',
    'approved', 'rework_needed', 'attached_to_outreach',
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Dossier header */}
      <div
        className="flex items-start justify-between px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.15)' }}
      >
        <div className="flex flex-col gap-0.5 min-w-0">
          <p className="text-sm font-semibold text-ivory truncate">{lead.businessName}</p>
          <p className="text-xs text-ash-muted truncate">{lead.contact.name}{lead.contact.role ? ` — ${lead.contact.role}` : ''}</p>
        </div>
        <button
          onClick={() => selectLead(null)}
          className="text-ash-muted hover:text-ivory-dim ml-2 flex-shrink-0 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Concept status badge */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ash-muted">Concept</h3>
            <span
              className="text-xs font-mono px-2 py-0.5 rounded"
              style={{
                color: conceptColor,
                background: `${conceptColor}18`,
                border: `1px solid ${conceptColor}35`,
              }}
            >
              {conceptLabel}
            </span>
          </div>

          {/* Tier */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-ash-muted">Tier:</span>
            <span className="text-xs font-mono text-ivory-dim">Tier {concept.tier}</span>
            <span className="text-xs text-ash-muted">—</span>
            <span className="text-xs text-ivory-dim">{getTierDescription(concept.tier)}</span>
          </div>

          {/* Stage */}
          <div className="mb-2">
            <p className="text-xs text-ash-muted mb-1">Pipeline stage:</p>
            <div className="flex flex-wrap gap-1">
              {STAGE_ORDER.map((s) => (
                <button
                  key={s}
                  onClick={() => setStage(lead.id, s)}
                  className="text-xs px-1.5 py-0.5 rounded transition-all"
                  style={{
                    color: s === lead.stage ? 'var(--mb-carbon)' : stageColor,
                    background: s === lead.stage ? stageColor : `${stageColor}18`,
                    border: `1px solid ${stageColor}40`,
                    opacity: STAGE_ORDER.indexOf(s) < STAGE_ORDER.indexOf(lead.stage) ? '0.4' : '1',
                  }}
                >
                  {LEAD_STAGE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Concept status transitions */}
          <div>
            <p className="text-xs text-ash-muted mb-1">Concept status:</p>
            <div className="flex flex-wrap gap-1">
              {conceptStatuses.map((cs) => {
                const isActive = cs === concept.status;
                const color = isActive
                  ? getConceptBadgeColor({ ...concept, status: cs })
                  : 'var(--mb-ash)';
                return (
                  <button
                    key={cs}
                    onClick={() => setConceptStatus(lead.id, cs, isActive && cs === 'approved' ? 'nero' : undefined)}
                    className="text-xs px-1.5 py-0.5 rounded transition-all"
                    style={{
                      color: isActive ? 'var(--mb-carbon)' : color,
                      background: isActive ? color : `${color}18`,
                      border: `1px solid ${color}40`,
                    }}
                  >
                    {CONCEPT_STATUS_LABELS[cs]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Output indicators */}
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-full flex items-center justify-center text-xs"
                style={{
                  background: hasOutput ? 'var(--mb-jade)' : 'var(--mb-ash)',
                  color: hasOutput ? 'var(--mb-carbon)' : 'var(--mb-carbon)',
                  fontSize: '8px',
                }}
              >
                {hasOutput ? '✓' : '–'}
              </span>
              <span className="text-xs text-ash-muted">
                {concept.previewUrl ? 'Preview URL' : concept.screenshots?.length ? `${concept.screenshots.length} screenshots` : 'No preview'}
              </span>
            </div>
            {concept.previewUrl && (
              <a
                href={concept.previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-brass hover:underline"
              >
                Open preview ↗
              </a>
            )}
            {concept.notes && (
              <p className="text-xs text-ivory-dim w-full mt-1 italic leading-relaxed border-t pt-2" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                {concept.notes}
              </p>
            )}
          </div>

          {/* QA findings */}
          {concept.qaFindings && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-ash-muted mb-1">QA Review:</p>
              <div
                className="rounded p-2 text-xs"
                style={{
                  background: concept.qaFindings.overallPass ? 'rgba(80,200,120,0.06)' : 'rgba(232,96,58,0.06)',
                  border: `1px solid ${concept.qaFindings.overallPass ? 'rgba(80,200,120,0.2)' : 'rgba(232,96,58,0.2)'}`,
                }}
              >
                <p className="font-semibold mb-1" style={{ color: concept.qaFindings.overallPass ? 'var(--mb-jade)' : 'var(--mb-red)' }}>
                  {concept.qaFindings.overallPass ? '✓ QA Passed' : '✗ QA Issues found'}
                </p>
                {concept.qaFindings.findings.map((f, i) => (
                  <p key={i} className="text-ivory-dim ml-2">· {f}</p>
                ))}
              </div>
            </div>
          )}

          {/* Approved by / at */}
          {concept.approvedBy && (
            <p className="text-xs text-ash-muted mt-2">
              Approved by <span className="text-ivory-dim">{concept.approvedBy}</span>
              {concept.approvedAt && (
                <span> on {new Date(concept.approvedAt).toLocaleDateString('en-IE', { dateStyle: 'medium' })}</span>
              )}
            </p>
          )}
        </section>

        {/* Agent routing */}
        <section
          className="rounded-lg p-3 border"
          style={{
            background: 'rgba(0,0,0,0.12)',
            borderColor: 'rgba(255,255,255,0.04)',
          }}
        >
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ash-muted mb-2">Agent Routing</h3>
          <div className="space-y-1.5">
            <RoutingRow agent="Orion" status={lead.stage === 'researched' ? 'active' : 'idle'} label="Opportunity research" />
            <RoutingRow agent="Forge" status={lead.stage === 'concept_in_build' ? 'active' : 'idle'} label="Concept build" />
            <RoutingRow agent="Ariadne" status={lead.stage === 'concept_in_review' ? 'active' : 'idle'} label="Visual QA review" />
            <RoutingRow agent="Hermes" status={lead.stage === 'outreach_drafted' ? 'active' : 'idle'} label="Draft outreach" />
            <RoutingRow agent="Nero" status={lead.stage === 'awaiting_human_approval' ? 'active' : 'idle'} label="Final approval" />
          </div>
        </section>

        {/* Send gate status */}
        <section
          className="rounded-lg p-3 border"
          style={{
            background: isApproved && hasOutput ? 'rgba(80,200,120,0.04)' : 'rgba(201,160,58,0.04)',
            borderColor: isApproved && hasOutput ? 'rgba(80,200,120,0.15)' : 'rgba(201,160,58,0.15)',
          }}
        >
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ash-muted mb-2">Send Readiness</h3>
          <div className="space-y-1">
            <GateCheckRow label="Concept exists" ok={concept.status !== 'not_started'} />
            <GateCheckRow label="Concept approved" ok={isApproved} />
            <GateCheckRow label="Preview / screenshots available" ok={hasOutput} />
            <GateCheckRow
              label="Outreach drafted"
              ok={!!lead.outbound?.pitchEmail}
              note={!lead.outbound?.pitchEmail ? 'Hermes must draft first' : undefined}
            />
            <GateCheckRow
              label="Human approved email"
              ok={false}
              note="Review and approve in Approvals panel"
            />
          </div>
          {isApproved && hasOutput && lead.outbound?.pitchEmail ? (
            <p className="text-xs mt-2" style={{ color: 'var(--mb-jade)' }}>
              ✓ Lead is sendable — approve email in Approvals panel to dispatch.
            </p>
          ) : (
            <p className="text-xs mt-2 text-ash-muted">
              {concept.status === 'not_started'
                ? '→ Start with Orion to research this lead, then Forge builds the concept.'
                : concept.status !== 'approved'
                ? `→ Concept must reach "approved" status before send is possible.`
                : !hasOutput
                ? '→ Add a preview URL or screenshots to the concept before send.'
                : '→ Draft outreach email with Hermes before this can be sent.'}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function RoutingRow({ agent, status, label }: { agent: string; status: 'active' | 'idle'; label: string }) {
  const colors = {
    active: 'var(--mb-teal)',
    idle: 'var(--mb-ash)',
  };
  return (
    <div className="flex items-center gap-2">
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: colors[status] }}
      />
      <span className="text-xs font-mono" style={{ color: colors[status] }}>{agent}</span>
      <span className="text-xs text-ash-muted flex-1">{label}</span>
      {status === 'active' && (
        <span className="text-xs font-mono" style={{ color: colors[status] }}>●</span>
      )}
    </div>
  );
}

function GateCheckRow({ label, ok, note }: { label: string; ok: boolean; note?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        style={{ color: ok ? 'var(--mb-jade)' : 'var(--mb-red)', fontSize: '10px' }}
      >
        {ok ? '✓' : '✗'}
      </span>
      <span className="text-xs text-ivory-dim flex-1">{label}</span>
      {note && !ok && <span className="text-xs text-ash-muted">{note}</span>}
    </div>
  );
}
