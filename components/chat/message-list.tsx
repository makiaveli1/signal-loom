'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCard } from './message-card';
import type { Thread } from '@/lib/types';
import { useSignalLoomStore } from '@/lib/store';

interface MessageListProps {
  thread: Thread;
}

const BOTTOM_THRESHOLD = 150;

export function MessageList({ thread }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const isAutoScrolling = useRef(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [newMessageCount, setNewMessageCount] = useState(0);

  // Sprint 10.6: Track seen message IDs — only animate genuinely new arrivals,
  // never replay on full-array replacements (e.g. from SSE background reloads).
  const seenMessageIdsRef = useRef<Set<string>>(new Set(thread.messages.map((m) => m.id)));
  const prevMessageIdsRef = useRef<Set<string>>(new Set(thread.messages.map((m) => m.id)));

  // Compute genuinely new IDs on every render (before updating seenMessageIdsRef)
  const newMessageIds = useMemo(() => {
    const prev = prevMessageIdsRef.current;
    return new Set(thread.messages.map((m) => m.id).filter((id) => !prev.has(id)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.messages]);

  // After render: update seen IDs so animations don't replay on next render
  useEffect(() => {
    const added = new Set(thread.messages.map((m) => m.id));
    // Add new IDs to the seen set
    newMessageIds.forEach((id) => seenMessageIdsRef.current.add(id));
    // Sync prev IDs for next render
    prevMessageIdsRef.current = added;
  }, [thread.messages, newMessageIds]);

  const { highlightedMessageId, composerState, childToParentMap } = useSignalLoomStore();
  const isStreaming = composerState.isStreaming;
  const streamingContent = composerState.streamingResponse;

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

  // Count new messages when user is scrolled away
  useEffect(() => {
    const prevLen = seenMessageIdsRef.current.size - newMessageIds.size + thread.messages.length;
    // seenMessageIdsRef.size includes messages we've seen in ALL renders
    // We need the previous render's count — use prevMessageIdsRef.size
    const prevCount = prevMessageIdsRef.current.size;
    if (thread.messages.length > prevCount) {
      if (!isAtBottom) {
        setNewMessageCount((n) => n + (thread.messages.length - prevCount));
      }
    }
  }, [thread.messages.length, isAtBottom, newMessageIds]);

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

  const lastMsg = thread.messages[thread.messages.length - 1];
  const isLastMsgStreaming =
    isStreaming &&
    lastMsg?.role === 'nero' &&
    streamingContent != null &&
    lastMsg.content === streamingContent;

  return (
    <div className="flex flex-col flex-1 min-h-0 relative">
      <ScrollArea
        ref={scrollRef}
        className="flex-1 px-4 py-4 transcript-scroll"
        onScroll={handleScroll}
      >
        <div className="space-y-1">
          {thread.messages.map((message, idx) => {
            const isLast = idx === thread.messages.length - 1;
            // Sprint 10.6: Only animate messages that are genuinely new arrivals.
            // seenMessageIdsRef prevents replaying animations on full-array replacements.
            const isNew = newMessageIds.has(message.id) && !seenMessageIdsRef.current.has(message.id);

            return (
              <div
                key={message.id}
                ref={(el) => {
                  if (el) messageRefs.current.set(message.id, el);
                  else messageRefs.current.delete(message.id);
                }}
              >
                <MessageCard
                  message={message}
                  isHighlighted={message.id === highlightedMessageId}
                  isStreaming={isLast && isLastMsgStreaming}
                  isNew={isNew}
                  isChildSession={!!childToParentMap[thread.id]}
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
