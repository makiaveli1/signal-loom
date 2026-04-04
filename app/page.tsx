import { MissionShell } from '@/components/shell/mission-shell';
import { LiveEventsProvider } from '../components/providers/live-events-provider';

export default function HomePage() {
  return (
    <LiveEventsProvider>
      <MissionShell />
    </LiveEventsProvider>
  );
}
