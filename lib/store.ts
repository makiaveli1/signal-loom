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
import type { OpenClawSession } from '@/lib/openclaw/adapter/types';
import type { EmailGateAuditEntry } from '@/lib/openclaw/adapter/types';

/** Minimal email gate shape stored in the Signal Loom state */
export interface EmailGateStoreItem {
  id: string;
  threadId?: string;
  /** CRM: which lead this email is for */
  leadId?: string;
  /** CRM: current concept status for this lead — mirrors the lead's concept state */
  conceptStatus?: string;
  /** CRM: whether a clean public preview URL exists for this lead's concept */
  publicPreviewUrl?: string;
  summary: string;
  toRecipient: string;
  toRole?: string;
  toEmail?: string;
  isExecutive: boolean;
  isNewTopic: boolean;
  confidence: 'high' | 'medium' | 'low';
  rationale: string;
  proposedTiming: string;
  gateStatus: 'draft' | 'needs_review' | 'ready_for_approval' | 'human_approved' | 'sending' | 'sent' | 'send_failed' | 'human_denied';
  lastChangedAt: string;
  humanNote?: string;
  approvalInvalidated?: boolean;
  proposedEmail: {
    subject: string;
    body: string;
    footer?: string;
  };
  /** Send audit trail */
  auditLog?: EmailGateAuditEntry[];
  /** ISO timestamp of successful send */
  sentAt?: string;
  /** Last send error message */
  sendError?: string;
  /** Number of send attempts */
  sendAttempts?: number;
}

// ---------------------------------------------------------------------------
// Mock email gates — Sprint 3 DE verification data
// All gates start in non-sendable states. Only human_approved is sendable.
// ---------------------------------------------------------------------------

