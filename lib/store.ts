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
import { mockThreads, mockApprovals, mockRuntime, mockAgents } from '@/lib/mock/data';
import { mockDelegationEvents } from '@/lib/mock/delegation-data';

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

  // Sprint 2: Legacy split view (kept for migration compatibility)
  splitView: SplitViewState;
  composerState: ComposerState;
  delegationEvents: DelegationEvent[];

  // Sprint 2.5: Pane system
  workspace: WorkspaceState;
  resize: ResizeState;

  // Sprint 2: Message highlighting
  highlightedMessageId: string | null;

  // Actions
  selectThread: (id: string) => void;
  markThreadRead: (id: string) => void;
  toggleApprovalsPanel: () => void;

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

    await new Promise((resolve) => setTimeout(resolve, 600));

    const shouldError = Math.random() < 0.1;

    if (shouldError) {
      set((state) => ({
        composerState: {
          ...state.composerState,
          isSending: false,
          error: 'Failed to send. Try again.',
        },
      }));
      setTimeout(() => { get().clearComposerError(); }, 3000);
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
export type { WorkspaceState, WorkspacePreset, ResizeState, Pane, PaneRole } from '@/lib/types';
