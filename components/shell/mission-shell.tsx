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
    sendEmail,
    loadSessions,
    loadAgents,
    loadApprovals,
    loadRuntimeHealth,
    initEmailGates,
  } = useSignalLoomStore();

  // Load real data on mount.
  // Sessions are loaded via /api/openclaw/sessions (Next.js API route) — not via
  // the adapter's gatewayFetch which fails from browser (relative URL → Next.js → 404).
  useEffect(() => {
    initEmailGates();
    loadSessions();
    loadAgents();
    loadApprovals();
    loadRuntimeHealth();

    const interval = setInterval(loadRuntimeHealth, 30_000);
    return () => clearInterval(interval);
  }, [loadSessions, loadAgents, loadApprovals, loadRuntimeHealth, initEmailGates]);

  return (
    <TooltipProvider>
      <div
        className="flex flex-col h-screen overflow-hidden"
        style={{ background: 'var(--mb-carbon)' }}
      >
        {/* Shell header */}
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
                  onSend={(gate: EmailGate) => {
                    sendEmail(gate.id);
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Runtime health strip */}
        <div className="flex-shrink-0">
          <RuntimeStrip />
        </div>
      </div>
    </TooltipProvider>
  );
}
