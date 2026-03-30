'use client';

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

/** Minimal email gate shape stored in the Signal Loom state */
export interface EmailGateStoreItem {
  id: string;
  threadId?: string;
  summary: string;
  toRecipient: string;
  toRole?: string;
  isExecutive: boolean;
  isNewTopic: boolean;
  confidence: 'high' | 'medium' | 'low';
  rationale: string;
  proposedTiming: string;
  gateStatus: 'draft' | 'needs_review' | 'ready_for_approval' | 'human_approved' | 'human_denied';
  lastChangedAt: string;
  humanNote?: string;
  approvalInvalidated?: boolean;
  proposedEmail: {
    subject: string;
    body: string;
    footer?: string;
  };
}

// ---------------------------------------------------------------------------
// Mock email gates — Sprint 3 DE verification data
// All gates start in non-sendable states. Only human_approved is sendable.
// ---------------------------------------------------------------------------

const MOCK_EMAIL_GATES: EmailGateStoreItem[] = [
  {
    id: 'gate-brian-mcgary',
    threadId: 'thread-hermes-1',
    summary: 'Brian McGarry — website studio deployment approval follow-up',
    toRecipient: 'Brian McGarry',
    toRole: 'Commercial Director, CPK',
    isExecutive: false,
    isNewTopic: true,
    confidence: 'high',
    rationale:
      'Higher scrutiny: first contact with this recipient about this topic. ' +
      'Review carefully before approving. Gbemi — your approval is required before this can be sent.',
    proposedTiming: 'Within 24 hours',
    gateStatus: 'needs_review',
    lastChangedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    proposedEmail: {
      subject: 'Verdantia — Your website is ready to go live',
      body: `Hi Brian,\n\nFollowing our conversation, I'm pleased to let you know your Verdantia website is fully built and ready for your review.\n\nAre you available for a 20-minute call this week?\n\nBest regards,\nOluwagbemi Akadiri`,
      footer: '-- \nOluwagbemi Akadiri\nVerdantia Ltd\nAI Consulting & Training\nwww.verdantia.ai',
    },
  },
  {
    id: 'gate-larkfield-followup',
    threadId: 'thread-hermes-2',
    summary: 'Larkfield — Q2 strategy meeting follow-up',
    toRecipient: 'Sarah McGarry',
    toRole: 'Managing Partner, Larkfield',
    isExecutive: false,
    isNewTopic: false,
    confidence: 'high',
    rationale:
      'Standard review. This is a routine outreach or follow-up to an existing contact — ' +
      'but your approval is still required before this goes out.',
    proposedTiming: 'Within SLA window',
    gateStatus: 'ready_for_approval',
    lastChangedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    proposedEmail: {
      subject: 'Verdantia — Q2 strategy session',
      body: `Hi Sarah,\n\nThank you for your time on our call. As discussed, I'm following up with a tailored proposal for Larkfield's Q2 priorities.\n\nBest,\nOluwagbemi Akadiri`,
      footer: '-- \nOluwagbemi Akadiri\nVerdantia Ltd\nAI Consulting & Training\nwww.verdantia.ai',
    },
  },
  {
    id: 'gate-cfo-escalation',
    threadId: 'thread-hermes-3',
    summary: 'Verdantia expansion — proposal to CFO',
    toRecipient: 'Adedolapo Grace Babalola',
    toRole: 'CFO',
    isExecutive: true,
    isNewTopic: false,
    confidence: 'low',
    rationale:
      'Higher scrutiny: addressed to executive role (CFO), Hermès has low confidence in this draft. ' +
      'Review carefully before approving. Gbemi — your approval is required before this can be sent.',
    proposedTiming: 'Within 2 hours (SLA)',
    gateStatus: 'needs_review',
    lastChangedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    proposedEmail: {
      subject: 'Verdantia — Q2 expansion proposal',
      body: `Hi Grace,\n\nI wanted to share some thoughts on how Verdantia could expand its reach in Q2. Based on recent client conversations, I believe there's significant demand for AI training in the mid-market segment.\n\nWould you have 30 minutes to discuss?\n\nWith respect,\nOluwagbemi Akadiri`,
      footer: '-- \nOluwagbemi Akadiri\nVerdantia Ltd\nAI Consulting & Training\nwww.verdantia.ai',
    },
  },
  {
    id: 'gate-approved-demo',
    threadId: 'thread-hermes-4',
    summary: 'Follow-up after AI workshop — prospective client',
    toRecipient: 'Michael Okafor',
    toRole: 'Head of Learning, TechCorp',
    isExecutive: false,
    isNewTopic: false,
    confidence: 'medium',
    rationale:
      'Standard review. This is a routine outreach or follow-up — ' +
      'but your approval is still required before this goes out.',
    proposedTiming: 'Within SLA window',
    gateStatus: 'human_approved',
    lastChangedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    humanNote: 'Approved — good framing',
    proposedEmail: {
      subject: 'Verdantia — Next steps after the workshop',
      body: `Hi Michael,\n\nThank you for attending the AI workshop last week. I enjoyed our conversation about TechCorp's upskilling goals.\n\nI've put together a short proposal covering the three areas we discussed. Happy to walk you through it whenever suits.\n\nBest,\nOluwagbemi Akadiri`,
      footer: '-- \nOluwagbemi Akadiri\nVerdantia Ltd\nAI Consulting & Training\nwww.verdantia.ai',
    },
  },
  {
    id: 'gate-denied-revision',
    threadId: 'thread-hermes-5',
    summary: 'Initial outreach — potential AI consulting lead',
    toRecipient: 'David Walsh',
    toRole: 'Operations Director, FinServe Ltd',
    isExecutive: false,
    isNewTopic: true,
    confidence: 'low',
    rationale:
      'Higher scrutiny: first contact with this recipient about this topic, Hermès has low confidence in this draft. ' +
      'Review carefully before approving. Gbemi — your approval is required before this can be sent.',
    proposedTiming: 'Within 24 hours',
    gateStatus: 'human_denied',
    lastChangedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    humanNote: 'Tone is too pushy — please revise',
    proposedEmail: {
      subject: 'Verdantia — Quick question about AI upskilling',
      body: `Hi David,\n\nI think Verdantia could save your team a lot of time with AI automation. We're working with companies like yours right now and the results are incredible.\n\nCan we jump on a call?\n\nBest,\nOluwagbemi Akadiri`,
      footer: '-- \nOluwagbemi Akadiri\nVerdantia Ltd\nAI Consulting & Training\nwww.verdantia.ai',
    },
  },
];

