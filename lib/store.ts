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
} from '@/lib/types';
import { mockThreads, mockApprovals, mockRuntime, mockAgents } from '@/lib/mock/data';
import { mockDelegationEvents } from '@/lib/mock/delegation-data';

interface SignalLoomStore {
  threads: Thread[];
  selectedThreadId: string;
  agents: Agent[];
  approvals: Approval[];
  runtime: RuntimeState;
  approvalsPanelOpen: boolean;

  // Sprint 2: Split View
  splitView: SplitViewState;
  composerState: ComposerState;
  delegationEvents: DelegationEvent[];

  // Sprint 2: Message highlighting
  highlightedMessageId: string | null;

  // Actions
  selectThread: (id: string) => void;
  markThreadRead: (id: string) => void;
  toggleApprovalsPanel: () => void;

  // Sprint 2: Split View actions
  setSplitView: (enabled: boolean, secondaryThreadId?: string) => void;
  setActivePane: (pane: PaneSide) => void;
  closeSplit: () => void;

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

  // Sprint 2
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

  selectThread: (id) =>
    set((state) => {
      // Clear highlight when switching threads
      if (state.splitView.enabled) {
        const targetPane =
          state.splitView.primaryThreadId === id
            ? 'left'
            : state.splitView.secondaryThreadId === id
            ? 'right'
            : state.splitView.activePane;

        if (targetPane === 'left') {
          return {
            selectedThreadId: id,
            highlightedMessageId: null,
            splitView: { ...state.splitView, primaryThreadId: id },
            threads: state.threads.map((t) =>
              t.id === id ? { ...t, unreadCount: 0 } : t
            ),
          };
        } else if (targetPane === 'right') {
          return {
            selectedThreadId: id,
            highlightedMessageId: null,
            splitView: { ...state.splitView, secondaryThreadId: id },
            threads: state.threads.map((t) =>
              t.id === id ? { ...t, unreadCount: 0 } : t
            ),
          };
        } else {
          // Selecting a new thread while split active → open in inactive pane
          const newSecondary =
            state.splitView.activePane === 'left' ? id : state.splitView.primaryThreadId;
          const newPrimary =
            state.splitView.activePane === 'left' ? state.splitView.primaryThreadId : id;
          return {
            selectedThreadId: id,
            highlightedMessageId: null,
            splitView: {
              ...state.splitView,
              enabled: true,
              primaryThreadId: newPrimary,
              secondaryThreadId: newSecondary,
              activePane: state.splitView.activePane === 'left' ? 'right' : 'left',
            },
            threads: state.threads.map((t) =>
              t.id === id ? { ...t, unreadCount: 0 } : t
            ),
          };
        }
      }

      return {
        selectedThreadId: id,
        highlightedMessageId: null,
        threads: state.threads.map((t) =>
          t.id === id ? { ...t, unreadCount: 0 } : t
        ),
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

  // Sprint 2: Split View
  setSplitView: (enabled, secondaryThreadId) =>
    set((state) => ({
      splitView: {
        enabled,
        primaryThreadId: state.selectedThreadId,
        secondaryThreadId: secondaryThreadId ?? null,
        activePane: 'left',
      },
      highlightedMessageId: null,
    })),

  setActivePane: (pane) =>
    set((state) => ({
      splitView: { ...state.splitView, activePane: pane },
      selectedThreadId:
        pane === 'left'
          ? state.splitView.primaryThreadId
          : state.splitView.secondaryThreadId ?? state.splitView.primaryThreadId,
      highlightedMessageId: null,
    })),

  closeSplit: () =>
    set((state) => ({
      splitView: {
        enabled: false,
        primaryThreadId: state.splitView.primaryThreadId,
        secondaryThreadId: null,
        activePane: 'left',
      },
      highlightedMessageId: null,
    })),

  // Sprint 2: Composer
  sendMessage: async (threadId, content) => {
    set((state) => ({
      composerState: { ...state.composerState, isSending: true, error: null },
    }));

    // Simulate network latency (600ms)
    await new Promise((resolve) => setTimeout(resolve, 600));

    // 10% mock error rate
    const shouldError = Math.random() < 0.1;

    if (shouldError) {
      set((state) => ({
        composerState: {
          ...state.composerState,
          isSending: false,
          error: 'Failed to send. Try again.',
        },
      }));
      // Auto-clear error after 3s
      setTimeout(() => {
        get().clearComposerError();
      }, 3000);
      return;
    }

    const newMessage = {
      id: `msg-${threadId}-${Date.now()}`,
      role: 'user' as const,
      content,
      timestamp: new Date().toISOString(),
    };

    set((state) => ({
      threads: state.threads.map((t) =>
        t.id === threadId
          ? { ...t, messages: [...t.messages, newMessage], lastActive: new Date().toISOString() }
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
