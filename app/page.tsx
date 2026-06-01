'use client';

import { MissionShell } from '@/components/shell/mission-shell';
import { LiveEventsProvider } from '../components/providers/live-events-provider';

export default function HomePage() {
  return (
    <LiveEventsProvider>
      <main id="signal-loom-main" className="h-dvh" aria-label="Signal Loom cockpit">
        <MissionShell />
      </main>
    </LiveEventsProvider>
  );
}
