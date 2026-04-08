/**
 * useLiveEvents — subscribes to gateway real-time events via SSE.
 *
 * Bridges /api/openclaw/live (SSE) → gateway WebSocket → store updates.
 * Uses silentReloadSessions for all live event refreshes so the thread list
 * never flickers or shows a loading spinner during background updates.
 */

'use client';

import { useEffect, useRef } from 'react';
import { useSignalLoomStore } from '@/lib/store';

export function useLiveEvents() {
  const { loadMessagesForThread, silentReloadSessions, setLiveConnected } = useSignalLoomStore();
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;

    function connect() {
      if (!mounted) return;

      const es = new EventSource('/api/openclaw/live');
      esRef.current = es;

      // Mark live connection as active when SSE stream opens
      es.addEventListener('connected', () => {
        if (!mounted) return;
        setLiveConnected(true);
        // Silent refresh — threads stay visible, only data updates
        silentReloadSessions();
      }, { once: true });

      // Handle all gateway event types — all trigger silent background refresh
      es.addEventListener('gateway', (e) => {
        if (!mounted) return;
        try {
          const msg = JSON.parse(e.data as string) as { type: string; data?: unknown };

          if (msg.type === 'session.message') {
            const data = msg.data as { sessionKey?: string };
            if (data?.sessionKey) {
              // Sprint 10.6: Only load by session key if the session is attached to a thread.
              // t.id === data.sessionKey would match bare thread IDs (thread-1) before
              // sessions are attached, causing a 500 with thread-1 as the session key.
              const { threads } = useSignalLoomStore.getState();
              const thread = threads.find((t) => t.session?.id === data.sessionKey);
              if (thread) {
                loadMessagesForThread(data.sessionKey); // pass SESSION KEY to API
              }
            }
            silentReloadSessions();

          } else if (msg.type === 'sessions.changed') {
            silentReloadSessions();

          } else if (msg.type === 'session.tool') {
            silentReloadSessions();

          } else {
            // Catch-all for any unhandled gateway event
            silentReloadSessions();
          }
        } catch {
          // Ignore parse errors
        }
      });

      es.onerror = () => {
        if (!mounted) return;
        setLiveConnected(false);
        es.close();
        esRef.current = null;
        reconnectTimeoutRef.current = setTimeout(() => {
          if (mounted) connect();
        }, 3000);
      };

      return () => {
        if (esRef.current) { esRef.current.close(); esRef.current = null; }
        if (reconnectTimeoutRef.current) { clearTimeout(reconnectTimeoutRef.current); reconnectTimeoutRef.current = null; }
      };
    }

    connect();

    return () => {
      mounted = false;
      setLiveConnected(false);
      if (esRef.current) { esRef.current.close(); esRef.current = null; }
      if (reconnectTimeoutRef.current) { clearTimeout(reconnectTimeoutRef.current); reconnectTimeoutRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount
}
