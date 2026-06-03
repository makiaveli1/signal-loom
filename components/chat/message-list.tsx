'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCard } from './message-card';
import type { Message, Thread } from '@/lib/types';
import type { ConversationGroup } from '@/lib/conversation-groups';
import { PretextSmartTitle } from '@/components/ui/pretext-smart-title';
import { agentIdentityFromDetection } from '@/lib/agent-identity';
import { useHermesDetection } from '@/lib/use-hermes-detection';
import { useSignalLoomStore } from '@/lib/store';

// Sprint 10.7: messages prop lets ThreadPane pass loaded transcript directly
// (thread.messages is empty for session-derived threads — messages live in sessionMessages store)
interface MessageListProps {
  thread: Thread;
  messages?: LoomMessage[];
  conversationBundle?: ConversationGroup | null;
}

type LoomMessage = Message & {
  sourceThreadId?: string;
  sourceThreadTitle?: string;
  sourceThreadStatus?: Thread['status'];
  sourceThreadKind?: 'primary' | 'delegated' | 'related';
  sourceSessionShortId?: string;
};

const BOTTOM_THRESHOLD = 150;

function isPlaceholderAssistantMessage(content: string): boolean {
  const compact = content.replace(/[\s\u200b\u200c\u200d]+/g, '');
  return compact === '' || /^[.…\.]+$/.test(compact);
}

