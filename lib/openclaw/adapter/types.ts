/**
 * OpenClaw adapter — normalized app-facing types
 * All gateway raw types are normalized AT this boundary. UI components never
 * import gateway raw types — they consume these types only.
 */

// ---------------------------------------------------------------------------
// Gateway reachability
// ---------------------------------------------------------------------------

export interface GatewayProbeResult {
  ok: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Sessions / Threads
// ---------------------------------------------------------------------------

export interface OpenClawSession {
  id: string;                    // session key, e.g. "agent:main:session:abc123"
  shortId: string;               // shortened for display, e.g. "abc123"
  title: string;                 // human-readable title or "Session abc123"
  agentId: string;               // e.g. "nero", "hephaestus"
  agentName: string;             // display name, e.g. "Nero"
  messageCount: number;          // total messages in session
  lastMessageAt: string | null;  // ISO timestamp of last message
  status: SessionStatus;
  tags: string[];
  preview: string;               // first 120 chars of last message content
  linkedThreadId?: string;       // maps to Signal Loom thread model
}

export type SessionStatus =
  | 'active'           // recent activity
  | 'idle'            // no recent activity
  | 'done'            // concluded
  | 'unknown';

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export interface OpenClawMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool' | 'action-summary';
  content: string;
  timestamp: string;       // ISO timestamp
  agentId?: string;        // which agent sent this (for assistant messages)
}

// ---------------------------------------------------------------------------
// Agent status
// ---------------------------------------------------------------------------

export interface OpenClawAgent {
  id: AgentId;
  name: string;
  status: AgentStatus;
  accentColor: string;
  currentTask?: string;   // human-readable current task description
  lastActiveAt?: string;  // ISO timestamp
  role: string;           // "execution" | "review" | "design" | "research" | "commercial"
}

export type AgentId = 'nero' | 'hephaestus' | 'argus' | 'ariadne' | 'orion' | 'hermes';

export type AgentStatus =
  | 'active'
  | 'waiting_on_nero'
  | 'waiting_on_specialist'
  | 'waiting_on_user'
  | 'blocked'
  | 'done'
  | 'idle'
  | 'unknown';

// ---------------------------------------------------------------------------
// Runtime health
// ---------------------------------------------------------------------------

export interface OpenClawRuntimeHealth {
  gateway: {
    reachable: boolean;
    error?: string;
  };
  queue: {
    healthy: boolean;
    depth?: number;
  };
  heartbeat: {
    fresh: boolean;       // true if last heartbeat < 2 minutes ago
    lastSeen?: string;    // ISO timestamp
  };
  canvas: {
    enabled: boolean;     // always false — canvas-disabled posture
  };
  browser: {
    lanesActive: number;  // e.g. 2
    lanesTotal: number;   // always 4
  };
  uptime?: number;        // gateway uptime in seconds
}

// ---------------------------------------------------------------------------
// Approvals
// ---------------------------------------------------------------------------

export interface OpenClawApproval {
  id: string;
  linkedThreadId?: string;    // associated thread/session
  summary: string;            // human-readable description
  requestedBy: AgentId;        // agent who requested
  requestedAt: string;         // ISO timestamp
  status: ApprovalStatus;
  canResolve: boolean;         // true if approve/deny buttons should show
}

export type ApprovalStatus = 'pending' | 'approved' | 'denied' | 'unknown';

// ---------------------------------------------------------------------------
// Delegation / timeline events
// ---------------------------------------------------------------------------

export interface DelegationEvent {
  id: string;
  threadId?: string;         // associated thread/session
  type: DelegationEventType;
  actor?: AgentId | 'user';
  fromAgent?: string;        // display name for sender
  toAgent?: string;          // display name for recipient
  title?: string;            // human-readable phrasing
  targetAgentId?: AgentId;  // delegate target if applicable
  createdAt?: string;        // ISO timestamp
  timestamp?: string;         // ISO timestamp (used in some contexts)
  taskSummary?: string;      // short description of delegated task
  status?: 'pending' | 'in_progress' | 'completed' | 'blocked';
  linkedMessageId?: string;
  tags?: string[];
}

