/**
 * Human-in-the-loop email gate for Hermès.
 *
 * Standing rule: Gbemi / Likwid is the final approver for every outbound email.
 * Hermès may draft, prepare, recommend, and surface review items.
 * No outbound email is ever sent without explicit human approval.
 *
 * The gate determines SCRUTINY LEVEL, not whether approval is needed.
 * Every email needs human approval — the gate decides how much review is warranted.
 *
 * Gate statuses:
 * - draft              Hermès is preparing — not yet ready for human review
 * - needs_review       Higher scrutiny required — human should review carefully
 * - ready_for_approval Standard scrutiny — routine outreach, solid draft
 * - human_approved    Human approved — ONLY this state is sendable
 * - human_denied       Human blocked — Hermès must revise and resubmit
 *
 * Send enforcement: canSend() returns true ONLY for human_approved.
 * requireHumanApproval() throws for all other states.
 */

import type {
  EmailGate,
  EmailGateInput,
  EmailGateStatus,
} from './types';

// ---------------------------------------------------------------------------
// Executive detection
// ---------------------------------------------------------------------------

const EXECUTIVE_TITLES = [
  'ceo', 'cto', 'cfo', 'coo', 'cmo', 'chief',
  'vp', 'vice president', 'svp', 'evp',
  'president', 'founder', 'co-founder',
  'director', 'head of',
];

const SENIOR_KEYWORDS = [
  'executive', 'leadership', 'c-suite', 'csuite',
  'board', 'chairman', 'chairwoman',
];

function isExecutive(recipient: string, role?: string): boolean {
  const combined = `${recipient} ${role ?? ''}`.toLowerCase();
  return (
    EXECUTIVE_TITLES.some((t) => combined.includes(t)) ||
    SENIOR_KEYWORDS.some((k) => combined.includes(k))
  );
}

// ---------------------------------------------------------------------------
// Confidence scoring
// ---------------------------------------------------------------------------

const LOW_CONFIDENCE_PHRASES = [
  'i think', 'might be', 'maybe', 'perhaps', 'possibly',
  'not sure', 'uncertain', 'not certain', 'could be',
  '初步', '暂时', '估计', '大概',
];

const HIGH_CONFIDENCE_PHRASES = [
  'confirmed', 'scheduled', 'agreed', 'approved', 'final',
  'definitely', 'certainly', 'clearly', 'established',
];

function scoreConfidence(body: string): 'high' | 'medium' | 'low' {
  const lower = body.toLowerCase();
  const lowCount = LOW_CONFIDENCE_PHRASES.filter((p) => lower.includes(p)).length;
  const highCount = HIGH_CONFIDENCE_PHRASES.filter((p) => lower.includes(p)).length;
  if (lowCount >= 2) return 'low';
  if (highCount >= 2 && lowCount === 0) return 'high';
  return 'medium';
}

// ---------------------------------------------------------------------------
// Email footer (warm, human, never AI-revealing)
// ---------------------------------------------------------------------------

function buildEmailFooter(): string {
  return (
    '-- \n' +
    'Oluwagbemi Akadiri\n' +
    'Verdantia Ltd\n' +
    'AI Consulting & Training\n' +
    'www.verdantia.ai'
  );
}

// ---------------------------------------------------------------------------
// Core gate computation
// ---------------------------------------------------------------------------

export interface EmailGateResult {
  gate: EmailGate;
  status: EmailGateStatus;
  rationale: string;
}

/**
 * Determine the gate status and scrutiny level for a proposed email.
 *
 * EVERY outbound email requires human approval. This function determines
 * the SCRUTINY LEVEL — how much review the human should apply.
 *
 * Rule: Higher stakes → higher scrutiny. But every email, without exception,
 * requires explicit human approval before it can be sent.
 *
 * High scrutiny (needs_review):
 * - Addressed to an executive role
 * - First contact with this recipient about this topic
 * - Hermès has low confidence in the draft
 *
 * Standard scrutiny (ready_for_approval):
 * - Routine outreach or follow-up to a known contact
 * - Hermès has medium or high confidence
 */