import { mockThreads, mockApprovals, mockRuntime, mockAgents } from '@/lib/mock/data';
import { mockDelegationEvents } from '@/lib/mock/delegation-data';
import {
  loadSessions as adapterLoadSessions,
  loadAgents as adapterLoadAgents,
  loadApprovals as adapterLoadApprovals,
  loadRuntimeHealth as adapterLoadRuntimeHealth,
  loadSessionMessages as adapterLoadSessionMessages,
  sendMessage as adapterSendMessage,
  loadDelegationEvents as adapterLoadDelegationEvents,
} from '@/lib/openclaw/adapter';

// --- Preset helpers ---

const MIN_FULL_PANE = 280;
const MIN_MONITOR_COLLAPSED = 160;
const MIN_MONITOR_EXPANDED = 220;

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
  const newRatioB = startB + deltaRatio;
  // Clamp — prevent panes going below minimums
  const minFull = MIN_FULL_PANE / totalWidth;
  const minMonitor = MIN_MONITOR_COLLAPSED / totalWidth;
  let ratioA = newRatioA;
  let ratioB = newRatioB;
  if (ratioA < minFull) { ratioA = minFull; ratioB = 1 - minFull; }
  if (ratioB < minFull && ratioB < minMonitor) { ratioB = minFull; ratioA = 1 - minFull; }
  return { ratioA, ratioB };
}

// --- Store interface ---

interface SignalLoomStore {
  threads: Thread[];
  selectedThreadId: string;
  agents: Agent[];
  approvals: Approval[];
  runtime: RuntimeState;
  approvalsPanelOpen: boolean;
  emailComposerOpen: boolean;

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
  sessionsFetchedAt: string | null;

  // Sprint 3 DE: Human email gate (Hermès)
  // Minimal shape to avoid circular adapter imports in store
  emailGates: EmailGateStoreItem[];
  setEmailGates: (gates: EmailGateStoreItem[]) => void;
  updateEmailGate: (gate: EmailGateStoreItem) => void;
  initEmailGates: () => void;

  // Actions
  selectThread: (id: string) => void;
  markThreadRead: (id: string) => void;
  toggleApprovalsPanel: () => void;
  toggleEmailComposer: () => void;

  // Sprint 3: Data loading via OpenClaw adapter
  loadSessions: () => Promise<void>;
  loadAgents: () => Promise<void>;
  loadApprovals: () => Promise<void>;
  loadRuntimeHealth: () => Promise<void>;
  loadMessagesForThread: (sessionKey: string) => Promise<void>;

  // Sprint 2: Legacy split view actions
  setSplitView: (enabled: boolean, secondaryThreadId?: string) => void;
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
  clearComposerError: () => void;

  // Sprint 2: Message highlighting
  highlightMessage: (messageId: string | null) => void;
}

