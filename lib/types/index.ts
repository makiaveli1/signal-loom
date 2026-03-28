// Thread statuses
export type ThreadStatus =
  | 'active'
  | 'waiting_on_nero'
  | 'waiting_on_specialist'
  | 'waiting_on_user'
  | 'blocked'
  | 'done';

export interface Thread {
  id: string;
  title: string;
  status: ThreadStatus;
  lastActive: string;
  unreadCount: number;
  hasApproval: boolean;
  linkedAgents: string[];
  pinned?: boolean;
  messages: Message[];
}

export type MessageRole = 'user' | 'nero' | 'system' | 'action-summary';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
}

export type AgentStatus = 'active' | 'idle' | 'waiting' | 'done' | 'blocked';

export type AgentId = 'hephaestus' | 'argus' | 'ariadne' | 'orion' | 'hermes';

export interface Agent {
  id: AgentId;
  name: string;
  role: string;
  status: AgentStatus;
  taskPreview: string;
  browserEnabled: boolean;
  accentColor: string;
}

export type ApprovalUrgency = 'high' | 'medium' | 'low';

export interface Approval {
  id: string;
  title: string;
  urgency: ApprovalUrgency;
  raisedBy: string;
  recommendation: string;
  linkedThreadId: string;
}

export type GatewayHealth = 'healthy' | 'degraded' | 'down';
export type QueueHealth = 'healthy' | 'backed_up' | 'stalled';

export interface RuntimeState {
  gateway: GatewayHealth;
  queue: QueueHealth;
  heartbeatFreshness: 'fresh' | 'stale';
  browserLanes: number;
  canvasEnabled: boolean;
  issueCount: number;
  issueDescription?: string;
}

// Sprint 2: Delegation Events
export type DelegationEventType =
  | 'received'
  | 'delegated'
  | 'agent_active'
  | 'agent_returned'
  | 'approval_requested'
  | 'decision_made';

export interface DelegationEvent {
  id: string;
  threadId: string;
  type: DelegationEventType;
  actor: string;
  targetAgentId?: string;
  title: string;
  detail?: string;
  createdAt: string;
  linkedMessageId?: string;
}

// Sprint 2: Split View
export type PaneSide = 'left' | 'right';

export interface SplitViewState {
  enabled: boolean;
  primaryThreadId: string;
  secondaryThreadId: string | null;
  activePane: PaneSide;
}

// Sprint 2: Composer
export interface ComposerState {
  isSending: boolean;
  error: string | null;
  lastSentAt: string | null;
}
