/**
 * useLiveEvents — subscribes to Hermes runtime change events via SSE.
 *
 * Bridges /api/openclaw/live (SSE) → Hermes state.db delta polling → store
 * updates. The route emits actionable session ids so CLI/TUI/API conversations
 * can refresh the visible transcript without the operator touching the UI.
 */

'use client';

import { useEffect, useRef } from 'react';
import { useSignalLoomStore } from '@/lib/store';

let _lastSessionsReload = 0;
const SESSIONS_RELOAD_COOLDOWN_MS = 1200;
const INITIAL_RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_DELAY_MS = 30000;

function safeReload(reloadSessions: () => Promise<void>) {
  const now = Date.now();
  if (now - _lastSessionsReload < SESSIONS_RELOAD_COOLDOWN_MS) return;
  _lastSessionsReload = now;
  void reloadSessions();
}

function activeSessionKeys(): Set<string> {
  const state = useSignalLoomStore.getState();
  const keys = new Set<string>();
  keys.add(state.selectedThreadId);
  for (const pane of state.workspace.panes) keys.add(pane.threadId);
  for (const sessionId of state.followedSessionIds) keys.add(sessionId);
  for (const thread of state.threads) {
    if (thread.session?.id) keys.add(thread.session.id);
  }
  return keys;
}

function refreshTranscriptIfVisible(sessionKey?: string | null, parentSessionId?: string | null) {
  if (!sessionKey) return;
  const { loadMessagesForThread } = useSignalLoomStore.getState();
  const visible = activeSessionKeys();
  if (visible.has(sessionKey)) void loadMessagesForThread(sessionKey);
  if (parentSessionId && visible.has(parentSessionId)) void loadMessagesForThread(parentSessionId);
}

export function useLiveEvents() {
  const { setLiveConnected, silentReloadSessions, ingestRuntimeEvent } = useSignalLoomStore();
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY_MS);

  useEffect(() => {
    let mounted = true;

    function connect() {
      if (!mounted) return;

      const es = new EventSource('/api/openclaw/live');
      esRef.current = es;

      es.addEventListener('connected', () => {
        if (!mounted) return;
        reconnectDelayRef.current = INITIAL_RECONNECT_DELAY_MS;
        setLiveConnected(true);
        safeReload(silentReloadSessions);
      }, { once: true });

      es.addEventListener('gateway', (e) => {
        if (!mounted) return;
        try {
          const msg = JSON.parse(e.data as string) as {
            type: string;
            data?: {
              source?: string;
              sessionKey?: string;
              parentSessionId?: string | null;
              childSessionId?: string;
              changedSessionIds?: string[];
              messageId?: string | number;
              toolCallId?: string;
              toolName?: string;
              role?: string;
              text?: string;
              status?: string;
              taskPreview?: string;
              argsPreview?: string;
              resultPreview?: string;
              at?: string;
            };
          };

          if (msg.data?.source === 'hermes-runtime-events') {
            ingestRuntimeEvent(msg);
            if (msg.type === 'session.started' || msg.type.startsWith('subagent.')) {
              safeReload(silentReloadSessions);
            }
            return;
          }

          if (msg.type === 'session.message' || msg.type === 'session.tool' || msg.type.startsWith('subagent.')) {
            refreshTranscriptIfVisible(msg.data?.sessionKey ?? msg.data?.childSessionId, msg.data?.parentSessionId ?? null);
            safeReload(silentReloadSessions);
            return;
          }

          if (msg.type === 'sessions.changed') {
            for (const sessionKey of msg.data?.changedSessionIds ?? []) refreshTranscriptIfVisible(sessionKey, null);
            safeReload(silentReloadSessions);
            return;
          }

          safeReload(silentReloadSessions);
        } catch {
          // Ignore malformed frames. The next heartbeat/delta will reconnect the dots.
        }
      });

      es.onerror = () => {
        if (!mounted) return;
        setLiveConnected(false);
        es.close();
        esRef.current = null;
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        const delay = reconnectDelayRef.current;
        reconnectDelayRef.current = Math.min(MAX_RECONNECT_DELAY_MS, Math.round(delay * 1.8));
        reconnectTimeoutRef.current = setTimeout(() => {
          if (mounted) connect();
        }, delay);
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
  }, []);
}
