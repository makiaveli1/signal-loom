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

export interface OpenClawDelegationEvent {
  id: string;
  threadId?: string;         // associated thread/session
  type: DelegationEventType;
  actor: AgentId | 'user';
  title: string;             // human-readable phrasing
  targetAgentId?: AgentId;   // delegate target if applicable
  createdAt: string;          // ISO timestamp
  linkedMessageId?: string;
}

export type DelegationEventType =
  | 'received'
  | 'delegated'
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
  | 'clear'           // Hermès can send without human gate
  | 'ready_to_send'   // Human notified, auto-sends in 4h unless overridden
  | 'review_required' // Human must explicitly approve before send
  | 'human_approved'  // Human approved — queued for send
  | 'human_denied';  // Human blocked — Hermès must revise

export interface EmailGate {
  id: string;
  threadId?: string;
  /** Summary of the proposed email content */
  summary: string;
  /** Who the email is addressed to */
  toRecipient: string;
  toRole?: string;
  /** Executive level detected */
  isExecutive: boolean;
  /** First time Verdantia is emailing this recipient about this topic */
  isNewTopic: boolean;
  /** Hermès confidence: 'high' | 'medium' | 'low' */
  confidence: 'high' | 'medium' | 'low';
  /** Why the gate is in its current state */
  rationale: string;
  /** Human-readable timing of the proposed send */
  proposedTiming: string;
  /** SLA deadline if applicable */
  slaDeadline?: string;
  gateStatus: EmailGateStatus;
  /** ISO timestamp — when the gate opened (for 4h countdown) */
  gateOpenedAt?: string;
  /** ISO timestamp — when human last acted */
  humanActedAt?: string;
  /** Human's decision note if any */
  humanNote?: string;
  /** The proposed email itself */
  proposedEmail: {
    subject: string;
    body: string;
    footer?: string;
  };
}

/**
 * Input to computeEmailGate()
 */
export interface EmailGateInput {
  threadId: string;
  summary: string;
  toRecipient: string;
  toRole?: string;
  proposedEmail: {
    subject: string;
    body: string;
  };
  isReply?: boolean;
  lastEmailAt?: string;
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
