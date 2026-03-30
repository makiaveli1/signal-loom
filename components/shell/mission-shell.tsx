'use client';

import { TooltipProvider } from '@/components/ui/tooltip';
import { TopBar } from './top-bar';
import { RuntimeStrip } from './runtime-strip';
import { ThreadDock } from '../threads/thread-dock';
import { NeroWorkspace } from '../chat/nero-workspace';
import { LiveAgentRail } from '../agents/live-agent-rail';
import { ApprovalsPanel } from '../approvals/approvals-panel';
import { useSignalLoomStore } from '@/lib/store';

export function MissionShell() {
  const { approvalsPanelOpen } = useSignalLoomStore();

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
        </div>

        {/* Runtime health strip — explicit height, never participates in content flex */}
        <div className="flex-shrink-0">
          <RuntimeStrip />
        </div>
      </div>
    </TooltipProvider>
  );
}
