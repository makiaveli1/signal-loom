'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCard } from './message-card';
import type { Message, Thread } from '@/lib/types';
import type { ConversationGroup } from '@/lib/conversation-groups';
import { PretextSmartTitle } from '@/components/ui/pretext-smart-title';
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

function isPlaceholderNeroMessage(content: string): boolean {
  const compact = content.replace(/[\s\u200b\u200c\u200d]+/g, '');
  return compact === '' || /^[.…\.]+$/.test(compact);
}

export function MessageList({ thread, messages: messagesOverride, conversationBundle }: MessageListProps) {
  // Sprint 10.7: Use loaded transcript messages if provided (from sessionMessages store),
  // otherwise fall back to thread.messages (which is empty for session-derived threads).
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
  const messages = rawMessages.filter((message, index) => {
    const isLastRawMessage = index === rawMessages.length - 1;
    const isLiveStreamingPlaceholder =
      isStreaming &&
      isLastRawMessage &&
      (message.role === 'nero' || (message.role as string) === 'assistant') &&
      streamingContent != null &&
      message.content === streamingContent;

    if ((message.role === 'nero' || (message.role as string) === 'assistant') && isPlaceholderNeroMessage(message.content) && !isLiveStreamingPlaceholder) {
      return false;
    }
    return true;
  });

  const scrollToBottom = useCallback((force = false) => {
    if (!bottomRef.current || !scrollRef.current) return;
    if (force || isAtBottom) {
      isAutoScrolling.current = true;
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
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

  // Count new messages when user is scrolled away
  useEffect(() => {
    const prevCount = prevMessageCountRef.current;
    if (messages.length > prevCount && !isAtBottom) {
      setNewMessageCount((n) => n + (messages.length - prevCount));
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length, isAtBottom]);

  // Scroll to highlighted message
  useEffect(() => {
    if (highlightedMessageId) {
      const el = messageRefs.current.get(highlightedMessageId);
      if (el) {
        isAutoScrolling.current = true;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
    lastMsg?.role === 'nero' &&
    streamingContent != null &&
    lastMsg.content === streamingContent;

  return (
    <div className="flex flex-col flex-1 min-h-0 relative">
      <ScrollArea
        ref={scrollRef}
        className="flex-1 px-5 py-6 transcript-scroll"
        onScroll={handleScroll}
      >
        <div className="space-y-4">
          {conversationBundle && conversationBundle.threads.length > 1 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="mx-auto flex max-w-3xl items-center gap-3 rounded-2xl border border-brass/20 bg-[linear-gradient(135deg,rgba(201,160,58,0.10),rgba(255,255,255,0.025))] px-4 py-3 shadow-xl shadow-black/15"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brass/25 bg-brass/10 text-sm text-brass">
                {conversationBundle.reason === 'delegated' ? '↱' : '∿'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-brass">
                  Continuous chat
                  <span className="rounded-full border border-white/10 px-1.5 py-0.5 font-mono tracking-normal text-ivory-dim">
                    {conversationBundle.threads.length} sessions joined
                  </span>
                </div>
                <PretextSmartTitle
                  text={`${conversationBundle.topic ?? thread.title} · related messages are shown together in timestamp order`}
                  maxWidth={520}
                  maxLines={2}
                  className="mt-1 text-xs text-ivory-dim"
                />
              </div>
            </motion.div>
          )}
          {messages.length === 0 && (
            <div className="empty-thread-card mx-auto max-w-lg rounded-3xl border border-white/10 bg-white/[0.025] px-6 py-6 text-center shadow-2xl shadow-black/20">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-brass/25 bg-brass/10 text-brass">
                N
              </div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-ivory">Ready when you are</h2>
              <p className="mt-2 text-sm leading-6 text-ivory-dim">
                Ask Nero for the decision, summary, or next move. Tool noise and routing details will stay folded unless you open them.
              </p>
            </div>
          )}
          {messages.map((message, idx) => {
            const isLast = idx === messages.length - 1;
            const previousMessage = messages[idx - 1];
            const showSourceDivider = !!message.sourceThreadId && message.sourceThreadId !== previousMessage?.sourceThreadId;
            return (
              <div
                key={message.id}
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
                  isNew={false}
                  isChildSession={!!childToParentMap[message.sourceThreadId ?? thread.id]}
                />
              </div>
            );
          })}
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
            className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full text-xs font-mono cursor-pointer hover:scale-105 active:scale-95 shadow-lg"
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
    <div className="message-source-divider mx-auto mb-3 flex max-w-3xl items-center gap-3 px-1" style={{ color: accent }}>
      <div className="h-px flex-1 bg-current opacity-15" />
      <div className="message-source-chip min-w-0 rounded-full border px-3 py-1.5 text-[10px] shadow-lg shadow-black/10" style={{ borderColor: 'color-mix(in srgb, currentColor 28%, transparent)' }}>
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