export function computeEmailGate(input: EmailGateInput): EmailGateResult {
  const { threadId, summary, toRecipient, toRole, proposedEmail } = input;
  const { subject, body } = proposedEmail;
  const confidence = scoreConfidence(body);
  const executive = isExecutive(toRecipient, toRole);
  const isNewTopic = input.isNewTopic ?? false;

  const now = new Date().toISOString();

  // High scrutiny: executive, new topic, or low confidence
  if (executive || isNewTopic || confidence === 'low') {
    const reasons: string[] = [];
    if (executive) reasons.push(`addressed to executive role (${toRole ?? toRecipient})`);
    if (isNewTopic) reasons.push('first contact with this recipient about this topic');
    if (confidence === 'low') reasons.push('Hermès has low confidence in this draft');

    const gate: EmailGate = {
      id: `gate-${threadId ?? 'direct'}-${Date.now()}`,
      threadId,
      summary,
      toRecipient,
      toRole,
      isExecutive: executive,
      isNewTopic,
      confidence,
      rationale:
        `Higher scrutiny: ${reasons.join('; ')}. Review carefully before approving. ` +
        `Gbemi — your approval is required before this can be sent.`,
      proposedTiming: executive ? 'Within 2 hours (SLA)' : 'Within 24 hours',
      gateStatus: 'needs_review',
      lastChangedAt: now,
      proposedEmail: {
        subject,
        body,
        footer: buildEmailFooter(),
      },
    };
    return { gate, status: 'needs_review', rationale: gate.rationale };
  }

  // Standard scrutiny — routine or known contact
  // Still requires human approval, but Hermès framing is solid
  const gate: EmailGate = {
    id: `gate-${threadId ?? 'direct'}-${Date.now()}`,
    threadId,
    summary,
    toRecipient,
    toRole,
    isExecutive: false,
    isNewTopic,
    confidence,
    rationale:
      'Standard review. This is a routine outreach or follow-up — ' +
      'but your approval is still required before this goes out.',
    proposedTiming: 'Within SLA window',
    gateStatus: 'ready_for_approval',
    lastChangedAt: now,
    proposedEmail: {
      subject,
      body,
      footer: buildEmailFooter(),
    },
  };
  return { gate, status: 'ready_for_approval', rationale: gate.rationale };
}

// ---------------------------------------------------------------------------
// Send enforcement — the hard rule
// ---------------------------------------------------------------------------

/**
 * ONLY emails in human_approved status may be sent.
 * This is the enforcement point — call this before any send action.
 *
 * Returns true if the email can be sent, false otherwise.
 * Never returns true for draft, needs_review, ready_for_approval, or human_denied.
 */
export function canSend(gate: EmailGate): boolean {
  return gate.gateStatus === 'human_approved';
}

/**
 * Validate that a gate is in a sendable state.
 * Throws if not — use canSend() to check first.
 */
export function requireHumanApproval(gate: EmailGate): void {
  if (!canSend(gate)) {
    throw new Error(
      `Send blocked: email to "${gate.toRecipient}" is "${gate.gateStatus}" — ` +
      `human approval is required before any outbound email.`
    );
  }
}

// ---------------------------------------------------------------------------
// Human decision recording
// ---------------------------------------------------------------------------

export function approveEmailGate(gate: EmailGate, note?: string): EmailGate {
  return {
    ...gate,
    gateStatus: 'human_approved',
    lastChangedAt: new Date().toISOString(),
    humanNote: note,
    approvalInvalidated: false,
  };
}

export function denyEmailGate(gate: EmailGate, note?: string): EmailGate {
  return {
    ...gate,
    gateStatus: 'human_denied',
    lastChangedAt: new Date().toISOString(),
    humanNote: note,
  };
}

/**
 * Revise an email gate with new draft content.
 * If the gate was previously approved, the revision INVALIDATES that approval —
 * the human must review the new draft and approve again.
 */
export function reviseEmailGate(
  gate: EmailGate,
  revisedEmail: { subject: string; body: string }
): EmailGate {
  const wasApproved = gate.gateStatus === 'human_approved';

  const result = computeEmailGate({
    threadId: gate.threadId ?? '',
    summary: gate.summary,
    toRecipient: gate.toRecipient,
    toRole: gate.toRole,
    proposedEmail: revisedEmail,
  });

  return {
    ...result.gate,
    id: gate.id,
    lastChangedAt: new Date().toISOString(),
    // Any revision invalidates prior approval — human must re-review
    approvalInvalidated: wasApproved ? true : undefined,
    humanNote: undefined,
  };
}

/**
 * Clear the approval-invalidated flag after human has re-reviewed the new draft.
 */
export function clearInvalidation(gate: EmailGate): EmailGate {
  return {
    ...gate,
    approvalInvalidated: false,
    lastChangedAt: new Date().toISOString(),
  };
}