const MOCK_EMAIL_GATES: EmailGateStoreItem[] = [
  {
    id: 'gate-brian-mcgary',
    threadId: 'thread-hermes-1',
    leadId: 'brian-mcgarry-plumber',
    conceptStatus: 'approved',
    publicPreviewUrl: 'https://makiaveli1.github.io/brian-mcgarry-plumber/',
    summary: 'Brian McGarry — Verdantia website concept follow-up',
    toRecipient: 'Brian McGarry',
    toRole: 'Owner',
    toEmail: 'brianmcgarry90@gmail.com',
    isExecutive: false,
    isNewTopic: true,
    confidence: 'high',
    rationale:
      'Concept formally approved by Nero (2026-04-01). Outreach draft complete. ' +
      'Pending: durable preview URL (GitHub Pages), Likwid human approval, mailbox setup. ' +
      'Concept-first send rule enforced — all gates must pass before send.',
    proposedTiming: 'Within 24 hours',
    gateStatus: 'ready_for_approval',
    lastChangedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    auditLog: [
      { at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), action: 'draft_created' },
      { at: new Date(Date.now() - 28 * 60 * 1000).toISOString(), action: 'submitted_for_review' },
      { at: '2026-04-01T19:00:00Z', action: 'approved' }, // Nero formal concept approval
      { at: '2026-04-01T19:00:00Z', action: 'approved' }, // Moved to pending Likwid review
    ],
    proposedEmail: {
      subject: 'Verdantia — Your website concept is ready to review',
      body: `Hi Brian,\n\nFollowing our conversation, I've built a custom website concept tailored for Brian McGarry Plumbing. I'd love to walk you through it — takes about 15 minutes.\n\nAre you available for a call this week?\n\nBest regards,\nOluwagbemi Akadiri`,
      footer: '-- \nOluwagbemi Akadiri\nVerdantia Ltd\nAI Consulting & Training\nwww.verdantia.ai',
    },
  },
  {
    id: 'gate-larkfield-followup',
    threadId: 'thread-hermes-2',
    leadId: 'larkfield-plumbing-contractors',
    conceptStatus: 'not_started',
    summary: 'Larkfield — custom website concept introduction',
    toRecipient: 'Sarah McGarry',
    toRole: 'Managing Partner',
    toEmail: 'sarah@larkfield.example.com',
    isExecutive: false,
    isNewTopic: true,
    confidence: 'medium',
    rationale:
      'Higher scrutiny: first contact about a new topic (website concept). ' +
      'Concept has not been started yet — outreach draft references the concept that will be built. ' +
      'Gbemi — your approval is required before this can be sent.',
    proposedTiming: 'Within SLA window',
    gateStatus: 'needs_review',
    lastChangedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    auditLog: [
      { at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), action: 'draft_created' },
      { at: new Date(Date.now() - 90 * 60 * 1000).toISOString(), action: 'submitted_for_review' },
    ],
    proposedEmail: {
      subject: 'Verdantia — Custom website concept for Larkfield',
      body: `Hi Sarah,\n\nThank you for your time on our call. As discussed, I've begun working on a custom website concept tailored for Larkfield Plumbing Contractors.\n\nBefore I send the full concept over — would you have 15 minutes this week to review it together?\n\nBest,\nOluwagbemi Akadiri`,
      footer: '-- \nOluwagbemi Akadiri\nVerdantia Ltd\nAI Consulting & Training\nwww.verdantia.ai',
    },
  },
  {
    id: 'gate-cfo-escalation',
    threadId: 'thread-hermes-3',
    leadId: undefined,
    conceptStatus: undefined,
    summary: 'Verdantia expansion — internal proposal follow-up',
    toRecipient: 'Adedolapo Grace Babalola',
    toRole: 'CFO',
    toEmail: 'grace.babalola@verdantia.example.com',
    isExecutive: true,
    isNewTopic: false,
    confidence: 'low',
    rationale:
      'Higher scrutiny: addressed to executive role (CFO), Hermès has low confidence in this draft. ' +
      'Review carefully before approving. Gbemi — your approval is required before this can be sent.',
    proposedTiming: 'Within 2 hours (SLA)',
    gateStatus: 'needs_review',
    lastChangedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    auditLog: [
      { at: new Date(Date.now() - 15 * 60 * 1000).toISOString(), action: 'draft_created' },
      { at: new Date(Date.now() - 10 * 60 * 1000).toISOString(), action: 'submitted_for_review' },
    ],
    proposedEmail: {
      subject: 'Verdantia — Q2 expansion proposal',
      body: `Hi Grace,\n\nI wanted to share some thoughts on how Verdantia could expand its reach in Q2. Based on recent client conversations, I believe there's significant demand for AI training in the mid-market segment.\n\nWould you have 30 minutes to discuss?\n\nWith respect,\nOluwagbemi Akadiri`,
      footer: '-- \nOluwagbemi Akadiri\nVerdantia Ltd\nAI Consulting & Training\nwww.verdantia.ai',
    },
  },
  {
    id: 'gate-approved-demo',
    threadId: 'thread-hermes-4',
    leadId: undefined,
    conceptStatus: undefined,
    summary: 'Follow-up after AI workshop — prospective client',
    toRecipient: 'Michael Okafor',
    toRole: 'Head of Learning, TechCorp',
    toEmail: 'michael.okafor@techcorp.example.com',
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
    auditLog: [
      { at: new Date(Date.now() - 45 * 60 * 1000).toISOString(), action: 'draft_created' },
      { at: new Date(Date.now() - 44 * 60 * 1000).toISOString(), action: 'submitted_for_review' },
      { at: new Date(Date.now() - 45 * 60 * 1000).toISOString(), action: 'approved', note: 'Approved — good framing' },
    ],
    proposedEmail: {
      subject: 'Verdantia — Next steps after the workshop',
      body: `Hi Michael,\n\nThank you for attending the AI workshop last week. I enjoyed our conversation about TechCorp's upskilling goals.\n\nI've put together a short proposal covering the three areas we discussed. Happy to walk you through it whenever suits.\n\nBest,\nOluwagbemi Akadiri`,
      footer: '-- \nOluwagbemi Akadiri\nVerdantia Ltd\nAI Consulting & Training\nwww.verdantia.ai',
    },
  },
  {
    id: 'gate-denied-revision',
    threadId: 'thread-hermes-5',
    leadId: undefined,
    conceptStatus: undefined,
    summary: 'Initial outreach — potential AI consulting lead',
    toRecipient: 'David Walsh',
    toRole: 'Operations Director, FinServe Ltd',
    toEmail: 'david.walsh@finserve.example.com',
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
    auditLog: [
      { at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), action: 'draft_created' },
      { at: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString(), action: 'submitted_for_review' },
      { at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), action: 'denied', note: 'Tone is too pushy — please revise' },
    ],
    proposedEmail: {
      subject: 'Verdantia — Quick question about AI upskilling',
      body: `Hi David,\n\nI think Verdantia could save your team a lot of time with AI automation. We're working with companies like yours right now and the results are incredible.\n\nCan we jump on a call?\n\nBest,\nOluwagbemi Akadiri`,
      footer: '-- \nOluwagbemi Akadiri\nVerdantia Ltd\nAI Consulting & Training\nwww.verdantia.ai',
    },
  },
];