export const useSignalLoomStore = create<SignalLoomStore>((set, get) => ({
  threads: mockThreads,
  selectedThreadId: 'thread-1',
  agents: mockAgents,
  approvals: mockApprovals,
  runtime: mockRuntime,
  approvalsPanelOpen: false,
  emailComposerOpen: false,

  // Sprint 2 legacy (migrated to workspace in 2.5)
  splitView: {
    enabled: false,
    primaryThreadId: 'thread-1',
    secondaryThreadId: null,
    activePane: 'left',
  },
  composerState: {
    isSending: false,
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
  sessionsFetchedAt: null,

  // Sprint 3 DE: Human email gate (Hermès)
  emailGates: [],
  setEmailGates: (gates) => set({ emailGates: gates }),
  updateEmailGate: (gate) =>
    set((state) => ({
      emailGates: state.emailGates.map((g) => (g.id === gate.id ? gate : g)),
    })),
  initEmailGates: () => {
    const { emailGates } = get();
    if (emailGates.length > 0) return; // already initialized
    set({ emailGates: MOCK_EMAIL_GATES });
  },

  // ---- Actions ----

  selectThread: (id) =>
    set((state) => {
      const ws = state.workspace;
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
          threads: state.threads.map((t) => (t.id === id ? { ...t, unreadCount: 0 } : t)),
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
        threads: state.threads.map((t) => (t.id === id ? { ...t, unreadCount: 0 } : t)),
      };
    }),

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

  toggleEmailComposer: () =>
    set((state) => ({
      emailComposerOpen: !state.emailComposerOpen,
    })),

  // ---- Sprint 3: OpenClaw adapter data loading ----

  loadSessions: async () => {
    set({ sessionsLoading: true, sessionsError: null });
    const result = await adapterLoadSessions();
    if (!result.ok) {
      set({ sessionsLoading: false, sessionsError: result.error });
      return;
    }
    // Map OpenClawSession[] → Thread[]
    const adaptedThreads: Thread[] = result.data.map((s) => ({
      id: s.id,
      title: s.title,
      messages: [] as Thread["messages"], // loaded lazily
      linkedAgents: [],
      delegationEvents: [],
      linkedThreads: [],
      tags: s.tags,
      status: s.status === 'active' ? 'active'
        : s.status === 'done' ? 'done'
        : s.status === 'idle' ? 'done'
        : 'active',
      unreadCount: 0,
      hasApproval: false,
      lastActive: s.lastMessageAt ?? new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }));
    set((state) => ({
      threads: adaptedThreads.length > 0 ? adaptedThreads : state.threads,
      sessionsLoading: false,
      sessionsFetchedAt: result.fetchedAt,
      sessionsError: null,
      // Select first thread if nothing is selected
      selectedThreadId: state.selectedThreadId || (adaptedThreads[0]?.id ?? state.selectedThreadId),
      // Update workspace to use first session as primary thread
      workspace: adaptedThreads.length > 0
        ? {
            ...state.workspace,
            panes: state.workspace.panes.map((p) =>
              p.role === 'primary'
                ? { ...p, threadId: adaptedThreads[0].id }
                : p
            ),
          }
        : state.workspace,
    }));
  },

  loadAgents: async () => {
    const result = await adapterLoadAgents();
    if (!result.ok) return; // agents are non-critical, just keep mock
    set({ agents: result.data as unknown as Agent[] });
  },

  loadApprovals: async () => {
    const result = await adapterLoadApprovals();
    if (!result.ok) return;
    const adapted: Approval[] = result.data.map((a) => ({
      id: a.id,
      title: a.summary,
      urgency: 'medium' as const,
      raisedBy: a.requestedBy as string,
      recommendation: '',
      linkedThreadId: a.linkedThreadId ?? '',
    }));
    set({ approvals: adapted });
  },

  loadRuntimeHealth: async () => {
    const result = await adapterLoadRuntimeHealth();
    if (!result.ok) {
      set((state) => ({
        runtime: {
          ...state.runtime,
          gateway: 'down' as const,
        },
      }));
      return;
    }
    const { gateway, queue, heartbeat } = result.data;
    set((state) => ({
      runtime: {
        ...state.runtime,
        gateway: gateway.reachable ? 'healthy' as const : 'down' as const,
        queue: queue.healthy ? 'healthy' as const : 'backed_up' as const,
        heartbeatFreshness: heartbeat.fresh ? 'fresh' as const : 'stale' as const,
      },
    }));
  },

  loadMessagesForThread: async (sessionKey: string) => {
    const result = await adapterLoadSessionMessages(sessionKey);
    if (!result.ok || result.data.length === 0) return;
    const adaptedMessages = result.data.map((m) => ({
      id: m.id,
      role: m.role === 'action-summary' ? 'action-summary' : m.role,
      content: m.content,
      timestamp: m.timestamp,
    }));
    set((state) => ({
      threads: state.threads.map((t) =>
        t.id === sessionKey
          ? { ...t, messages: adaptedMessages as Thread['messages'] }
          : t
      ),
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
      composerState: { ...state.composerState, isSending: true, error: null },
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
          ? { ...t, messages: [...t.messages, userMessage], lastActive: new Date().toISOString() }
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
        isSending: false,
        error: null,
        lastSentAt: new Date().toISOString(),
      },
    }));
  },

  clearComposerError: () =>
    set((state) => ({
      composerState: { ...state.composerState, error: null },
    })),

  // Sprint 2: Message highlighting
  highlightMessage: (messageId) =>
    set({ highlightedMessageId: messageId }),
}));

// Re-export types for convenience
export type { Thread, Agent, Approval, RuntimeState } from '@/lib/types';
export type { DelegationEvent, DelegationEventType } from '@/lib/types';
export type { SplitViewState, ComposerState, PaneSide } from '@/lib/types';
export type { WorkspaceState, WorkspacePreset, ResizeState, Pane, PaneRole } from '@/lib/types';
