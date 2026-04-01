/**
 * CRM — Core domain types
 * Lead, Concept Package, and pipeline stage definitions.
 */

// ---------------------------------------------------------------------------
// Concept Package
// ---------------------------------------------------------------------------

export type ConceptStatus =
  | 'not_started'       // No concept work begun
  | 'brief_ready'       // Opportunity brief complete, concept brief drafted
  | 'building'          // Forge is building the concept
  | 'internal_review'   // Ariadne doing visual QA
  | 'approved'          // Concept approved — ready to attach to outreach
  | 'rework_needed'    // Ariadne or Nero rejected — rework required
  | 'attached_to_outreach'; // Concept is live in an outreach draft

export type ConceptType =
  | 'homepage_mock'      // Tier 1 — polished single-page homepage concept
  | 'multi_page_preview' // Tier 2 — multi-section preview with key pages
  | 'full_demo_site';   // Tier 3 — fuller demo site with navigation flow

export interface ConceptQA {
  findings: string[];
  reviewedBy?: string;   // agent id
  reviewedAt?: string;   // ISO
  overallPass: boolean;
}

export interface ConceptPackage {
  /** 'not_started' | 'brief_ready' | 'building' | 'internal_review' | 'approved' | 'rework_needed' | 'attached_to_outreach' */
  status: ConceptStatus;
  conceptType: ConceptType;
  /** URL where the live concept/preview is hosted */
  previewUrl?: string;
  /** Array of screenshot file paths or URLs */
  screenshots?: string[];
  /** Local or network path to the build output */
  buildPath?: string;
  /** General notes on the concept */
  notes?: string;
  /** QA review results */
  qaFindings?: ConceptQA;
  /** Who approved this concept */
  approvedBy?: string;
  approvedAt?: string; // ISO
  /** ISO timestamp of last meaningful status change */
  lastChangedAt: string;
  /** Chosen tier for this lead */
  tier: 1 | 2 | 3;
}

export const CONCEPT_STATUS_LABELS: Record<ConceptStatus, string> = {
  not_started:         'Concept not started',
  brief_ready:         'Brief ready',
  building:            'Building concept',
  internal_review:     'In internal review',
  approved:            'Concept approved',
  rework_needed:       'Rework needed',
  attached_to_outreach:'Attached to outreach',
};

export const CONCEPT_TYPE_LABELS: Record<ConceptType, string> = {
  homepage_mock:      'Homepage Mock (Tier 1)',
  multi_page_preview: 'Multi-page Preview (Tier 2)',
  full_demo_site:     'Full Demo Site (Tier 3)',
};

export const TIER_LABELS: Record<1 | 2 | 3, string> = {
  1: 'Tier 1 — Homepage Mock',
  2: 'Tier 2 — Multi-page Preview',
  3: 'Tier 3 — Full Demo Site',
};

// ---------------------------------------------------------------------------
// Lead pipeline stages — extended for concept-first workflow
// ---------------------------------------------------------------------------

export type LeadStage =
  | 'lead_found'
  | 'qualified'
  | 'researched'
  | 'opportunity_brief_ready'
  | 'concept_brief_ready'
  | 'concept_in_build'
  | 'concept_in_review'
  | 'concept_approved'
  | 'outreach_drafted'
  | 'awaiting_human_approval'
  | 'sent'
  | 'monitor'
  | 'parked'
  | 'suppressed';

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  lead_found:                'Lead Found',
  qualified:                 'Qualified',
  researched:                 'Researched',
  opportunity_brief_ready:    'Opportunity Brief Ready',
  concept_brief_ready:       'Concept Brief Ready',
  concept_in_build:          'Concept In Build',
  concept_in_review:         'Concept In Review',
  concept_approved:          'Concept Approved',
  outreach_drafted:           'Outreach Drafted',
  awaiting_human_approval:   'Awaiting Human Approval',
  sent:                      'Sent',
  monitor:                   'Monitor',
  parked:                    'Parked',
  suppressed:                'Suppressed',
};

/**
 * Stages that require a concept to be in 'approved' before a lead can enter them.
 * A lead cannot enter any stage >= APPROVAL_REQUIRED_STAGE without an approved concept.
 */
export const CONCEPT_REQUIRED_STAGES: readonly LeadStage[] = [
  'concept_in_build',
  'concept_in_review',
  'concept_approved',
  'outreach_drafted',
  'awaiting_human_approval',
  'sent',
] as const;

export function isConceptRequiredStage(stage: LeadStage): boolean {
  return (CONCEPT_REQUIRED_STAGES as readonly string[]).includes(stage);
}

// ---------------------------------------------------------------------------
// Lead
// ---------------------------------------------------------------------------

export interface LeadContact {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  phoneSecondary?: string;
  linkedin?: string;
}

export interface Lead {
  id: string;                   // slug, e.g. "brian-mcgarry-plumber"
  name: string;
  businessName: string;
  industry?: string;
  location?: string;
  website?: string;
  score: number;
  contact: LeadContact;
  /** Current pipeline stage */
  stage: LeadStage;
  /** Previous stage — for back-navigation */
  previousStage?: LeadStage;
  /** The first-class concept package */
  concept: ConceptPackage;
  /** Raw notes — business research, conversation logs, etc. */
  notes?: string;
  /** Outbound record — may reference the concept */
  outbound?: {
    pitchEmail?: string;
    sentAt?: string;
    sendStatus?: 'pending' | 'sent' | 'failed';
  };
  createdAt: string;  // ISO
  updatedAt: string;  // ISO
  tags?: string[];
}

// ---------------------------------------------------------------------------
// Send blocking
// ---------------------------------------------------------------------------

export interface SendGate {
  ok: boolean;
  reason?: string;
  /** If blocked, which specific check failed */
  checks: {
    conceptExists:    boolean;
    conceptApproved:  boolean;
    conceptHasPreview: boolean; // previewUrl OR screenshots
    outreachDrafted:  boolean;
    humanApproved:    boolean; // email gate human_approved
    mailboxReady:     boolean;  // Graph/system readiness
  };
}

export type SendGateCheckId = keyof SendGate['checks'];

/** Human-readable labels for send gate checks */
export const SEND_GATE_CHECK_LABELS: Record<SendGateCheckId, string> = {
  conceptExists:     'Concept exists',
  conceptApproved:   'Concept approved',
  conceptHasPreview: 'Preview or screenshots available',
  outreachDrafted:   'Outreach draft written',
  humanApproved:     'Human approved email',
  mailboxReady:      'System / mailbox ready',
};
