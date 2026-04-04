/**
 * useLiveEvents — subscribes to gateway real-time events via SSE.
 *
 * Bridges /api/openclaw/live (SSE) → gateway WebSocket → store updates.
 * When a session.message event arrives (new message from any channel),
 * reloads the thread's messages so the UI updates live.
 *
 * Also handles sessions.changed to refresh the agent roster and thread list.
 */

'use client';

import { useEffect, useRef } from 'react';
import { useSignalLoomStore } from '@/lib/store';

export function useLiveEvents() {
  const { loadMessagesForThread, loadSessions, setLiveConnected } = useSignalLoomStore();
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
        // Refresh session/agent state on reconnect so roster is always current
        loadSessions();
      }, { once: true });

      // Handle all gateway event types
      es.addEventListener('gateway', (e) => {
        if (!mounted) return;
        try {
          const msg = JSON.parse(e.data as string) as { type: string; data?: unknown };

          if (msg.type === 'session.message') {
            // New message arrived — reload messages for that session
            const data = msg.data as { sessionKey?: string };
            if (data?.sessionKey) {
              const { threads } = useSignalLoomStore.getState();
              const thread = threads.find((t) => t.id === data.sessionKey);
              if (thread) {
                loadMessagesForThread(data.sessionKey);
              }
            }
            // Also refresh sessions list to pick up new sessions / updated agent statuses
            loadSessions();

          } else if (msg.type === 'sessions.changed') {
            // Session list changed — full refresh for agent roster + thread list
            loadSessions();

          } else if (msg.type === 'session.tool') {
            // Tool event — refresh session state
            loadSessions();

          } else {
            // Unknown event type — still refresh sessions as a catch-all
            // This ensures agent roster updates for any gateway event we don't handle explicitly
            loadSessions();
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
        // Reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          if (mounted) connect();
        }, 3000);
      };

      return () => {
        if (esRef.current) {
          esRef.current.close();
          esRef.current = null;
        }
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };
    }

    connect();

    return () => {
      mounted = false;
      setLiveConnected(false);
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount; no dynamic deps needed
}
