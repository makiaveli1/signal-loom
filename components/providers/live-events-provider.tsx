'use client';

import { useLiveEvents } from '@/lib/hooks/use-live-events';

/**
 * LiveEventsProvider — mounts the SSE live update connection.
 *
 * Keeps Signal Loom connected to the gateway's real-time event stream
 * whenever the app is open in the browser.
 *
 * This means:
 * - New messages from Telegram/Discord appear live in Signal Loom
 * - Session list updates in real-time
 * - No polling needed for live updates
 */
export function LiveEventsProvider({ children }: { children: React.ReactNode }) {
  // Hook connects to /api/openclaw/live (SSE → gateway WebSocket)
  // and updates the Zustand store when session.message events arrive.
  useLiveEvents();

  return <>{children}</>;
}
