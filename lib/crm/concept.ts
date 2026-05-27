/**
 * CRM — Concept Package business logic
 * Status transitions, send gating, and stage helpers.
 */

import type {
  Lead,
  ConceptPackage,
  ConceptStatus,
  LeadStage,
  SendGate,
} from './types';
import {
  CONCEPT_STATUS_LABELS,
  TIER_LABELS,
  LEAD_STAGE_LABELS,
} from './types';

// ---------------------------------------------------------------------------
// Concept status helpers
// ---------------------------------------------------------------------------

/** Whether a concept has any tangible output (preview URL or screenshots) */
export function conceptHasOutput(cp: ConceptPackage): boolean {
  return !!(cp.previewUrl || (cp.screenshots && cp.screenshots.length > 0));
}

/** Whether a concept is in a terminal/usable state */
export function conceptIsApproved(cp: ConceptPackage): boolean {
  return cp.status === 'approved' || cp.status === 'attached_to_outreach';
}

/** Human-readable concept status for UI display */
export function getConceptStatusLabel(status: ConceptStatus): string {
  return CONCEPT_STATUS_LABELS[status] ?? status;
}

/** Short badge label for concept status — used in cards/lists */
export function getConceptBadgeLabel(cp: ConceptPackage): string {
  if (cp.status === 'not_started') return 'No concept';
  if (cp.status === 'approved')    return '✓ Concept ready';
  if (cp.status === 'attached_to_outreach') return '✓ Attached';
  if (cp.status === 'building')     return '⏳ Building…';
  if (cp.status === 'internal_review')    return '🔍 In review';
  if (cp.status === 'rework_needed')      return '⚠ Rework needed';
  if (cp.status === 'brief_ready')        return '📋 Brief ready';
  return CONCEPT_STATUS_LABELS[cp.status];
}

/** Color variable for concept status badge */
export function getConceptBadgeColor(cp: ConceptPackage): string {
  switch (cp.status) {
    case 'approved':
    case 'attached_to_outreach': return 'var(--mb-jade)';
    case 'not_started':         return 'var(--mb-ash)';
    case 'brief_ready':         return 'var(--mb-brass)';
    case 'building':             return 'var(--mb-brass)';
    case 'internal_review':     return 'rgba(96,165,250,0.9)'; // blue-ish
    case 'rework_needed':        return 'var(--mb-red)';
    default:                     return 'var(--mb-ash)';
  }
}

// ---------------------------------------------------------------------------
// Stage helpers
// ---------------------------------------------------------------------------

/** Human-readable label for a lead stage */
export function getStageLabel(stage: LeadStage): string {
  return LEAD_STAGE_LABELS[stage] ?? stage;
}

/** Whether a lead can logically transition from `from` stage to `to` stage */
export function canTransitionStage(from: LeadStage, to: LeadStage): boolean {
  const order: LeadStage[] = [
    'lead_found',
    'qualified',
    'researched',
    'opportunity_brief_ready',
    'concept_brief_ready',
    'concept_in_build',
    'concept_in_review',
    'concept_approved',
    'outreach_drafted',
    'awaiting_human_approval',
    'sent',
    'monitor',
    'parked',
    'suppressed',
  ];
  const fi = order.indexOf(from);
  const ti = order.indexOf(to);
  // Allow forward or backward navigation along the pipeline
  if (fi === -1 || ti === -1) return false;
  return true; // allow any registered stage transition; UI enforces forward-only by hiding back arrows
}

// ---------------------------------------------------------------------------
// Send gate — the hard concept rule
// ---------------------------------------------------------------------------

export interface EmailGateConceptSummary {
  /** Whether the email gate exists */
  gateExists: boolean;
  /** Email gate status */
  gateStatus: string;
  /** Whether human has approved the email */
  humanApproved: boolean;
}

/**
 * Compute whether an outreach email can be sent for a given lead.
 * Returns a detailed SendGate with per-check booleans.
 *
 * Hard rule: No concept = No send.
 * The concept must be approved AND have output (preview/screenshot).
 */
export function computeSendGate(
  lead: Lead,
  emailGate: EmailGateConceptSummary | null
): SendGate {
  const { concept, outbound } = lead;

  const checks = {
    conceptExists:      concept !== undefined && concept.status !== 'not_started',
    conceptApproved:    conceptIsApproved(concept),
    conceptHasOutput:   conceptHasOutput(concept),
    publicPreviewUrl:  !!concept.publicPreviewUrl,
    outreachDrafted:   !!(outbound?.pitchEmail),
    humanApproved:     emailGate?.humanApproved ?? false,
    mailboxReady:      true, // TODO: wire real Graph/mailbox readiness check
  };

  const ok = Object.entries(checks).every(([, v]) => v);

  let reason: string | undefined;
  if (!ok) {
    if (!checks.conceptExists)
      reason = `Concept missing — cannot send. Start by having Forge build a concept.`;
    else if (!checks.conceptApproved)
      reason = `Concept is "${getConceptStatusLabel(concept.status).toLowerCase()}" — must be approved before send.`;
    else if (!checks.conceptHasOutput)
      reason = `Concept has no preview or screenshots — cannot attach to outreach.`;
    else if (!checks.publicPreviewUrl)
      reason = `No public preview URL — publish the concept preview before sending.`;
    else if (!checks.outreachDrafted)
      reason = `Outreach draft not written yet — Hermes must draft first.`;
    else if (!checks.humanApproved)
      reason = `Email not yet approved — review and approve in the Approvals panel.`;
    else if (!checks.mailboxReady)
      reason = `System not ready — check Graph/mailbox configuration.`;
  }

  return { ok, reason, checks };
}

/**
 * Compute which send gate check is the primary blocker.
 * Returns the first failing check id, or null if all pass.
 */
export function getPrimaryBlocker(gate: SendGate): keyof SendGate['checks'] | null {
  if (gate.ok) return null;
  const entries: [keyof SendGate['checks'], boolean][] = [
    ['conceptExists',      gate.checks.conceptExists],
    ['conceptApproved',    gate.checks.conceptApproved],
    ['conceptHasOutput',   gate.checks.conceptHasOutput],
    ['publicPreviewUrl',  gate.checks.publicPreviewUrl],
    ['outreachDrafted',   gate.checks.outreachDrafted],
    ['humanApproved',     gate.checks.humanApproved],
    ['mailboxReady',      gate.checks.mailboxReady],
  ];
  const firstFailing = entries.find(([, v]) => !v);
  return firstFailing?.[0] ?? null;
}

// ---------------------------------------------------------------------------
// Default concept package for new leads
// ---------------------------------------------------------------------------

export function createEmptyConcept(): ConceptPackage {
  return {
    status: 'not_started',
    conceptType: 'homepage_mock',
    tier: 1,
    screenshots: [],
    lastChangedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Default lead factory
// ---------------------------------------------------------------------------

export function createLead(partial: Partial<Lead> & { id: string; name: string; businessName: string; contact: Lead['contact'] }): Lead {
  return {
    score: 0,
    stage: 'lead_found',
    concept: createEmptyConcept(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...partial,
  };
}

// ---------------------------------------------------------------------------
// Tier description
// ---------------------------------------------------------------------------

export function getTierDescription(tier: 1 | 2 | 3): string {
  switch (tier) {
    case 1: return 'Single-page homepage mockup — fast to produce, high visual impact.';
    case 2: return 'Multi-section page preview — shows structure and key pages.';
    case 3: return 'Full demo site with navigation — most effort, highest conviction.';
  }
}

export function getTierLabel(tier: 1 | 2 | 3): string {
  return TIER_LABELS[tier];
}
