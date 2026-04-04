/**
 * useLiveEvents — subscribes to gateway real-time events via SSE.
 *
 * Bridges /api/openclaw/live (SSE) → gateway WebSocket → store updates.
 * When a session.message event arrives (new message from any channel),
 * reloads the thread's messages so the UI updates live.
 */

'use client';

import { useEffect, useRef } from 'react';
import { useSignalLoomStore } from '@/lib/store';

interface GatewaySessionMessageEvent {
  type: 'session.message';
  data: {
    sessionKey: string;
    messageId: string;
    role: string;
    content?: string;
    timestamp: string;
  };
}

interface GatewaySessionsChangedEvent {
  type: 'sessions.changed';
  data: {
    action: 'created' | 'updated' | 'deleted';
    sessionKey: string;
  };
}

export function useLiveEvents() {
  const { loadMessagesForThread, loadSessions, threads, setLiveConnected } = useSignalLoomStore();
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
        if (mounted) setLiveConnected(true);
      }, { once: true });

      es.addEventListener('gateway', (e) => {
        try {
          const msg = JSON.parse(e.data) as
            | GatewaySessionMessageEvent
            | GatewaySessionsChangedEvent;

          if (msg.type === 'session.message') {
            // New message arrived in a session — reload messages for that session
            const { sessionKey } = msg.data;

            // Find the thread that owns this session
            const thread = threads.find((t) => t.id === sessionKey);
            if (thread) {
              loadMessagesForThread(sessionKey);
            }

            // Also reload sessions list to pick up any new sessions
            loadSessions();
          } else if (msg.type === 'sessions.changed') {
            // Session list changed — refresh
            loadSessions();
          }
        } catch {
          // Ignore parse errors
        }
      });

      es.onerror = () => {
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