import { mockThreads, mockRuntime, mockAgents } from '@/lib/mock/data';
import { mockDelegationEvents } from '@/lib/mock/delegation-data';
import {
  loadSessions as adapterLoadSessions,
  loadAgents as adapterLoadAgents,
  loadApprovals as adapterLoadApprovals,
  loadRuntimeHealth as adapterLoadRuntimeHealth,
  loadSessionMessages as adapterLoadSessionMessages,
  sendMessage as adapterSendMessage,
  loadDelegationEvents as adapterLoadDelegationEvents,
  resolveApproval as adapterResolveApproval,
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
  /** Raw OpenClaw sessions — used to build Thread objects for selection */
  sessions: OpenClawSession[];
  selectedThreadId: string;
  agents: Agent[];
  approvals: Approval[];
  runtime: RuntimeState;
  approvalsPanelOpen: boolean;
  emailComposerOpen: boolean;
  /** CRM Lead Dossier panel — concept-first workflow */
  crmPanelOpen: boolean;
  toggleCrmPanel: () => void;

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

  // Sprint 3 DE: Human email gate (Hermès)
  // Minimal shape to avoid circular adapter imports in store
  emailGates: EmailGateStoreItem[];
  setEmailGates: (gates: EmailGateStoreItem[]) => void;
  updateEmailGate: (gate: EmailGateStoreItem) => void;
  initEmailGates: () => void;
  sendEmail: (gateId: string) => Promise<void>;

  // Actions
  selectThread: (id: string, session?: OpenClawSession) => void;
  markThreadRead: (id: string) => void;
  toggleApprovalsPanel: () => void;
  toggleEmailComposer: () => void;

  // Sprint 3: Data loading via OpenClaw adapter
  loadSessions: () => Promise<void>;
  loadAgents: () => Promise<void>;
  loadApprovals: () => Promise<void>;
  resolveApproval: (approvalId: string, decision: 'approved' | 'denied' | 'revised', note?: string) => Promise<void>;
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
  sessions: [] as OpenClawSession[],
  selectedThreadId: 'thread-1',
  agents: mockAgents,
  approvals: [], // loaded from adapter on mount; store shows empty while loading
  runtime: mockRuntime,
  approvalsPanelOpen: false,
  emailComposerOpen: false,
  crmPanelOpen: false,

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
  healthLoading: true,
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
    if (emailGates.length > 0) return; // already initialized — don't re-init
    // Email gates are initialized with mock data; real loading happens in useEffect
    set({ emailGates: MOCK_EMAIL_GATES });
  },

  sendEmail: async (gateId) => {
    const { emailGates, updateEmailGate } = get();
    const gate = emailGates.find((g) => g.id === gateId);
    if (!gate) {
      throw new Error(`Gate not found: ${gateId}`);
    }

    // Server-side enforcement — double-check before making the API call
    if (gate.gateStatus !== 'human_approved') {
      throw new Error(
        `Send blocked: gate is "${gate.gateStatus}" — human approval is required.`
      );
    }

    // Transition to sending
    const sendingGate: EmailGateStoreItem = {
      ...gate,
      gateStatus: 'sending',
      lastChangedAt: new Date().toISOString(),
      sendAttempts: (gate.sendAttempts ?? 0) + 1,
      auditLog: [
        ...(gate.auditLog ?? []),
        { at: new Date().toISOString(), action: 'send_initiated' },
      ],
    };
    updateEmailGate(sendingGate);

    // Call the real dispatch API
    try {
      const res = await fetch('/api/hermes/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gateId: gate.id,
          toEmail: gate.toEmail ?? `${gate.toRecipient.replace(' ', '.').toLowerCase()}@example.com`,
          toName: gate.toRecipient,
          subject: gate.proposedEmail.subject,
          body: gate.proposedEmail.body,
          footer: gate.proposedEmail.footer,
          gateStatus: gate.gateStatus,
        }),
      });

      const data = (await res.json()) as { ok: boolean; sent?: boolean; sentAt?: string; error?: string };

      if (data.ok && data.sent) {
        updateEmailGate({
          ...sendingGate,
          gateStatus: 'sent',
          lastChangedAt: new Date().toISOString(),
          sentAt: data.sentAt ?? new Date().toISOString(),
          auditLog: [
            ...(sendingGate.auditLog ?? []),
            { at: new Date().toISOString(), action: 'send_succeeded' },
          ],
        });
      } else {
        updateEmailGate({
          ...sendingGate,
          gateStatus: 'send_failed',
          lastChangedAt: new Date().toISOString(),
          sendError: data.error ?? 'Unknown send error',
          auditLog: [
            ...(sendingGate.auditLog ?? []),
            {
              at: new Date().toISOString(),
              action: sendingGate.sendAttempts && sendingGate.sendAttempts > 1 ? 'retry_initiated' : 'send_failed',
              note: data.error ?? 'Unknown send error',
            },
          ],
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      updateEmailGate({
        ...sendingGate,
        gateStatus: 'send_failed',
        lastChangedAt: new Date().toISOString(),
        sendError: message,
        auditLog: [
          ...(sendingGate.auditLog ?? []),
          { at: new Date().toISOString(), action: 'send_failed', note: message },
        ],
      });
    }
  },

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
              // Look up session from stored sessions
              const sess = session ?? state.sessions.find((s) => s.title === id);
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

  toggleCrmPanel: () =>
    set((state) => ({
      crmPanelOpen: !state.crmPanelOpen,
    })),

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
      hermes:    { name: 'Hermes',     role: 'commercial', browserEnabled: false, accentColor: '#E8A83C' },
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

    // ---- Derive delegation events from sessions (honest — no invented data) ----
    const THREE_HRS = 3 * 60 * 60 * 1000;
    const derivedEvents: DelegationEvent[] = [];

    for (const session of sessions.slice(0, 30)) {
      if (!session.lastMessageAt) continue;
      const ageMs = now - new Date(session.lastMessageAt).getTime();
      if (ageMs > THREE_HRS) continue;

      const childTag = session.tags.find((t: string) => t.startsWith('delegated:'));
      const childCount = childTag ? parseInt(childTag.split(':')[1]) : 0;

      if (childCount > 0) {
        derivedEvents.push({
          id: `evt-delegated-${session.shortId}`,
          threadId: session.id,
          type: 'delegated',
          actor: 'nero',
          title: `Nero delegated to specialist (${childCount} sub-session${childCount > 1 ? 's' : ''})`,
          createdAt: session.lastMessageAt,
        });
      }

      if (session.status === 'active' && ageMs < FIVE_MINS) {
        derivedEvents.push({
          id: `evt-active-${session.shortId}`,
          threadId: session.id,
          type: 'agent_active',
          actor: 'nero',
          title: 'Active specialist session',
          createdAt: session.lastMessageAt,
        });
      }
    }

    // Sort events newest first
    derivedEvents.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // ---- Update store ----
    set((state) => ({
      threads: (() => {
        // Always backfill session metadata into existing threads.
        // Adapted thread IDs are title-derived (e.g. "ariadne-canvas-refine"),
        // while actual session IDs are full keys (e.g. "agent:main:subagent:...").
        // Match by title so all threads (adapted + dynamically created) get session metadata.
        const newSessions = result.data;
        return (adaptedThreads.length > 0 ? adaptedThreads : state.threads).map((t) => {
          const sess = newSessions.find((s) => s.title === t.title);
          return sess ? { ...t, session: sess } : t;
        });
      })(),
      sessions: result.data,  // store raw sessions for thread creation on select
      sessionsLoading: false,
      sessionsFetchedAt: result.fetchedAt,
      sessionsError: null,
      // Derive honest agent statuses from real sessions
      agents: derivedAgents,
      // Populate delegation timeline from real session data
      delegationEvents: derivedEvents.length > 0 ? derivedEvents : state.delegationEvents,
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
