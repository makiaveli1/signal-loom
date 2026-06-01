'use client';

// PRETEXT: Active in dense operator labels via PretextSmartTitle.
// Keep Pretext isolated to small client wrappers; do not measure full message bodies.

import { create } from 'zustand';
import type {
  Thread,
  Approval,
  RuntimeState,
  Agent,
  DelegationEvent,
  SplitViewState,
  ComposerState,
  PaneSide,
  WorkspaceState,
  ResizeState,
  WorkspacePreset,
  Pane,
} from '@/lib/types';
import type { OpenClawSession } from '@/lib/openclaw/adapter/types';

type RuntimeGatewayEvent = {
  type: string;
  data?: {
    source?: string;
    sessionKey?: string;
    parentSessionId?: string | null;
    childSessionId?: string;
    messageId?: string | number;
    toolCallId?: string;
    toolName?: string;
    role?: string;
    text?: string;
    status?: string;
    taskPreview?: string;
    argsPreview?: string;
    resultPreview?: string;
    at?: string;
  };
};

type RuntimeActivity = {
  type: string;
  label: string;
  sessionKey: string;
  parentSessionId?: string | null;
  toolName?: string;
  status: 'active' | 'done' | 'error';
  preview?: string;
  startedAt: string;
  updatedAt: string;
};

const HIDDEN_THREADS_STORAGE_KEY = 'signal-loom-hidden-conversations-v1';
const LOCAL_SESSION_PREFIX = 'signal-loom:local:';

type ThreadDockMode = 'focus' | 'all' | 'hidden';