export function MessageList({ thread, messages: messagesOverride, conversationBundle }: MessageListProps) {
  // Sprint 10.7: Use loaded transcript messages if provided (from sessionMessages store),
  // otherwise fall back to thread.messages (which is empty for session-derived threads).
  const { detection } = useHermesDetection({ pollMs: 60_000 });
  const agentIdentity = agentIdentityFromDetection(detection?.identity);
  const rawMessages: LoomMessage[] = messagesOverride ?? thread.messages;
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const isAutoScrolling = useRef(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [newMessageCount, setNewMessageCount] = useState(0);

  const { highlightedMessageId, composerState, childToParentMap } = useSignalLoomStore();
  const isStreaming = composerState.isStreaming;
  const streamingContent = composerState.streamingResponse;
  const showPendingBubble = composerState.isSending && !isStreaming;
  const messages = rawMessages.filter((message, index) => {
    const isLastRawMessage = index === rawMessages.length - 1;
    const isLiveStreamingPlaceholder =
      isStreaming &&
      isLastRawMessage &&
      (message.role === 'nero' || (message.role as string) === 'assistant') &&
      streamingContent != null &&
      message.content === streamingContent;

    if ((message.role === 'nero' || (message.role as string) === 'assistant') && isPlaceholderAssistantMessage(message.content) && !isLiveStreamingPlaceholder) {
      return false;
    }
    return true;
  });

  const scrollToBottom = useCallback((force = false) => {
    if (!bottomRef.current || !scrollRef.current) return;
    if (force || isAtBottom) {
      isAutoScrolling.current = true;
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      bottomRef.current.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
      setTimeout(() => { isAutoScrolling.current = false; }, 300);
    }
  }, [isAtBottom]);

  function checkNearBottom(el: HTMLDivElement): boolean {
    const { scrollTop, scrollHeight, clientHeight } = el;
    return scrollHeight - scrollTop - clientHeight < BOTTOM_THRESHOLD;
  }

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || isAutoScrolling.current) return;
    const atBottom = checkNearBottom(el);
    setIsAtBottom(atBottom);
    if (atBottom) setNewMessageCount(0);
  }, []);

  const wasAwayRef = useRef(false);
  useEffect(() => {
    if (isAtBottom && wasAwayRef.current) {
      scrollToBottom(true);
      wasAwayRef.current = false;
    } else if (!isAtBottom) {
      wasAwayRef.current = true;
    }
  }, [isAtBottom, scrollToBottom]);

  const prevMessageCountRef = useRef(messages.length);
  const seenMessageIdsRef = useRef<Set<string>>(new Set(messages.map((message) => message.id)));
  const [newArrivalIds, setNewArrivalIds] = useState<Set<string>>(new Set());

  // Count and mark new messages when user is scrolled away / live updates arrive.
  useEffect(() => {
    const prevCount = prevMessageCountRef.current;
    const seen = seenMessageIdsRef.current;
    const arrivals = messages.filter((message) => !seen.has(message.id)).map((message) => message.id);
    if (arrivals.length > 0) {
      setNewArrivalIds(new Set(arrivals));
      const clearTimer = setTimeout(() => setNewArrivalIds(new Set()), 900);
      for (const id of arrivals) seen.add(id);
      if (!isAtBottom) setNewMessageCount((n) => n + Math.max(messages.length - prevCount, arrivals.length));
      prevMessageCountRef.current = messages.length;
      return () => clearTimeout(clearTimer);
    }
    prevMessageCountRef.current = messages.length;
  }, [messages, isAtBottom]);

  // Scroll to highlighted message
  useEffect(() => {
    if (highlightedMessageId) {
      const el = messageRefs.current.get(highlightedMessageId);
      if (el) {
        isAutoScrolling.current = true;
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        el.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'center' });
        const timer = setTimeout(() => {
          isAutoScrolling.current = false;
          useSignalLoomStore.getState().highlightMessage(null);
        }, 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [highlightedMessageId]);

  const lastMsg = messages[messages.length - 1];
  const isLastMsgStreaming =
    isStreaming &&
    ((lastMsg?.role === 'nero' || (lastMsg?.role as string | undefined) === 'assistant')) &&
    streamingContent != null &&
    lastMsg.content === streamingContent;

  return (
    <div className="flex flex-col flex-1 min-h-0 relative">
      <ScrollArea
        ref={scrollRef}
        className="signal-chat-canvas flex-1 px-5 py-6 transcript-scroll"
        onScroll={handleScroll}
      >
        <div className="transcript-stack space-y-4">
          {conversationBundle && conversationBundle.threads.length > 1 && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="mx-auto flex max-w-3xl items-center gap-2 rounded-[var(--sl-radius-control)] border px-3 py-1.5 text-[11px] text-ash"
              style={{ background: 'var(--sl-surface-flat)', borderColor: 'var(--sl-rule-hairline)', boxShadow: 'none' }}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--sl-radius-control)] border border-brass/18 bg-brass/5 text-[10px] text-brass" aria-hidden="true">
                {conversationBundle.reason === 'delegated' ? '↱' : '∿'}
              </span>
              <span className="font-mono uppercase tracking-[0.18em] text-brass/80">Continuous chat</span>
              <span className="text-ash-muted">·</span>
              <span>{conversationBundle.threads.length} sessions joined</span>
              <PretextSmartTitle
                text={conversationBundle.topic ?? thread.title}
                maxWidth={360}
                maxLines={1}
                className="hidden min-w-0 flex-1 text-ash-muted md:block"
              />
            </motion.div>
          )}
          {messages.length === 0 && (
            <div
              className="empty-thread-card mx-auto max-w-lg rounded-[var(--sl-radius-card)] border px-6 py-6 text-center"
              style={{ background: 'var(--sl-surface-flat)', borderColor: 'var(--sl-rule-hairline)', boxShadow: 'none' }}
            >
              <div className="flat-rest-orbit" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-[var(--sl-radius-control)] border border-brass/25 bg-brass/10 text-brass">
                {agentIdentity.initials}
              </div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-ivory">Ready when you are</h2>
              <p className="mt-2 text-sm leading-6 text-ivory-dim">
                Ask {agentIdentity.name} for the decision, summary, or next move. Tool noise and routing details will stay folded unless you open them.
              </p>
            </div>
          )}
          {messages.map((message, idx) => {
            const isLast = idx === messages.length - 1;
            const previousMessage = messages[idx - 1];
            const showSourceDivider = !!message.sourceThreadId && message.sourceThreadId !== previousMessage?.sourceThreadId;
            const renderKey = `${message.sourceThreadId ?? thread.id}:${message.id}:${idx}`;
            return (
              <div
                key={renderKey}
                ref={(el) => {
                  if (el) messageRefs.current.set(message.id, el);
                  else messageRefs.current.delete(message.id);
                }}
              >
                {showSourceDivider && (
                  <SourceDivider message={message} />
                )}
                <MessageCard
                  message={message}
                  isHighlighted={message.id === highlightedMessageId}
                  isStreaming={isLast && isLastMsgStreaming}
                  streamingStatus={isLast && isLastMsgStreaming ? composerState.streamingStatus : undefined}
                  streamingTokenCount={isLast && isLastMsgStreaming ? composerState.streamingTokenCount : undefined}
                  streamingCharsPerSecond={isLast && isLastMsgStreaming ? composerState.streamingCharsPerSecond : undefined}
                  streamingLastChunkAt={isLast && isLastMsgStreaming ? composerState.streamingLastChunkAt : undefined}
                  isNew={newArrivalIds.has(message.id)}
                  isChildSession={!!childToParentMap[message.sourceThreadId ?? thread.id]}
                />
              </div>
            );
          })}
          {showPendingBubble && (
            <MessageCard
              message={{
                id: `pending-${thread.id}`,
                role: 'nero',
                content: '',
                timestamp: composerState.streamingStartedAt ?? thread.lastActive,
              }}
              isStreaming
              streamingStatus={composerState.streamingStatus === 'idle' ? 'connecting' : composerState.streamingStatus}
              streamingTokenCount={composerState.streamingTokenCount}
              streamingCharsPerSecond={composerState.streamingCharsPerSecond}
              streamingLastChunkAt={composerState.streamingLastChunkAt}
              isNew
            />
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <AnimatePresence>
        {newMessageCount > 0 && (
          <motion.button
            key="jump-pill"
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30, mass: 0.6 }}
            onClick={() => { scrollToBottom(true); setNewMessageCount(0); }}
            className="absolute bottom-4 left-1/2 flex -translate-x-1/2 cursor-pointer items-center gap-2 rounded-[var(--sl-radius-control)] px-4 py-2 text-xs font-mono shadow-lg hover:scale-105 active:scale-95"
            style={{
              background: 'var(--mb-teal)',
              color: 'var(--mb-carbon)',
              border: '1px solid rgba(0,0,0,0.15)',
              zIndex: 10,
            }}
            aria-label={`Jump to ${newMessageCount} new message${newMessageCount !== 1 ? 's' : ''}`}
          >
            <motion.span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              style={{ background: 'var(--mb-carbon)' }}
            />
            ↓ {newMessageCount} new message{newMessageCount !== 1 ? 's' : ''} — jump to latest
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function SourceDivider({ message }: { message: LoomMessage }) {
  const label = message.sourceThreadKind === 'delegated'
    ? 'Delegated lane'
    : message.sourceThreadKind === 'related'
      ? 'Related session'
      : 'Primary thread';
  const accent = message.sourceThreadKind === 'delegated'
    ? 'var(--mb-violet)'
    : message.sourceThreadKind === 'related'
      ? 'var(--mb-brass)'
      : 'var(--mb-teal)';

  return (
    <div className="message-source-divider signal-route-draw mx-auto mb-3 flex max-w-3xl items-center gap-3 px-1" style={{ color: accent }}>
      <div className="h-px flex-1 bg-current opacity-15" />
      <div
        className="message-source-chip min-w-0 rounded-[var(--sl-radius-control)] border px-3 py-1.5 text-[10px]"
        style={{
          borderColor: 'color-mix(in srgb, currentColor 28%, transparent)',
          background: 'var(--sl-surface-flat)',
          boxShadow: 'none',
        }}
      >
        <span className="mr-2 font-semibold uppercase tracking-[0.2em]">{label}</span>
        <PretextSmartTitle
          text={`${message.sourceThreadTitle ?? 'Untitled Hermes session'}${message.sourceSessionShortId ? ` · ${message.sourceSessionShortId}` : ''}`}
          maxWidth={260}
          maxLines={1}
          className="inline-block max-w-[16rem] align-bottom normal-case tracking-normal text-ivory-dim"
        />
      </div>
      <div className="h-px flex-1 bg-current opacity-15" />
    </div>
  );
}
