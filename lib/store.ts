'use client';

import { create } from 'zustand';
import type { Thread, Approval, RuntimeState, Agent } from '@/lib/types';
import { mockThreads, mockApprovals, mockRuntime, mockAgents } from '@/lib/mock/data';

interface SignalLoomStore {
  threads: Thread[];
  selectedThreadId: string;
  agents: Agent[];
  approvals: Approval[];
  runtime: RuntimeState;
  approvalsPanelOpen: boolean;

  selectThread: (id: string) => void;
  markThreadRead: (id: string) => void;
  toggleApprovalsPanel: () => void;
}

export const useSignalLoomStore = create<SignalLoomStore>((set) => ({
  threads: mockThreads,
  selectedThreadId: 'thread-1',
  agents: mockAgents,
  approvals: mockApprovals,
  runtime: mockRuntime,
  approvalsPanelOpen: false,

  selectThread: (id) => set((state) => ({
    selectedThreadId: id,
    threads: state.threads.map((t) =>
      t.id === id ? { ...t, unreadCount: 0 } : t
    ),
  })),

  markThreadRead: (id) => set((state) => ({
    threads: state.threads.map((t) =>
      t.id === id ? { ...t, unreadCount: 0 } : t
    ),
  })),

  toggleApprovalsPanel: () => set((state) => ({
    approvalsPanelOpen: !state.approvalsPanelOpen,
  })),
}));
