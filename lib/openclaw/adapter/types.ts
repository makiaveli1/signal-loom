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
  | 'decision_made';

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
