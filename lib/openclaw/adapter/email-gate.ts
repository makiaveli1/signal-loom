/**
 * Human-in-the-loop email gate for Hermès.
 *
 * Hermès has envelope authority over ROUTING, TIMING, and FRAMING — but not
 * everything. This module decides when a human must be in the loop.
 *
 * Gate principle: Hermès handles what it CAN handle. The gate is exclusive —
 * either Hermès acts OR a human acts, never both.
 *
 * Gate criteria (from sprint brief):
 * 1. New template/topic for recipient → ready_to_send (4h window, default send)
 * 2. Escalation to executive → review_required (explicit approval needed)
 * 3. Low confidence → notification_with_override
 * 4. Explicit human request → held for response
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
// New topic detection
// ---------------------------------------------------------------------------

// In production this would check a database of known topic→recipient pairs.
// Here we use a simple in-memory set for the session.
const knownTopicRecipientPairs = new Set<string>();

export function registerTopicRecipientPair(topic: string, recipient: string): void {
  knownTopicRecipientPairs.add(`${topic.toLowerCase()}::${recipient.toLowerCase()}`);
}

export function isNewTopic(topic: string, recipient: string): boolean {
  return !knownTopicRecipientPairs.has(`${topic.toLowerCase()}::${recipient.toLowerCase()}`);
}

// ---------------------------------------------------------------------------
// Confidence scoring
// ---------------------------------------------------------------------------

const LOW_CONFIDENCE_PHRASES = [
  'i think', 'might be', 'maybe', 'perhaps', 'possibly',
  'not sure', 'uncertain', 'not certain', 'could be',
  '初步', '暂时', '估计', '大概', // Chinese low-confidence markers
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
// SLA deadline computation
// ---------------------------------------------------------------------------

const SLA_HOURS: Record<string, number> = {
  // Verdantia standard SLAs
  inquiry_response: 4,
  proposal_followup: 24,
  meeting_request: 8,
  executive_outreach: 2,
  general: 48,
  new_lead: 1,
};

function computeSLADeadline(category: string = 'general'): string {
  const hours = SLA_HOURS[category] ?? SLA_HOURS.general;
  const deadline = new Date(Date.now() + hours * 60 * 60 * 1000);
  return deadline.toISOString();
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
 * Determine the email gate status for a proposed email.
 *
 * Rules (exclusive — first matching rule wins):
 * 1. If to executive → review_required (explicit approval needed, never auto-sends)
 * 2. If new topic for this recipient → ready_to_send (4h window, defaults to send)
 * 3. If low confidence → review_required
 * 4. If is a reply to a recent thread → clear (routine response)
 * 5. Otherwise → clear (Hermès acts autonomously)
 */
