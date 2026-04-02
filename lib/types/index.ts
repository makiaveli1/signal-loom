import type { OpenClawSession } from '@/lib/openclaw/adapter/types';

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
  /** Raw OpenClaw session — attached when thread is created from a real session */
  session?: OpenClawSession;
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
  /** Current decision state — defaults to 'pending' */
  status?: ApprovalStatus;
  /**
   * Source of this approval item.
   * - 'gateway': came from a real requireApproval hook in the gateway
   * - 'derived': inferred from delegation events and session data
   * - 'mock': used in dev mode when no real data is available
   */
  source?: 'gateway' | 'derived' | 'mock';
  /** Human's decision note if any */
  decisionNote?: string;
  /** When status last changed */
  decidedAt?: string;
  /** When raised */
  raisedAt?: string;
}

export type ApprovalStatus =
  | 'pending'    // Awaiting human decision
  | 'approved'   // Human approved — proceed
  | 'denied'    // Human blocked — do not proceed
  | 'revised';  // Human requested changes — revised and resubmitted

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

// Sprint 2: Split View (legacy — superseded by pane system)
export type PaneSide = 'left' | 'right';

export interface SplitViewState {
  enabled: boolean;
  primaryThreadId: string;
  secondaryThreadId: string | null;
  activePane: PaneSide;
}

// Sprint 2.5: Pane System
export type PaneRole = 'primary' | 'secondary' | 'monitor';

export interface Pane {
  id: string;          // 'pane-left' | 'pane-center' | 'pane-right'
  role: PaneRole;
  threadId: string;
  widthRatio: number;  // 0.0–1.0, proportion of available center area width
  active: boolean;
  collapsed: boolean; // for monitor panes, whether it's in collapsed view
}

export type WorkspacePreset =
  | 'focus'       // 1 full pane
  | 'duo'         // 2 equal panes (50/50)
  | 'duo_monitor' // 2 panes + 1 compact monitor
  | 'operator';   // 1 full + 1 compact support

export interface WorkspaceState {
  preset: WorkspacePreset;
  panes: Pane[];
  activePaneId: string;
  monitorCollapsed: boolean;  // true = monitor pane is collapsed to a slim strip
}

export interface ResizeState {
  dragging: boolean;
  paneAId?: string;
  paneBId?: string;
  startX?: number;
  startWidthA?: number;
  startWidthB?: number;
}

// Sprint 2: Composer
export interface ComposerState {
  isSending: boolean;
  error: string | null;
  lastSentAt: string | null;
}