export type DelegationEventType =
  | 'received'
  | 'delegated'
  | 'returned'
  | 'agent_active'
  | 'agent_returned'
  | 'approval_requested'
  | 'decision_made'
  | 'email_proposed'
  | 'email_approved'
  | 'email_sent'
  | 'email_denied';

// ---------------------------------------------------------------------------
// Email gate (Human-in-the-loop for Hermès email decisions)
// ---------------------------------------------------------------------------

/** Whether Hermès can act autonomously or a human must approve */
export type EmailGateStatus =
  | 'draft'             // Hermès is preparing — not yet ready for review
  | 'needs_review'       // Hermès is ready — human must review before approval
  | 'ready_for_approval' // Hermès recommends — human reviews and approves or revises
  | 'human_approved'    // Human approved — ready to dispatch, not yet sent
  | 'sending'           // Dispatch in progress
  | 'sent'              // Successfully sent via Graph sendMail
  | 'send_failed'       // Send failed — may retry if still approved
  | 'human_denied';    // Human blocked — Hermès must revise and resubmit
  // No email is ever sent without human_approved first.
  // Only 'sent' represents a successful outbound delivery.

export interface EmailGate {
  id: string;
  threadId?: string;
  /** Summary of the proposed email content */
  summary: string;
  /** Who the email is addressed to */
  toRecipient: string;
  toRole?: string;
  /** Executive level detected — always needs_review */
  isExecutive: boolean;
  /** First time Verdantia is emailing this recipient about this topic */
  isNewTopic: boolean;
  /** Hermès confidence: 'high' | 'medium' | 'low' */
  confidence: 'high' | 'medium' | 'low';
  /** Why the gate is in its current state */
  rationale: string;
  /** Human-readable timing of the proposed send */
  proposedTiming: string;
  gateStatus: EmailGateStatus;
  /** ISO timestamp — when gate last changed state */
  lastChangedAt: string;
  /** Human's decision note if any */
  humanNote?: string;
  /** The proposed email itself */
  proposedEmail: {
    subject: string;
    body: string;
    footer?: string;
  };
  /** If true, the current draft has changed since human approval — approval is invalidated */
  approvalInvalidated?: boolean;
  /** Send audit — one entry per meaningful lifecycle event */
  auditLog?: EmailGateAuditEntry[];
  /** ISO timestamp of successful send */
  sentAt?: string;
  /** Last send error message */
  sendError?: string;
  /** Number of send attempts */
  sendAttempts?: number;
}

export interface EmailGateAuditEntry {
  at: string;
  action: EmailGateAuditAction;
  note?: string;
}

export type EmailGateAuditAction =
  | 'draft_created'
  | 'submitted_for_review'
  | 'approved'
  | 'denied'
  | 'revision_submitted'
  | 'approval_invalidated'
  | 'send_initiated'
  | 'send_succeeded'
  | 'send_failed'
  | 'retry_initiated';

/**
 * Input to computeEmailGate()
 */
export interface EmailGateInput {
  threadId?: string;
  summary: string;
  toRecipient: string;
  toRole?: string;
  proposedEmail: {
    subject: string;
    body: string;
  };
  isNewTopic?: boolean;
}

// ---------------------------------------------------------------------------
// Adapter result types (always returned, never thrown to UI)
// ---------------------------------------------------------------------------

export interface AdapterOk<T> {
  ok: true;
  data: T;
  fetchedAt: string;  // ISO timestamp — freshness indicator
}

export interface AdapterError {
  ok: false;
  error: string;     // human-readable error for display
  retryable: boolean;
}

export type AdapterResult<T> = AdapterOk<T> | AdapterError;
