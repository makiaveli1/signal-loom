'use client';

import { useEffect } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { TopBar } from './top-bar';
import { RuntimeStrip } from './runtime-strip';
import { ThreadDock } from '../threads/thread-dock';
import { NeroWorkspace } from '../chat/nero-workspace';
import { LiveAgentRail } from '../agents/live-agent-rail';
import { ApprovalsPanel } from '../approvals/approvals-panel';
import { HermesEmailComposer } from '../agents/hermes-email-composer';
import { useSignalLoomStore } from '@/lib/store';
import { approveEmailGate, denyEmailGate, reviseEmailGate } from '@/lib/openclaw/adapter/email-gate';
import type { EmailGate } from '@/lib/openclaw/adapter/types';

export function MissionShell() {
  const {
    approvalsPanelOpen,
    emailComposerOpen,
    emailGates,
    updateEmailGate,
    loadSessions,
    loadAgents,
    loadApprovals,
    loadRuntimeHealth,
    initEmailGates,
  } = useSignalLoomStore();

  // Sprint 3: Load real data from the OpenClaw adapter on mount.
  // The adapter handles mock fallback when NEXT_PUBLIC_USE_MOCK_DATA=true.
  useEffect(() => {
    loadSessions();
    loadAgents();
    loadApprovals();
    loadRuntimeHealth();
    // Sprint 3 DE: Initialize mock email gates (replace with real gateway data)
    initEmailGates();
    // Refresh health every 30 seconds
    const interval = setInterval(loadRuntimeHealth, 30_000);
    return () => clearInterval(interval);
  }, [loadSessions, loadAgents, loadApprovals, loadRuntimeHealth]);

  return (
    <TooltipProvider>
      <div
        className="flex flex-col h-screen overflow-hidden"
        style={{ background: 'var(--mb-carbon)' }}
      >
        {/* Shell header — explicit height, never participates in content flex */}
        <div className="flex-shrink-0">
          <TopBar />
        </div>

        {/* Main content area */}
        <div className="flex flex-1 min-h-0">
          {/* Thread dock — left */}
          <ThreadDock />

          {/* Nero workspace — center */}
          <NeroWorkspace />

          {/* Live agent rail — right */}
          <LiveAgentRail />

          {/* Approvals panel — slides in from right */}
          <ApprovalsPanel />

          {/* Hermès email composer — slides in from right when Hermès is clicked */}
          {emailComposerOpen && (
            <div
              className="flex flex-col h-full border-l"
              style={{
                background: 'var(--mb-shell)',
                borderColor: 'rgba(255,255,255,0.05)',
                width: '380px',
                minWidth: '380px',
              }}
            >
              {/* Composer header */}
              <div
                className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
                style={{ borderColor: 'rgba(255,255,255,0.05)' }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-ivory">Hermès</span>
                  <span className="text-xs text-ash-muted">Email Review</span>
                </div>
              </div>
              {/* Composer body */}
              <div className="flex-1 min-h-0">
                <HermesEmailComposer
                  gates={emailGates}
                  onApproved={(gate: EmailGate) => {
                    const updated = approveEmailGate(gate);
                    updateEmailGate(updated);
                  }}
                  onDenied={(gate: EmailGate) => {
                    const updated = denyEmailGate(gate);
                    updateEmailGate(updated);
                  }}
                  onRevised={(gate: EmailGate, revised) => {
                    const updated = reviseEmailGate(gate, revised);
                    updateEmailGate(updated);
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Runtime health strip — explicit height, never participates in content flex */}
        <div className="flex-shrink-0">
          <RuntimeStrip />
        </div>
      </div>
    </TooltipProvider>
  );
}