export function computeEmailGate(input: EmailGateInput): EmailGateResult {
  const { threadId, summary, toRecipient, toRole, proposedEmail } = input;
  const { subject, body } = proposedEmail;

  // Rule 1: Executive escalation → explicit approval required
  if (isExecutive(toRecipient, toRole)) {
    const gate: EmailGate = {
      id: `gate-${threadId}-${Date.now()}`,
      threadId,
      summary,
      toRecipient,
      toRole,
      isExecutive: true,
      isNewTopic: isNewTopic(subject, toRecipient),
      confidence: scoreConfidence(body),
      rationale: `Escalation to executive (${toRole ?? toRecipient}) — explicit human approval required before send.`,
      proposedTiming: 'Within 2 hours (SLA: executive)',
      slaDeadline: computeSLADeadline('executive_outreach'),
      gateStatus: 'review_required',
      proposedEmail: {
        subject,
        body,
        footer: buildEmailFooter(),
      },
    };
    return { gate, status: 'review_required', rationale: gate.rationale };
  }

  // Rule 2: New topic for this recipient → 4h notification window
  const newTopic = isNewTopic(subject, toRecipient);
  if (newTopic) {
    const gate: EmailGate = {
      id: `gate-${threadId}-${Date.now()}`,
      threadId,
      summary,
      toRecipient,
      toRole,
      isExecutive: false,
      isNewTopic: true,
      confidence: scoreConfidence(body),
      rationale: `First Verdantia email to ${toRecipient} about this topic. You have 4 hours to review before it auto-sends, or tap "Revise" to edit now.`,
      proposedTiming: 'In ~4 hours (default — will auto-send unless you intervene)',
      gateStatus: 'ready_to_send',
      gateOpenedAt: new Date().toISOString(),
      proposedEmail: {
        subject,
        body,
        footer: buildEmailFooter(),
      },
    };
    return { gate, status: 'ready_to_send', rationale: gate.rationale };
  }

  // Rule 3: Low confidence → review required
  const confidence = scoreConfidence(body);
  if (confidence === 'low') {
    const gate: EmailGate = {
      id: `gate-${threadId}-${Date.now()}`,
      threadId,
      summary,
      toRecipient,
      toRole,
      isExecutive: false,
      isNewTopic: false,
      confidence,
      rationale: `Hermès has low confidence in this email — it contains hedging language or uncertain phrasing. Review before sending.`,
      proposedTiming: 'When you\'re ready (no auto-send)',
      gateStatus: 'review_required',
      proposedEmail: {
        subject,
        body,
        footer: buildEmailFooter(),
      },
    };
    return { gate, status: 'review_required', rationale: gate.rationale };
  }

  // Rule 4: Reply to recent thread → clear (routine)
  if (input.isReply && input.lastEmailAt) {
    const hoursSince = (Date.now() - new Date(input.lastEmailAt).getTime()) / (1000 * 60 * 60);
    if (hoursSince < 72) {
      const gate: EmailGate = {
        id: `gate-${threadId}-${Date.now()}`,
        threadId,
        summary,
        toRecipient,
        toRole,
        isExecutive: false,
        isNewTopic: false,
        confidence: 'high',
        rationale: 'Routine reply to an active thread — Hermès sending autonomously.',
        proposedTiming: 'Now',
        gateStatus: 'clear',
        proposedEmail: {
          subject,
          body,
          footer: buildEmailFooter(),
        },
      };
      return { gate, status: 'clear', rationale: gate.rationale };
    }
  }

  // Rule 5: Default → Hermès acts autonomously
  const gate: EmailGate = {
    id: `gate-${threadId}-${Date.now()}`,
    threadId,
    summary,
    toRecipient,
    toRole,
    isExecutive: false,
    isNewTopic: false,
    confidence,
    rationale: 'Within Hermès\'s autonomous authority — routing, timing, and framing approved.',
    proposedTiming: 'Within SLA window',
    slaDeadline: computeSLADeadline('general'),
    gateStatus: 'clear',
    proposedEmail: {
      subject,
      body,
      footer: buildEmailFooter(),
    },
  };
  return { gate, status: 'clear', rationale: gate.rationale };
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
// Human decision recording
// ---------------------------------------------------------------------------

export function approveEmailGate(gate: EmailGate, note?: string): EmailGate {
  registerTopicRecipientPair(gate.proposedEmail.subject, gate.toRecipient);
  return {
    ...gate,
    gateStatus: 'human_approved',
    humanActedAt: new Date().toISOString(),
    humanNote: note,
  };
}

export function denyEmailGate(gate: EmailGate, note?: string): EmailGate {
  return {
    ...gate,
    gateStatus: 'human_denied',
    humanActedAt: new Date().toISOString(),
    humanNote: note,
  };
}

export function reviseEmailGate(gate: EmailGate, revisedEmail: { subject: string; body: string }): EmailGate {
  // Re-compute gate based on the revised content
  const result = computeEmailGate({
    threadId: gate.threadId ?? '',
    summary: gate.summary,
    toRecipient: gate.toRecipient,
    toRole: gate.toRole,
    proposedEmail: revisedEmail,
  });
  return {
    ...result.gate,
    id: gate.id, // keep original gate ID
    humanActedAt: new Date().toISOString(),
  };
}