function createLocalSessionId(): string {
  const timestamp = Date.now().toString(36);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${LOCAL_SESSION_PREFIX}${timestamp}-${suffix}`;
}

function isLocalSessionThread(threadId: string): boolean {
  return threadId.startsWith(LOCAL_SESSION_PREFIX);
}

function titleFromMessage(content: string): string {
  const firstLine = content.split('\n').find((line) => line.trim())?.trim() ?? '';
  if (!firstLine) return 'New Hermes session';
  return firstLine.length > 54 ? `${firstLine.slice(0, 51)}…` : firstLine;
}

function readHiddenThreadIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(HIDDEN_THREADS_STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    window.localStorage.removeItem(HIDDEN_THREADS_STORAGE_KEY);
    return [];
  }
}

function persistHiddenThreadIds(ids: string[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(HIDDEN_THREADS_STORAGE_KEY, JSON.stringify([...new Set(ids)]));
}

function newestVisibleThread(threads: Thread[], hiddenIds: Set<string>): Thread | undefined {
  return [...threads]
    .filter((thread) => !hiddenIds.has(thread.id))
    .sort((a, b) => {
      const aTime = a.lastActive ? new Date(a.lastActive).getTime() : 0;
      const bTime = b.lastActive ? new Date(b.lastActive).getTime() : 0;
      return bTime - aTime;
    })[0];
}

import { mockThreads, mockRuntime, mockAgents } from '@/lib/mock/data';
import { mockDelegationEvents } from '@/lib/mock/delegation-data';
import {
  loadSessions as adapterLoadSessions,
  loadAgents as adapterLoadAgents,
  loadApprovals as adapterLoadApprovals,
  loadRuntimeHealth as adapterLoadRuntimeHealth,
  loadSessionMessages as adapterLoadSessionMessages,
  sendMessage as adapterSendMessage,
  streamMessage,
  type StreamMessageEvent,
  resolveApproval as adapterResolveApproval,
} from '@/lib/openclaw/adapter';

// --- Preset helpers ---

const MIN_FULL_PANE = 280;
const MIN_MONITOR_COLLAPSED = 160;

function derivePresetFromPanes(panes: Pane[]): WorkspacePreset {
  const hasMonitor = panes.some((p) => p.role === 'monitor');
  const nonMonitor = panes.filter((p) => p.role !== 'monitor');
  if (nonMonitor.length === 1 && !hasMonitor) return 'focus';
  if (nonMonitor.length === 2) return hasMonitor ? 'duo_monitor' : 'duo';
  if (nonMonitor.length === 1 && hasMonitor) return 'operator';
  return nonMonitor.length >= 2 ? 'duo' : 'focus';
}

function buildPanesForPreset(
  preset: WorkspacePreset,
  primaryThreadId: string,
  existingSecondaryId?: string | null,
  existingMonitorId?: string | null
): Pane[] {
  switch (preset) {
    case 'focus':
      return [
        { id: 'pane-center', role: 'primary', threadId: primaryThreadId, widthRatio: 1, active: true, collapsed: false },
      ];
    case 'duo':
      return [
        { id: 'pane-left', role: 'primary', threadId: primaryThreadId, widthRatio: 0.5, active: true, collapsed: false },
        { id: 'pane-right', role: 'secondary', threadId: existingSecondaryId ?? primaryThreadId, widthRatio: 0.5, active: false, collapsed: false },
      ];
    case 'duo_monitor': {
      const monitorId = existingMonitorId ?? (existingSecondaryId && existingSecondaryId !== primaryThreadId ? existingSecondaryId : 'thread-7');
      return [
        { id: 'pane-left', role: 'primary', threadId: primaryThreadId, widthRatio: 0.4, active: true, collapsed: false },
        { id: 'pane-right', role: 'secondary', threadId: existingSecondaryId ?? primaryThreadId, widthRatio: 0.4, active: false, collapsed: false },
        { id: 'pane-monitor', role: 'monitor', threadId: monitorId, widthRatio: 0.2, active: false, collapsed: false },
      ];
    }
    case 'operator':
      return [
        { id: 'pane-center', role: 'primary', threadId: primaryThreadId, widthRatio: 0.65, active: true, collapsed: false },
        { id: 'pane-monitor', role: 'monitor', threadId: existingMonitorId ?? 'thread-7', widthRatio: 0.35, active: false, collapsed: false },
      ];
  }
}

function calcWidthRatio(deltaX: number, containerWidth: number, startA: number, startB: number): { ratioA: number; ratioB: number } {
  const totalWidth = containerWidth;
  const deltaRatio = deltaX / totalWidth;
  const newRatioA = startA + deltaRatio;
  const newRatioB = startB - deltaRatio;
  // Clamp — prevent panes going below minimums
  const minFull = MIN_FULL_PANE / totalWidth;
  const minMonitor = MIN_MONITOR_COLLAPSED / totalWidth;
  let ratioA = newRatioA;
  let ratioB = newRatioB;
  if (ratioA < minFull) { ratioA = minFull; ratioB = 1 - minFull; }
  if (ratioB < minFull && ratioB < minMonitor) { ratioB = minFull; ratioA = 1 - minFull; }
  return { ratioA, ratioB };
}

function runtimeEventLabel(event: RuntimeGatewayEvent): string {
  const tool = event.data?.toolName;
  if (event.type === 'assistant.delta') return 'Assistant streaming';
  if (event.type === 'reasoning.delta') return 'Thinking';
  if (event.type === 'tool.started') return `Tool started${tool ? ` · ${tool}` : ''}`;
  if (event.type === 'tool.finished') return `Tool finished${tool ? ` · ${tool}` : ''}`;
  if (event.type === 'subagent.started') return 'Subagent started';
  if (event.type === 'subagent.finished') return 'Subagent finished';
  if (event.type === 'message.started') return 'Message started';
  if (event.type === 'message.finished') return 'Message finished';
  if (event.type === 'runtime.error') return 'Runtime bridge error';
  return event.type.replace(/[._-]/g, ' ');
}

function runtimeStatus(type: string, status?: string): RuntimeActivity['status'] {
  if (type === 'runtime.error' || status === 'error' || status === 'failed') return 'error';
  if (type.endsWith('.finished') || status === 'done' || status === 'complete') return 'done';
  return 'active';
}

function ensureRuntimeThread(state: SignalLoomStore, sessionKey: string, at: string): Thread[] {
  if (state.threads.some((thread) => thread.id === sessionKey)) return state.threads;
  const session = state.sessions.find((item) => item.id === sessionKey);
  return [
    ...state.threads,
    {
      id: sessionKey,
      title: session?.title ?? `Hermes session ${sessionKey.slice(-8)}`,
      status: session?.status === 'done' || session?.status === 'idle' ? 'done' : 'active',
      lastActive: session?.lastMessageAt ?? at,
      unreadCount: 0,
      hasApproval: false,
      linkedAgents: [],
      messages: [],
      session,
    } satisfies Thread,
  ];
}

function upsertRuntimeMessage(messages: Thread['messages'], message: Thread['messages'][number]): Thread['messages'] {
  const existing = messages.find((item) => item.id === message.id);
  if (!existing) return [...messages, message];
  return messages.map((item) =>
    item.id === message.id
      ? { ...item, content: item.content + message.content, timestamp: message.timestamp }
      : item
  );
}

// --- Store interface ---

interface SignalLoomStore {
  threads: Thread[];
  /** Raw OpenClaw sessions — used to build Thread objects for selection */
  sessions: OpenClawSession[];
  selectedThreadId: string;
  hiddenThreadIds: string[];
  threadDockMode: ThreadDockMode;
  agents: Agent[];
  approvals: Approval[];
  runtime: RuntimeState;
  approvalsPanelOpen: boolean;
  hermesCommandCenterOpen: boolean;
  hermesSettingsOpen: boolean;
  composerDraft: string | null;
  // Sprint 2: Legacy split view (kept for migration compatibility)
  splitView: SplitViewState;
  composerState: ComposerState;
  delegationEvents: DelegationEvent[];

  // Sprint 2.5: Pane system
  workspace: WorkspaceState;
  resize: ResizeState;

  // Sprint 2: Message highlighting
  highlightedMessageId: string | null;

  // Sprint 3: Adapter-backed data
  sessionsLoading: boolean;
  sessionsError: string | null;
  healthLoading: boolean;
  sessionsFetchedAt: string | null;

  // Sprint 7: Session transcript/history — keyed by session key
  sessionMessages: Record<string, {
    messages: Thread['messages'];
    truncated?: boolean;
    contentTruncated?: boolean;
    droppedMessages?: boolean;
    fetchedAt: string;
  }>;
  sessionMessagesLoading: Record<string, boolean>;
  liveConnected: boolean;
  runtimeActivities: Record<string, RuntimeActivity>;

  // Sprint 8: Parent-child session relationships
  /** Maps parent session key → array of child session IDs */
  childSessionIds: Record<string, string[]>;
  /** Maps child session key → parent session key */
  childToParentMap: Record<string, string>;
  /** Session keys the operator has chosen to follow (shown with visual indicator in dock) */
  followedSessionIds: string[];
  /** Open a child session in the secondary pane (creates one if needed) */
  openChildSession: (childSessionId: string, delegationEventId?: string) => void;
  /** Sprint 8: ID of the delegation event the user is currently viewing (for visual marking) */
  activeDelegationEventId: string | null;

  // Actions
  selectThread: (id: string, session?: OpenClawSession) => void;
  hideThread: (id: string) => void;
  hideThreads: (ids: string[]) => void;
  unhideThread: (id: string) => void;
  setThreadDockMode: (mode: ThreadDockMode) => void;
  hydrateHiddenThreads: () => void;
  markThreadRead: (id: string) => void;
  toggleApprovalsPanel: () => void;
  toggleHermesCommandCenter: () => void;
  closeHermesCommandCenter: () => void;
  toggleHermesSettings: () => void;
  closeHermesSettings: () => void;
  setComposerDraft: (draft: string) => void;
  clearComposerDraft: () => void;
  startNewSession: () => string;

  // Sprint 3: Data loading via OpenClaw adapter
  loadSessions: () => Promise<void>;
  /** Silent background reload — updates threads/agents without triggering the loading spinner */
  silentReloadSessions: () => Promise<void>;
  loadAgents: () => Promise<void>;
  loadApprovals: () => Promise<void>;
  resolveApproval: (approvalId: string, decision: 'approved' | 'denied' | 'revised', note?: string) => Promise<void>;
  loadRuntimeHealth: () => Promise<void>;
  loadMessagesForThread: (sessionKey: string) => Promise<void>;
  ingestRuntimeEvent: (event: RuntimeGatewayEvent) => void;

  // Sprint 2: Legacy split view actions
  setSplitView: (enabled: boolean, secondaryThreadId?: string) => void;
  setLiveConnected: (connected: boolean) => void;
  setActivePane: (pane: PaneSide) => void;
  closeSplit: () => void;

  // Sprint 2.5: Pane system actions
  closePane: (paneId: string) => void;
  setPreset: (preset: WorkspacePreset) => void;
  addMonitorPane: (threadId: string) => void;
  removeMonitorPane: () => void;
  setActivePaneById: (paneId: string) => void;
  resizePanes: (dragging: boolean, paneAId: string, paneBId: string, startX: number, startWidthA: number, startWidthB: number) => void;
  applyResize: (deltaX: number, containerWidth: number) => void;
  endResize: () => void;
  toggleMonitorCollapsed: () => void;
  assignThreadToPane: (paneId: string, threadId: string) => void;

  // Sprint 2: Composer actions
  sendMessage: (threadId: string, content: string) => Promise<void>;
  sendStreamingMessage: (threadId: string, content: string) => Promise<void>;
  clearComposerError: () => void;

  // Sprint 2: Message highlighting
  highlightMessage: (messageId: string | null) => void;
}

export const useSignalLoomStore = create<SignalLoomStore>((set, get) => ({
  threads: mockThreads,
  sessions: [] as OpenClawSession[],
  selectedThreadId: 'thread-1',
  hiddenThreadIds: [],
  threadDockMode: 'focus',
  agents: mockAgents,
  approvals: [], // loaded from adapter on mount; store shows empty while loading
  runtime: mockRuntime,
  approvalsPanelOpen: false,
  hermesCommandCenterOpen: false,
  hermesSettingsOpen: false,
  composerDraft: null,

  // Sprint 2 legacy (migrated to workspace in 2.5)
  splitView: {
    enabled: false,
    primaryThreadId: 'thread-1',
    secondaryThreadId: null,
    activePane: 'left',
  },
  composerState: {
    isSending: false,
    streamingResponse: null,
    isStreaming: false,
    streamingStatus: 'idle',
    streamingTokenCount: 0,
    streamingCharsPerSecond: 0,
    streamingMessageId: null,
    streamingStartedAt: null,
    streamingLastChunkAt: null,
    error: null,
    lastSentAt: null,
  },
  delegationEvents: mockDelegationEvents,
  highlightedMessageId: null,

  // Sprint 2.5: Initial pane workspace state
  workspace: {
    preset: 'focus',
    panes: [
      { id: 'pane-center', role: 'primary', threadId: 'thread-1', widthRatio: 1, active: true, collapsed: false },
    ],
    activePaneId: 'pane-center',
    monitorCollapsed: false,
  },

  resize: {
    dragging: false,
  },

  // Sprint 3: Adapter-backed data state
  sessionsLoading: false,
  sessionsError: null,
  healthLoading: true,
  sessionsFetchedAt: null,

  // Sprint 7: Session transcript state
  sessionMessages: {},
  sessionMessagesLoading: {},
  liveConnected: false,
  runtimeActivities: {},

  // Sprint 8: Parent-child session relationships
  childSessionIds: {},
  childToParentMap: {},
  followedSessionIds: [],
  activeDelegationEventId: null,

  // ---- Actions ----

  selectThread: (id, session) =>
    set((state) => {
      const ws = state.workspace;

      // If thread is not in threads list, look it up from sessions and create a Thread entry
      const existingThread = state.threads.find((t) => t.id === id);
      const threadList = existingThread
        ? state.threads
        : [
            ...state.threads,
            // Create a Thread from session metadata — will be populated with messages async
            ((): Thread => {
              // Look up session from stored sessions — try by id (session key) first,
              // then by title as a fallback. id match is more reliable since title
              // is derived from displayName and may not equal the thread id.
              const sess = session
                ?? state.sessions.find((s) => s.id === id)
                ?? state.sessions.find((s) => s.title === id);
              return {
                id,
                title: sess?.title ?? id,
                status: sess?.status === 'active'
                  ? 'active'
                  : sess?.status === 'idle' || sess?.status === 'done'
                  ? 'done'
                  : 'active',
                lastActive: sess?.lastMessageAt ?? new Date().toISOString(),
                unreadCount: 0,
                hasApproval: false,
                linkedAgents: [],
                messages: [],
                // Attach the full OpenClawSession for metadata card
                session: sess ?? undefined,
              };
            })(),
          ];

      // Find which pane currently holds this thread
      const paneWithThread = ws.panes.find((p) => p.threadId === id);
      if (paneWithThread) {
        // Thread already has a pane — just activate it
        return {
          selectedThreadId: id,
          highlightedMessageId: null,
          workspace: {
            ...ws,
            activePaneId: paneWithThread.id,
            panes: ws.panes.map((p) => ({ ...p, active: p.id === paneWithThread.id })),
          },
          threads: threadList.map((t) => (t.id === id ? { ...t, unreadCount: 0 } : t)),
        };
      }

      // Thread not yet in any pane — assign to active pane
      return {
        selectedThreadId: id,
        highlightedMessageId: null,
        workspace: {
          ...ws,
          panes: ws.panes.map((p) =>
            p.id === ws.activePaneId ? { ...p, threadId: id } : p
          ),
        },
        threads: threadList.map((t) => (t.id === id ? { ...t, unreadCount: 0 } : t)),
      };
    }),

  hideThread: (id) => get().hideThreads([id]),

  hideThreads: (ids) =>
    set((state) => {
      const nextHiddenIds = [...new Set([...state.hiddenThreadIds, ...ids])];
      persistHiddenThreadIds(nextHiddenIds);
      const hiddenSet = new Set(nextHiddenIds);
      const fallback = newestVisibleThread(state.threads, hiddenSet);
      const selectedWasHidden = ids.includes(state.selectedThreadId);
      const nextSelectedThreadId = selectedWasHidden ? (fallback?.id ?? '') : state.selectedThreadId;
      return {
        hiddenThreadIds: nextHiddenIds,
        threadDockMode: state.threadDockMode === 'hidden' ? 'hidden' : 'focus',
        selectedThreadId: nextSelectedThreadId,
        workspace: selectedWasHidden
          ? {
              ...state.workspace,
              panes: state.workspace.panes.map((pane) =>
                ids.includes(pane.threadId)
                  ? { ...pane, threadId: fallback?.id ?? '' }
                  : pane
              ),
            }
          : state.workspace,
      };
    }),

  unhideThread: (id) =>
    set((state) => {
      const nextHiddenIds = state.hiddenThreadIds.filter((hiddenId) => hiddenId !== id);
      persistHiddenThreadIds(nextHiddenIds);
      return { hiddenThreadIds: nextHiddenIds };
    }),

  setThreadDockMode: (mode) => set({ threadDockMode: mode }),

  hydrateHiddenThreads: () => {
    const hiddenThreadIds = readHiddenThreadIds();
    set({ hiddenThreadIds });
  },

  markThreadRead: (id) =>
    set((state) => ({
      threads: state.threads.map((t) =>
        t.id === id ? { ...t, unreadCount: 0 } : t
      ),
    })),

  toggleApprovalsPanel: () =>
    set((state) => ({
      approvalsPanelOpen: !state.approvalsPanelOpen,
    })),

  toggleHermesCommandCenter: () =>
    set((state) => ({
      hermesCommandCenterOpen: !state.hermesCommandCenterOpen,
      hermesSettingsOpen: false,
    })),

  closeHermesCommandCenter: () =>
    set({ hermesCommandCenterOpen: false }),

  toggleHermesSettings: () =>
    set((state) => ({
      hermesSettingsOpen: !state.hermesSettingsOpen,
      hermesCommandCenterOpen: false,
    })),

  closeHermesSettings: () =>
    set({ hermesSettingsOpen: false }),

  setComposerDraft: (draft) =>
    set({ composerDraft: draft }),

  clearComposerDraft: () =>
    set({ composerDraft: null }),

  startNewSession: () => {
    const now = new Date().toISOString();
    const threadId = createLocalSessionId();
    const newThread: Thread = {
      id: threadId,
      title: 'New Hermes session',
      status: 'active',
      lastActive: now,
      unreadCount: 0,
      hasApproval: false,
      linkedAgents: [],
      messages: [],
      pinned: true,
    };

    set((state) => ({
      threads: [newThread, ...state.threads.filter((thread) => thread.id !== threadId)],
      selectedThreadId: threadId,
      threadDockMode: 'focus',
      composerDraft: null,
      highlightedMessageId: null,
      workspace: {
        ...state.workspace,
        activePaneId: state.workspace.activePaneId || state.workspace.panes[0]?.id || 'pane-center',
        panes: state.workspace.panes.map((pane, index) =>
          pane.id === state.workspace.activePaneId || (!state.workspace.activePaneId && index === 0)
            ? { ...pane, threadId, active: true }
            : { ...pane, active: false }
        ),
      },
    }));

    return threadId;
  },

  // ---- Sprint 3: OpenClaw adapter data loading ----

  loadSessions: async () => {
    set({ sessionsLoading: true, sessionsError: null });
    const result = await adapterLoadSessions();
    if (!result.ok) {
      // Strip HTML from error messages (gateway sometimes returns HTML error pages)
      const rawError = result.error ?? '';
      const cleanError = rawError.replace(/<[^>]*>/g, '').replace(/\n/g, ' ').trim();
      set({ sessionsLoading: false, sessionsError: cleanError || 'Sessions unavailable' });
      return;
    }
    // Map OpenClawSession[] → Thread[], filtering subagent sessions
    const adaptedThreads: Thread[] = result.data
      .filter((s) => {
        // Exclude pure subagent sessions — background workers, not delegation contexts
        if (s.agentName === 'Subagent') return false;
        return true;
      })
      .map((s) => {
        // Derive status from actual session state + recency
        let status: Thread['status'] = 'active';
        if (s.status === 'done' || s.status === 'idle') {
          status = 'done';
        } else if (s.status === 'active' && s.lastMessageAt) {
          const ageMin = (Date.now() - new Date(s.lastMessageAt).getTime()) / 60_000;
          if (ageMin > 30) status = 'done';
        }
        return {
          id: s.id,
          title: s.title,
          messages: [] as Thread["messages"],
          linkedAgents: [],
          delegationEvents: [],
          linkedThreads: [],
          tags: s.tags,
          status,
          unreadCount: 0,
          hasApproval: false,
          lastActive: s.lastMessageAt ?? new Date().toISOString(),
          createdAt: new Date().toISOString(),
          session: s,
        } as Thread;
      });

    // ---- Derive agent statuses from real session data ----
    const sessions = result.data;
    const now = Date.now();
    const FIVE_MINS = 5 * 60 * 1000;

    // Known agent session key prefixes
    const SESSION_AGENT_MAP: Array<{ prefix: string; agentId: Agent['id'] }> = [
      { prefix: 'agent:forge:subagent:', agentId: 'hephaestus' },
      { prefix: 'agent:sentinel:subagent:', agentId: 'argus' },
      { prefix: 'agent:studio:subagent:', agentId: 'ariadne' },
      { prefix: 'agent:scout:subagent:', agentId: 'orion' },
      { prefix: 'agent:mercury:subagent:', agentId: 'hermes' },
    ];

    // Derive agent statuses from session data
    // Track: agentId → { status, taskPreview, lastActiveMs }
    type AgentDerivation = { status: Agent['status']; taskPreview: string; lastActiveMs: number };
    const derivedAgentsMap = new Map<Agent['id'], AgentDerivation>();

    for (const session of sessions) {
      // Find which agent this session belongs to
      const mapping = SESSION_AGENT_MAP.find(({ prefix }) =>
        session.id.startsWith(prefix)
      );
      if (!mapping) continue;

      const agentId = mapping.agentId as Agent['id'];
      const lastActiveMs = session.lastMessageAt
        ? new Date(session.lastMessageAt).getTime()
        : 0;
      const ageMs = now - lastActiveMs;
      const isRecent = ageMs < FIVE_MINS;

      // Skip if we already have a more recent session for this agent
      const existing = derivedAgentsMap.get(agentId);
      if (existing && existing.lastActiveMs > 0) {
        if (existing.lastActiveMs > lastActiveMs) continue;
      }

      // Determine status honestly
      let status: Agent['status'] = 'idle';
      if (session.status === 'active' && isRecent) {
        status = 'active';
      } else if (session.status === 'done' && isRecent) {
        status = 'done';
      } else if (session.status === 'idle') {
        status = 'idle';
      } else {
        status = 'idle';
      }

      // Build task preview from session metadata
      const childTag = session.tags.find((t: string) => t.startsWith('delegated:'));
      const childCount = childTag ? parseInt(childTag.split(':')[1]) : 0;
      const taskPreview = childCount > 0
        ? `Delegated ${childCount} subagent${childCount > 1 ? 's' : ''}`
        : session.preview
          ? session.preview.slice(0, 60)
          : session.title;

      derivedAgentsMap.set(agentId, {
        status,
        taskPreview,
        lastActiveMs,
      });
    }

    // Merge derived statuses into mockAgents baseline (preserve mock fields we can't derive)
    const MOCK_AGENT_FIELDS: Record<Agent['id'], { name: string; role: string; browserEnabled: boolean; accentColor: string }> = {
      hephaestus: { name: 'Hephaestus', role: 'execution', browserEnabled: false, accentColor: '#D44D2C' },
      argus:      { name: 'Argus',      role: 'review',    browserEnabled: false, accentColor: '#44BB44' },
      ariadne:   { name: 'Ariadne',    role: 'design',    browserEnabled: false, accentColor: '#CC44CC' },
      orion:     { name: 'Orion',      role: 'research',  browserEnabled: false, accentColor: '#4A9EFF' },
      hermes:    { name: 'Hermes',     role: 'runtime guidance', browserEnabled: false, accentColor: '#E8A83C' },
    };

    const derivedAgents: Agent[] = (['hephaestus', 'argus', 'ariadne', 'orion', 'hermes'] as Agent['id'][])
      .map((id) => {
        const derived = derivedAgentsMap.get(id);
        const defaults = MOCK_AGENT_FIELDS[id];
        return {
          id,
          name: defaults.name,
          role: defaults.role,
          status: derived?.status ?? 'idle',
          taskPreview: derived?.taskPreview ?? 'Idle',
          browserEnabled: defaults.browserEnabled,
          accentColor: defaults.accentColor,
        } satisfies Agent;
      });

    // ---- Derive childSessionIds map from Hermes' direct parent_session_id ----
    const childSessionIds: Record<string, string[]> = {};
    for (const session of sessions) {
      if (session.parentSessionId) {
        childSessionIds[session.parentSessionId] = [
          ...(childSessionIds[session.parentSessionId] ?? []),
          session.id,
        ];
      }
      if (session.childSessionIds?.length) {
        childSessionIds[session.id] = Array.from(new Set([
          ...(childSessionIds[session.id] ?? []),
          ...session.childSessionIds,
        ]));
      }
    }

    // ---- Derive delegation events from sessions (honest — no invented data) ----
    const THREE_HRS = 3 * 60 * 60 * 1000;
    const derivedEvents: DelegationEvent[] = [];

    for (const session of sessions.slice(0, 60)) {
      if (!session.lastMessageAt) continue;
      const ageMs = now - new Date(session.lastMessageAt).getTime();
      if (ageMs > THREE_HRS) continue;

      const children = childSessionIds[session.id] ?? [];
      if (children.length > 0) {
        derivedEvents.push({
          id: `evt-delegated-${session.shortId}`,
          threadId: session.id,
          type: 'delegated',
          actor: session.agentId,
          title: `${session.agentName} delegated ${children.length} helper session${children.length > 1 ? 's' : ''}`,
          createdAt: session.lastMessageAt,
          childSessionIds: children,
        });
      }

      if (session.parentSessionId) {
        derivedEvents.push({
          id: `evt-child-${session.shortId}`,
          threadId: session.parentSessionId,
          type: session.status === 'active' && ageMs < FIVE_MINS ? 'agent_active' : 'agent_returned',
          actor: session.agentId,
          title: `${session.status === 'active' && ageMs < FIVE_MINS ? 'Helper active' : 'Helper updated'} · ${session.title}`,
          detail: `${session.messageCount} message${session.messageCount !== 1 ? 's' : ''}${session.toolCallCount ? ` · ${session.toolCallCount} tool${session.toolCallCount !== 1 ? 's' : ''}` : ''}`,
          createdAt: session.lastMessageAt,
          childSessionIds: [session.id],
        });
      }

      if (session.status === 'active' && ageMs < FIVE_MINS && !session.parentSessionId) {
        derivedEvents.push({
          id: `evt-active-${session.shortId}`,
          threadId: session.id,
          type: 'agent_active',
          actor: session.agentId,
          title: `Live ${session.agentName} session active`,
          createdAt: session.lastMessageAt,
        });
      }
    }

    // Sort events newest first
    derivedEvents.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Select first real session when sessions are loaded.
    // Priority: adaptedThreads[0] (filtered) > result.data[0] > keep current.
    const hiddenThreadIds = get().hiddenThreadIds;
    const firstRealSession = adaptedThreads.find((thread) => !hiddenThreadIds.includes(thread.id)) ?? null;

    // ---- Update store ----
    set((state) => ({
      threads: (() => {
        const newSessions = result.data;
        const localThreads = state.threads.filter((thread) =>
          isLocalSessionThread(thread.id) && !adaptedThreads.some((adaptedThread) => adaptedThread.id === thread.id)
        );
        if (adaptedThreads.length > 0) {
          // Backfill session metadata + Sprint 8 linkedChildren into adapted threads.
          const sessionThreads = adaptedThreads.map((t) => {
            const sess = newSessions.find((s) => s.title === t.title);
            return {
              ...t,
              session: sess,
              // Sprint 8: surface child sessions on the parent thread for dock/header affordances
              linkedChildren: childSessionIds[t.id] ?? [],
            } as Thread;
          });
          return [...localThreads, ...sessionThreads];
        }
        // adaptedThreads is empty (likely all sessions filtered as subagent).
        // Add the first real session as a thread so the workspace can display it.
        if (newSessions.length > 0) {
          const first = newSessions[0];
          return [...localThreads, {
            id: first.id,
            title: first.title,
            status: (first.status === 'done' || first.status === 'idle' ? 'done' : 'active') as Thread['status'],
            messages: [] as Thread['messages'],
            lastActive: first.lastMessageAt ?? null,
            session: first,
            linkedChildren: childSessionIds[first.id] ?? [],
          }] as Thread[];
        }
        return localThreads.length > 0 ? localThreads : state.threads;
      })(),
      sessions: result.data,  // store raw sessions for thread creation on select
      sessionsLoading: false,
      sessionsFetchedAt: result.fetchedAt,
      sessionsError: null,
      // Derive honest agent statuses from real sessions
      agents: derivedAgents,
      // Populate delegation timeline from real session data
      delegationEvents: derivedEvents.length > 0 ? derivedEvents : state.delegationEvents,
      // Sprint 8: parent-child session relationships
      childSessionIds,
      // Sprint 8: child→parent reverse map (derived from childSessionIds for "↙ Working for" UI)
      childToParentMap: Object.fromEntries(
        Object.entries(childSessionIds).flatMap(([parentId, childIds]) =>
          childIds.map((childId) => [childId, parentId])
        )
      ),
      selectedThreadId: isLocalSessionThread(state.selectedThreadId) ? state.selectedThreadId : firstRealSession?.id ?? state.selectedThreadId,
      workspace: firstRealSession && !isLocalSessionThread(state.selectedThreadId)
        ? {
            ...state.workspace,
            panes: state.workspace.panes.map((p) =>
              p.role === 'primary'
                ? { ...p, threadId: firstRealSession.id }
                : p
            ),
          }
        : state.workspace,
      // Sprint 8: preserve active delegation event selection across session reloads
      activeDelegationEventId: state.activeDelegationEventId,
      followedSessionIds: state.followedSessionIds,
    }));
  },

  // Sprint 10.6: silent background reload — same logic as loadSessions but does NOT
  // set sessionsLoading, so the thread list stays visible and stable during live updates.
  silentReloadSessions: async () => {
    const result = await adapterLoadSessions();
    if (!result.ok) return;
    const adaptedThreads: Thread[] = result.data
      .filter((s) => {
        if (s.agentName === 'Subagent') return false;
        return true;
      })
      .map((s) => {
        let status: Thread['status'] = 'active';
        if (s.status === 'done' || s.status === 'idle') {
          status = 'done';
        } else if (s.status === 'active' && s.lastMessageAt) {
          const ageMin = (Date.now() - new Date(s.lastMessageAt).getTime()) / 60_000;
          if (ageMin > 30) status = 'done';
        }
        return {
          id: s.id,
          title: s.title,
          messages: [] as Thread["messages"],
          linkedAgents: [],
          delegationEvents: [],
          linkedThreads: [],
          tags: s.tags,
          status,
          unreadCount: 0,
          hasApproval: false,
          lastActive: s.lastMessageAt ?? new Date().toISOString(),
          createdAt: new Date().toISOString(),
          session: s,
        } as Thread;
      });
    const sessions = result.data;
    const now = Date.now();
    const FIVE_MINS = 5 * 60 * 1000;
    const SESSION_AGENT_MAP: Array<{ prefix: string; agentId: Agent['id'] }> = [
      { prefix: 'agent:forge:subagent:', agentId: 'hephaestus' },
      { prefix: 'agent:sentinel:subagent:', agentId: 'argus' },
      { prefix: 'agent:studio:subagent:', agentId: 'ariadne' },
      { prefix: 'agent:scout:subagent:', agentId: 'orion' },
      { prefix: 'agent:mercury:subagent:', agentId: 'hermes' },
    ];
    type AgentDerivation = { status: Agent['status']; taskPreview: string; lastActiveMs: number };
    const derivedAgentsMap = new Map<Agent['id'], AgentDerivation>();
    for (const session of sessions) {
      const mapping = SESSION_AGENT_MAP.find(({ prefix }) => session.id.startsWith(prefix));
      if (!mapping) continue;
      const agentId = mapping.agentId as Agent['id'];
      const lastActiveMs = session.lastMessageAt ? new Date(session.lastMessageAt).getTime() : 0;
      const ageMs = now - lastActiveMs;
      const isRecent = ageMs < FIVE_MINS;
      const existing = derivedAgentsMap.get(agentId);
      if (existing && existing.lastActiveMs > lastActiveMs) continue;
      let status: Agent['status'] = 'idle';
      if (session.status === 'active' && isRecent) status = 'active';
      else if (session.status === 'done' && isRecent) status = 'done';
      else if (session.status === 'idle') status = 'idle';
      const childTag = session.tags.find((t: string) => t.startsWith('delegated:'));
      const childCount = childTag ? parseInt(childTag.split(':')[1]) : 0;
      const taskPreview = childCount > 0
        ? `Delegated ${childCount} subagent${childCount > 1 ? 's' : ''}`
        : session.preview ? session.preview.slice(0, 60) : session.title;
      derivedAgentsMap.set(agentId, { status, taskPreview, lastActiveMs });
    }
    const MOCK_AGENT_FIELDS: Record<Agent['id'], { name: string; role: string; browserEnabled: boolean; accentColor: string }> = {
      hephaestus: { name: 'Hephaestus', role: 'execution', browserEnabled: false, accentColor: '#D44D2C' },
      argus:      { name: 'Argus',      role: 'review',    browserEnabled: false, accentColor: '#44BB44' },
      ariadne:   { name: 'Ariadne',   role: 'design',    browserEnabled: false, accentColor: '#CC44CC' },
      orion:     { name: 'Orion',     role: 'research',  browserEnabled: false, accentColor: '#4A9EFF' },
      hermes:    { name: 'Hermes',    role: 'runtime guidance', browserEnabled: false, accentColor: '#E8A83C' },
    };
    const derivedAgents: Agent[] = (['hephaestus', 'argus', 'ariadne', 'orion', 'hermes'] as Agent['id'][])
      .map((id) => {
        const derived = derivedAgentsMap.get(id);
        const defaults = MOCK_AGENT_FIELDS[id];
        return {
          id,
          name: defaults.name,
          role: defaults.role,
          status: derived?.status ?? 'idle',
          taskPreview: derived?.taskPreview ?? 'Idle',
          browserEnabled: defaults.browserEnabled,
          accentColor: defaults.accentColor,
        } satisfies Agent;
      });
    const childSessionIds: Record<string, string[]> = {};
    for (const session of sessions) {
      if (session.parentSessionId) {
        childSessionIds[session.parentSessionId] = [
          ...(childSessionIds[session.parentSessionId] ?? []),
          session.id,
        ];
      }
      if (session.childSessionIds?.length) {
        childSessionIds[session.id] = Array.from(new Set([
          ...(childSessionIds[session.id] ?? []),
          ...session.childSessionIds,
        ]));
      }
    }
    const hiddenThreadIds = get().hiddenThreadIds;
    const firstRealSession = adaptedThreads.find((thread) => !hiddenThreadIds.includes(thread.id)) ?? null;
    set((state) => {
      // Sprint 10.6: Preserve locally-derived thread state across session refreshes.
      // Only session-derived fields (title, status, lastActive, session, tags) come from
      // the backend. Local UI state (messages, delegationEvents, pinned, etc.) must not
      // be wiped when silentReloadSessions refreshes thread metadata in the background.
      const refreshedThreads = adaptedThreads.map((t) => {
        const sess = result.data.find((s) => s.title === t.title);
        const existing = state.threads.find((et) => et.id === t.id);
        return {
          ...t,
          session: sess ?? t.session,
          // Preserve locally-derived state that should survive a session refresh
          messages: existing?.messages ?? t.messages,
          linkedChildren: existing?.linkedChildren ?? childSessionIds[t.id] ?? [],
          unreadCount: existing?.unreadCount ?? t.unreadCount,
          hasApproval: existing?.hasApproval ?? t.hasApproval,
          pinned: existing?.pinned ?? t.pinned,
          followed: existing?.followed ?? t.followed,
        } satisfies Thread;
      });
      const localThreads = state.threads.filter((thread) =>
        isLocalSessionThread(thread.id) && !refreshedThreads.some((refreshedThread) => refreshedThread.id === thread.id)
      );
      const nextSelectedThreadId = isLocalSessionThread(state.selectedThreadId)
        ? state.selectedThreadId
        : firstRealSession?.id ?? state.selectedThreadId;

      return {
        threads: [...localThreads, ...refreshedThreads],
        sessions: result.data,
        sessionsFetchedAt: result.fetchedAt,
        agents: derivedAgents,
        delegationEvents: state.delegationEvents,
        childSessionIds,
        childToParentMap: Object.fromEntries(
          Object.entries(childSessionIds).flatMap(([parentId, childIds]) => childIds.map((childId) => [childId, parentId]))
        ),
        selectedThreadId: nextSelectedThreadId,
      };
    });
  },

  loadAgents: async () => {
    const result = await adapterLoadAgents();
    if (!result.ok) return; // agents are non-critical, just keep mock
    set({ agents: result.data as unknown as Agent[] });
  },

  loadApprovals: async () => {
    const result = await adapterLoadApprovals();
    if (!result.ok) return;
    set({ approvals: result.data });
  },

  resolveApproval: async (approvalId: string, decision: 'approved' | 'denied' | 'revised', note?: string) => {
    const { approvals } = get();
    const approval = approvals.find((a) => a.id === approvalId);
    if (!approval) return;

    // Optimistic update — immediately show the decision
    set((state) => ({
      approvals: state.approvals.map((a) =>
        a.id === approvalId
          ? { ...a, status: decision as Approval['status'], decisionNote: note, decidedAt: new Date().toISOString() }
          : a
      ),
    }));

    // Persist via adapter
    const result = await adapterResolveApproval({ approvalId, decision, note });

    // If gateway was unreachable, add a note so the UI is honest
    if (result.ok && !result.data?.synced) {
      set((state) => ({
        approvals: state.approvals.map((a) =>
          a.id === approvalId
            ? { ...a, decisionNote: `${a.decisionNote ?? ''} [Gateway unreachable — decision recorded locally]` }
            : a
        ),
      }));
    }
  },

  loadRuntimeHealth: async () => {
    set({ healthLoading: true });
    const result = await adapterLoadRuntimeHealth();
    set({ healthLoading: false });
    if (!result.ok) {
      set((state) => ({
        runtime: {
          ...state.runtime,
          gateway: 'down' as const,
          issueCount: 1,
          issueDescription: result.error,
        },
      }));
      return;
    }
    const { gateway, queue, heartbeat, canvas, browser } = result.data;
    const issueDescription = gateway.reachable
      ? (!queue.healthy
          ? 'Hermes queue is backed up'
          : !heartbeat.fresh
            ? 'Hermes runtime heartbeat is stale'
            : undefined)
      : gateway.error ?? 'Hermes runtime unavailable';
    set((state) => ({
      runtime: {
        ...state.runtime,
        gateway: gateway.reachable ? 'healthy' as const : 'down' as const,
        queue: queue.healthy ? 'healthy' as const : 'backed_up' as const,
        heartbeatFreshness: heartbeat.fresh ? 'fresh' as const : 'stale' as const,
        browserLanes: browser.lanesActive,
        canvasEnabled: canvas.enabled,
        issueCount: issueDescription ? 1 : 0,
        issueDescription,
      },
    }));
  },

  loadMessagesForThread: async (sessionKey: string) => {
    // Sprint 7: Load real transcript via sessions_history tool
    // Use adapterLoadSessionMessages from adapter — already resolves to the real implementation
    set((state) => ({
      sessionMessagesLoading: { ...state.sessionMessagesLoading, [sessionKey]: true },
    }));
    const result = await adapterLoadSessionMessages(sessionKey);
    if (!result.ok) {
      set((state) => ({
        sessionMessagesLoading: { ...state.sessionMessagesLoading, [sessionKey]: false },
      }));
      return;
    }
    const adaptedMessages = result.data.messages.map((m) => ({
      id: m.id,
      role: (m.role === 'action-summary' ? 'action-summary' : m.role) as Thread['messages'][0]['role'],
      content: m.content,
      timestamp: m.timestamp,
    }));
    set((state) => ({
      // Store transcript separately for honest partial/available tracking
      sessionMessages: {
        ...state.sessionMessages,
        [sessionKey]: {
          messages: adaptedMessages as Thread['messages'],
          truncated: result.data.truncated,
          contentTruncated: result.data.contentTruncated,
          droppedMessages: result.data.droppedMessages,
          fetchedAt: result.fetchedAt,
        },
      },
      // Also populate thread messages so MessageList renders them
      threads: state.threads.map((t) =>
        t.id === sessionKey
          ? { ...t, messages: adaptedMessages as Thread['messages'] }
          : t
      ),
      sessionMessagesLoading: { ...state.sessionMessagesLoading, [sessionKey]: false },
    }));
  },

  // Sprint 2 legacy — migrate to workspace
  setSplitView: (enabled, secondaryThreadId) =>
    set((state) => {
      const panes = buildPanesForPreset(
        enabled ? 'duo' : 'focus',
        state.selectedThreadId,
        secondaryThreadId ?? null
      );
      return {
        splitView: {
          enabled,
          primaryThreadId: state.selectedThreadId,
          secondaryThreadId: secondaryThreadId ?? null,
          activePane: 'left',
        },
        workspace: {
          preset: enabled ? 'duo' : 'focus',
          panes,
          activePaneId: enabled ? 'pane-left' : panes[0].id,
          monitorCollapsed: false,
        },
        highlightedMessageId: null,
      };
    }),

  setLiveConnected: (connected) =>
    set(() => ({ liveConnected: connected })),

  ingestRuntimeEvent: (event) =>
    set((state) => {
      const data = event.data ?? {};
      const sessionKey = data.sessionKey ?? data.childSessionId;
      if (!sessionKey) return state;

      const at = data.at ?? new Date().toISOString();
      const preview = data.text ?? data.resultPreview ?? data.argsPreview ?? data.taskPreview;
      const status = runtimeStatus(event.type, data.status);
      const label = runtimeEventLabel(event);
      const previousActivity = state.runtimeActivities[sessionKey];
      const activity: RuntimeActivity = {
        type: event.type,
        label,
        sessionKey,
        parentSessionId: data.parentSessionId,
        toolName: data.toolName,
        status,
        preview,
        startedAt: previousActivity?.startedAt ?? at,
        updatedAt: at,
      };

      let nextThreads = ensureRuntimeThread(state, sessionKey, at);
      let nextSessionMessages = state.sessionMessages;
      const maybeChildSessionId = data.childSessionId ?? sessionKey;
      const shouldUpdateTranscript = event.type === 'assistant.delta'
        || event.type === 'reasoning.delta'
        || event.type === 'tool.started'
        || event.type === 'tool.finished';

      if (shouldUpdateTranscript && preview) {
        const messageRole: Thread['messages'][number]['role'] = event.type.startsWith('tool.') ? 'tool' : event.type === 'reasoning.delta' ? 'system' : 'assistant';
        const messageId = event.type.startsWith('tool.')
          ? `runtime-${sessionKey}-${data.toolCallId ?? data.toolName ?? 'tool'}`
          : `runtime-${sessionKey}-${data.messageId ?? event.type}`;
        const content = event.type === 'reasoning.delta'
          ? `[Reasoning]\n${preview}`
          : event.type === 'tool.started'
            ? `[Tool:${data.toolName ?? 'tool'}]\n${preview || 'Tool call started.'}`
            : event.type === 'tool.finished'
              ? `\n[Result] ${preview || data.status || 'Tool call finished.'}`
              : preview;
        const runtimeMessage: Thread['messages'][number] = {
          id: messageId,
          role: messageRole,
          content,
          timestamp: at,
        };

        nextThreads = nextThreads.map((thread) =>
          thread.id === sessionKey
            ? {
                ...thread,
                status: status === 'done' ? 'done' : 'active',
                lastActive: at,
                messages: upsertRuntimeMessage(thread.messages, runtimeMessage),
              }
            : thread
        );

        const threadMessages = nextThreads.find((thread) => thread.id === sessionKey)?.messages ?? [];
        const transcriptBase = state.sessionMessages[sessionKey]?.messages ?? threadMessages;
        nextSessionMessages = {
          ...state.sessionMessages,
          [sessionKey]: {
            ...(state.sessionMessages[sessionKey] ?? {}),
            messages: upsertRuntimeMessage(transcriptBase, runtimeMessage),
            fetchedAt: at,
          },
        };
      } else {
        nextThreads = nextThreads.map((thread) =>
          thread.id === sessionKey
            ? { ...thread, status: status === 'done' ? 'done' : 'active', lastActive: at }
            : thread
        );
      }

      const nextChildSessionIds = { ...state.childSessionIds };
      const nextChildToParentMap = { ...state.childToParentMap };
      if (data.parentSessionId && maybeChildSessionId) {
        nextChildSessionIds[data.parentSessionId] = Array.from(new Set([
          ...(nextChildSessionIds[data.parentSessionId] ?? []),
          maybeChildSessionId,
        ]));
        nextChildToParentMap[maybeChildSessionId] = data.parentSessionId;
      }

      return {
        threads: nextThreads,
        sessionMessages: nextSessionMessages,
        runtimeActivities: {
          ...state.runtimeActivities,
          [sessionKey]: activity,
        },
        childSessionIds: nextChildSessionIds,
        childToParentMap: nextChildToParentMap,
      };
    }),

  setActivePane: (pane) =>
    set((state) => {
      const ws = state.workspace;
      const paneId = pane === 'left' ? 'pane-left' : 'pane-right';
      const threadId = pane === 'left' ? state.splitView.primaryThreadId : state.splitView.secondaryThreadId ?? state.splitView.primaryThreadId;
      return {
        splitView: { ...state.splitView, activePane: pane },
        workspace: {
          ...ws,
          activePaneId: paneId,
          panes: ws.panes.map((p) => ({ ...p, active: p.id === paneId })),
        },
        selectedThreadId: threadId,
        highlightedMessageId: null,
      };
    }),

  closeSplit: () =>
    set((state) => {
      const panes = buildPanesForPreset('focus', state.splitView.primaryThreadId);
      return {
        splitView: {
          ...state.splitView,
          enabled: false,
          secondaryThreadId: null,
          activePane: 'left',
        },
        workspace: {
          preset: 'focus',
          panes,
          activePaneId: 'pane-center',
          monitorCollapsed: false,
        },
        highlightedMessageId: null,
      };
    }),

  // Sprint 2.5: Close a specific pane — rules per SPRINT2_5a_NERO_RULES.md
  closePane: (paneId) =>
    set((state) => {
      const panes = state.workspace.panes;
      const pane = panes.find((p) => p.id === paneId);
      if (!pane) return state;

      // Rule 1 — primary pane: never close
      if (pane.role === 'primary') return state;

      // Rule 4 — last non-monitor pane: never close
      const nonMonitor = panes.filter((p) => p.role !== 'monitor');
      if (pane.role !== 'monitor' && nonMonitor.length <= 1) return state;

      const remaining = panes.filter((p) => p.id !== paneId);

      // Determine fallback active pane — primary > secondary > monitor > first remaining
      const fallbackId = (() => {
        return (
          remaining.find((p) => p.role === 'primary')?.id ??
          remaining.find((p) => p.role === 'secondary')?.id ??
          remaining.find((p) => p.role === 'monitor')?.id ??
          remaining[0].id
        );
      })();

      const newActivePaneId =
        state.workspace.activePaneId === paneId ? fallbackId : state.workspace.activePaneId;

      return {
        workspace: {
          ...state.workspace,
          preset: derivePresetFromPanes(remaining),
          panes: remaining,
          activePaneId: newActivePaneId,
        },
      };
    }),

  setPreset: (preset) =>
    set((state) => {
      const primaryThreadId = state.workspace.panes.find((p) => p.role === 'primary')?.threadId
        ?? state.selectedThreadId;
      const secondaryPane = state.workspace.panes.find((p) => p.role === 'secondary');
      const monitorPane = state.workspace.panes.find((p) => p.role === 'monitor');
      const panes = buildPanesForPreset(
        preset,
        primaryThreadId,
        secondaryPane?.threadId,
        monitorPane?.threadId
      );
      return {
        workspace: {
          preset,
          panes,
          activePaneId: panes.find((p) => p.role === 'primary')?.id ?? panes[0].id,
          monitorCollapsed: false,
        },
      };
    }),

  addMonitorPane: (threadId) =>
    set((state) => {
      if (state.workspace.panes.some((p) => p.role === 'monitor')) return state;
      const monitorPane: Pane = {
        id: 'pane-monitor',
        role: 'monitor',
        threadId,
        widthRatio: 0.2,
        active: false,
        collapsed: false,
      };
      const nonMonitor = state.workspace.panes.map((p) => ({ ...p, active: false }));
      return {
        workspace: {
          ...state.workspace,
          preset: state.workspace.panes.length === 1 ? 'operator' : 'duo_monitor',
          panes: [...nonMonitor, monitorPane],
        },
      };
    }),

  removeMonitorPane: () =>
    set((state) => {
      const panes = state.workspace.panes.filter((p) => p.role !== 'monitor');
      const preset = panes.length === 1 ? 'focus' : 'duo';
      return {
        workspace: {
          ...state.workspace,
          preset,
          panes: panes.map((p) => ({ ...p, active: p.role === 'primary' })),
          monitorCollapsed: false,
        },
      };
    }),

  setActivePaneById: (paneId) =>
    set((state) => {
      const pane = state.workspace.panes.find((p) => p.id === paneId);
      if (!pane) return state;
      return {
        workspace: {
          ...state.workspace,
          activePaneId: paneId,
          panes: state.workspace.panes.map((p) => ({ ...p, active: p.id === paneId })),
        },
        selectedThreadId: pane.threadId,
        highlightedMessageId: null,
      };
    }),

  resizePanes: (dragging, paneAId, paneBId, startX, startWidthA, startWidthB) =>
    set({ resize: { dragging, paneAId, paneBId, startX, startWidthA, startWidthB } }),

  applyResize: (deltaX, containerWidth) =>
    set((state) => {
      const { resize } = state;
      if (!resize.dragging || !resize.paneAId || !resize.paneBId) return state;
      const { ratioA, ratioB } = calcWidthRatio(
        deltaX,
        containerWidth,
        resize.startWidthA ?? 0.5,
        resize.startWidthB ?? 0.5
      );
      return {
        workspace: {
          ...state.workspace,
          panes: state.workspace.panes.map((p) => {
            if (p.id === resize.paneAId) return { ...p, widthRatio: ratioA };
            if (p.id === resize.paneBId) return { ...p, widthRatio: ratioB };
            return p;
          }),
        },
      };
    }),

  endResize: () =>
    set({ resize: { dragging: false } }),

  toggleMonitorCollapsed: () =>
    set((state) => ({
      workspace: {
        ...state.workspace,
        monitorCollapsed: !state.workspace.monitorCollapsed,
        panes: state.workspace.panes.map((p) =>
          p.role === 'monitor' ? { ...p, collapsed: !state.workspace.monitorCollapsed } : p
        ),
      },
    })),

  assignThreadToPane: (paneId, threadId) =>
    set((state) => ({
      workspace: {
        ...state.workspace,
        panes: state.workspace.panes.map((p) =>
          p.id === paneId ? { ...p, threadId } : p
        ),
      },
    })),

  // Sprint 2: Composer
  sendMessage: async (threadId, content) => {
    set((state) => ({
      composerState: {
        ...state.composerState,
        isSending: true,
        isStreaming: false,
        streamingStatus: 'connecting',
        streamingResponse: null,
        streamingTokenCount: 0,
        streamingCharsPerSecond: 0,
        streamingMessageId: null,
        streamingStartedAt: new Date().toISOString(),
        streamingLastChunkAt: null,
        error: null,
      },
    }));

    // Optimistically add the user message to the thread
    const userMessage = {
      id: `msg-${threadId}-${Date.now()}`,
      role: 'user' as const,
      content,
      timestamp: new Date().toISOString(),
    };

    set((state) => ({
      threads: state.threads.map((t) =>
        t.id === threadId
          ? {
              ...t,
              title: isLocalSessionThread(t.id) && t.messages.length === 0 ? titleFromMessage(content) : t.title,
              messages: [...t.messages, userMessage],
              lastActive: new Date().toISOString(),
            }
          : t
      ),
    }));

    // Call the real adapter (or mock in dev)
    const result = await adapterSendMessage({
      sessionKey: threadId,
      content,
    });

    if (!result.ok) {
      set((state) => ({
        composerState: {
          ...state.composerState,
          isSending: false,
          isStreaming: false,
          streamingStatus: 'error',
          streamingResponse: null,
          streamingMessageId: null,
          streamingLastChunkAt: new Date().toISOString(),
          error: result.error,
        },
      }));
      setTimeout(() => { get().clearComposerError(); }, 4000);
      return;
    }

    const assistantMessage = {
      id: result.data.id,
      role: 'assistant' as const,
      content: result.data.content ?? '',
      timestamp: result.data.timestamp,
    };

    set((state) => ({
      threads: state.threads.map((t) =>
        t.id === threadId
          ? { ...t, messages: [...t.messages, assistantMessage] as Thread['messages'], lastActive: new Date().toISOString() }
          : t
      ),
      composerState: {
        ...state.composerState,
        isSending: false,
        streamingResponse: null,
        isStreaming: false,
        streamingStatus: 'complete',
        streamingTokenCount: 0,
        streamingCharsPerSecond: 0,
        streamingMessageId: null,
        streamingStartedAt: null,
        streamingLastChunkAt: null,
        error: null,
        lastSentAt: new Date().toISOString(),
      },
    }));
  },

  // Sprint 7+: Streaming message send with structured lifecycle events.
  sendStreamingMessage: async (threadId, content) => {
    const startedAt = new Date().toISOString();
    const currentThread = get().threads.find((t) => t.id === threadId);
    const sessionKey = currentThread?.session?.id ?? threadId;
    const userMessageId = `msg-${threadId}-${Date.now()}`;
    const assistantMessageId = `msg-${threadId}-${Date.now()}-resp`;
    const userMessage = {
      id: userMessageId,
      role: 'user' as const,
      content,
      timestamp: startedAt,
    };
    const emptyAssistant = {
      id: assistantMessageId,
      role: 'assistant' as const,
      content: '',
      timestamp: startedAt,
    };

    const upsertSessionMessages = (
      messages: Thread['messages'],
      fetchedAt = new Date().toISOString(),
    ) => ({
      messages,
      fetchedAt,
    });

    set((state) => {
      const existingTranscript = state.sessionMessages[sessionKey] ?? state.sessionMessages[threadId];
      const baseTranscript = existingTranscript?.messages ?? currentThread?.messages ?? [];
      const nextTranscript = [...baseTranscript, userMessage, emptyAssistant] as Thread['messages'];
      return {
        threads: state.threads.map((t) =>
          t.id === threadId
            ? {
                ...t,
                title: isLocalSessionThread(t.id) && t.messages.length === 0 ? titleFromMessage(content) : t.title,
                messages: [...t.messages, userMessage, emptyAssistant] as Thread['messages'],
                lastActive: startedAt,
              }
            : t
        ),
        sessionMessages: {
          ...state.sessionMessages,
          [sessionKey]: upsertSessionMessages(nextTranscript, startedAt),
          ...(sessionKey !== threadId ? { [threadId]: upsertSessionMessages(nextTranscript, startedAt) } : {}),
        },
        composerState: {
          ...state.composerState,
          isSending: true,
          isStreaming: true,
          streamingStatus: 'connecting',
          streamingResponse: '',
          streamingTokenCount: 0,
          streamingCharsPerSecond: 0,
          streamingMessageId: assistantMessageId,
          streamingStartedAt: startedAt,
          streamingLastChunkAt: null,
          error: null,
        },
      };
    });

    const streamStartedMs = Date.now();
    const controller = new AbortController();
    let accumulated = '';
    let chunkCount = 0;
    let finalError: string | null = null;

    const updateAssistantText = (nextContent: string, event?: StreamMessageEvent) => {
      const now = new Date().toISOString();
      const elapsedSeconds = Math.max((Date.now() - streamStartedMs) / 1000, 0.25);
      const charsPerSecond = Math.round(nextContent.length / elapsedSeconds);

      set((state) => {
        const updateMessages = (messages: Thread['messages']) =>
          messages.map((m) => (m.id === assistantMessageId ? { ...m, content: nextContent } : m));
        const existingTranscript = state.sessionMessages[sessionKey] ?? state.sessionMessages[threadId];
        const transcriptMessages = existingTranscript
          ? updateMessages(existingTranscript.messages)
          : updateMessages(currentThread?.messages ?? []);

        return {
          threads: state.threads.map((t) =>
            t.id === threadId
              ? {
                  ...t,
                  messages: updateMessages(t.messages) as Thread['messages'],
                  lastActive: now,
                }
              : t
          ),
          sessionMessages: {
            ...state.sessionMessages,
            [sessionKey]: upsertSessionMessages(transcriptMessages as Thread['messages'], now),
            ...(sessionKey !== threadId ? { [threadId]: upsertSessionMessages(transcriptMessages as Thread['messages'], now) } : {}),
          },
          composerState: {
            ...state.composerState,
            streamingResponse: nextContent,
            streamingStatus: event?.type === 'chunk' ? 'streaming' : state.composerState.streamingStatus,
            streamingTokenCount: chunkCount,
            streamingCharsPerSecond: charsPerSecond,
            streamingLastChunkAt: now,
          },
        };
      });
    };

    try {
      const stream = streamMessage({ sessionKey, content }, { signal: controller.signal });
      const reader = stream.getReader();

      for (;;) {
        const { done, value } = await reader.read();
        if (done || !value) break;

        if (value.type === 'open') {
          set((state) => ({
            composerState: {
              ...state.composerState,
              streamingStatus: 'streaming',
              streamingLastChunkAt: value.at,
            },
          }));
          continue;
        }

        if (value.type === 'heartbeat') {
          set((state) => ({
            composerState: {
              ...state.composerState,
              streamingLastChunkAt: value.at,
            },
          }));
          continue;
        }

        if (value.type === 'chunk') {
          chunkCount += 1;
          accumulated += value.chunk;
          updateAssistantText(accumulated, value);
          continue;
        }

        if (value.type === 'error') {
          finalError = value.error;
          break;
        }

        if (value.type === 'done') {
          set((state) => ({
            composerState: {
              ...state.composerState,
              streamingStatus: 'finalizing',
              streamingLastChunkAt: value.at,
            },
          }));
          break;
        }
      }
    } catch (e) {
      finalError = e instanceof Error ? e.message : 'Stream failed';
    }

    if (finalError) {
      const errorText = accumulated || `Stream failed: ${finalError}`;
      updateAssistantText(errorText);
      set((state) => ({
        composerState: {
          ...state.composerState,
          isSending: false,
          isStreaming: false,
          streamingStatus: 'error',
          streamingResponse: errorText,
          streamingMessageId: assistantMessageId,
          error: finalError,
        },
      }));
      setTimeout(() => { get().clearComposerError(); }, 5000);
      return;
    }

    // Stream complete
    set((state) => ({
      composerState: {
        ...state.composerState,
        isSending: false,
        isStreaming: false,
        streamingStatus: 'complete',
        streamingResponse: null,
        streamingMessageId: null,
        streamingLastChunkAt: new Date().toISOString(),
        lastSentAt: new Date().toISOString(),
      },
    }));
  },

  clearComposerError: () =>
    set((state) => ({
      composerState: {
        ...state.composerState,
        error: null,
        streamingResponse: null,
        isStreaming: false,
        isSending: false,
        streamingStatus: 'idle',
        streamingTokenCount: 0,
        streamingCharsPerSecond: 0,
        streamingMessageId: null,
        streamingStartedAt: null,
        streamingLastChunkAt: null,
      },
    })),

  // Sprint 2: Message highlighting
  highlightMessage: (messageId) =>
    set({ highlightedMessageId: messageId }),

  // Sprint 8: Open a child session in a secondary pane
  openChildSession: (childSessionId, delegationEventId) => {
    set((state) => {
      // Find the child session in stored sessions
      const childSession = state.sessions.find((s) => s.id === childSessionId);
      if (!childSession) {
        console.warn('[store] openChildSession: session not in store', childSessionId);
        return {};
      }

      // Sprint 8: Look up the delegation event to find the parent threadId.
      // delegationEventId is the event ID; we match it against state.delegationEvents.
      // The event's threadId IS the parent session.
      const delegationEvent = delegationEventId
        ? state.delegationEvents.find((e) => e.id === delegationEventId)
        : null;
      const parentSessionId = delegationEvent?.threadId
        ?? childSession.parentSessionId
        ?? state.childToParentMap[childSessionId];

      // Build a Thread for the child session
      const childThread: Thread = {
        id: childSession.id,
        title: childSession.title ?? childSession.shortId ?? childSessionId,
        status:
          childSession.status === 'done' || childSession.status === 'idle'
            ? 'done'
            : 'active',
        lastActive: childSession.lastMessageAt ?? new Date().toISOString(),
        unreadCount: 0,
        hasApproval: false,
        linkedAgents: [],
        messages: [],
        session: childSession,
      };

      // Add child thread if not already present
      const existingChild = state.threads.find((t) => t.id === childSessionId);
      const updatedThreads = existingChild
        ? state.threads
        : [...state.threads, childThread];

      // Determine workspace transition based on current preset
      const ws = state.workspace;
      const isFocus = ws.panes.length === 1;

      let nextPanes: typeof ws.panes;
      let activePaneId: string;

      if (isFocus) {
        const primaryThreadId = ws.panes[0]?.threadId ?? state.selectedThreadId;
        nextPanes = [
          { id: 'pane-left', role: 'primary', threadId: primaryThreadId, widthRatio: 0.5, active: true, collapsed: false },
          { id: 'pane-right', role: 'secondary', threadId: childSessionId, widthRatio: 0.5, active: false, collapsed: false },
        ];
        activePaneId = 'pane-right';
      } else if (ws.preset === 'operator') {
        nextPanes = ws.panes.map((p) =>
          p.role === 'monitor'
            ? { ...p, threadId: childSessionId, collapsed: false, active: true }
            : { ...p, active: p.role === 'primary' }
        );
        activePaneId = nextPanes.find((p) => p.role === 'monitor')?.id ?? 'pane-monitor';
      } else {
        nextPanes = ws.panes.map((p) =>
          p.role === 'secondary'
            ? { ...p, threadId: childSessionId, active: true }
            : { ...p, active: p.role === 'primary' ? true : false }
        );
        activePaneId = nextPanes.find((p) => p.role === 'secondary')?.id ?? ws.activePaneId;
      }

      // Sprint 8: Build updated childSessionIds with correct direction (parent → children)
      const nextChildSessionIds = { ...state.childSessionIds };
      if (parentSessionId) {
        nextChildSessionIds[parentSessionId] = [
          ...(nextChildSessionIds[parentSessionId] ?? []),
          childSessionId,
        ];
      }

      // Sprint 8: Build child→parent reverse map
      const nextChildToParentMap = { ...state.childToParentMap };
      if (parentSessionId) {
        nextChildToParentMap[childSessionId] = parentSessionId;
      }

      // Sprint 8: Mark as followed so dock shows the indicator
      const nextFollowed = state.followedSessionIds.includes(childSessionId)
        ? state.followedSessionIds
        : [...state.followedSessionIds, childSessionId];

      // Sprint 8: Update parent's linkedChildren to include this child
      const threadsWithLinkedChildren = updatedThreads.map((t) => {
        if (t.id === parentSessionId) {
          return {
            ...t,
            linkedChildren: [...(t.linkedChildren ?? []), childSessionId],
          };
        }
        return t;
      });

      return {
        threads: threadsWithLinkedChildren,
        selectedThreadId: childSessionId,
        workspace: {
          ...ws,
          preset: isFocus ? 'duo' : ws.preset,
          panes: nextPanes,
          activePaneId,
        },
        childSessionIds: nextChildSessionIds,
        childToParentMap: nextChildToParentMap,
        followedSessionIds: nextFollowed,
        // Sprint 8: Mark the delegation event as active so parent timeline shows it highlighted
        activeDelegationEventId: delegationEventId ?? null,
      };
    });
  },
}));

// Re-export types for convenience
export type { Thread, Agent, Approval, RuntimeState } from '@/lib/types';
export type { DelegationEvent, DelegationEventType } from '@/lib/types';
export type { SplitViewState, ComposerState, PaneSide } from '@/lib/types';
export type { WorkspaceState, WorkspacePreset, ResizeState, Pane, PaneRole } from '@/lib/types';
