'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCard } from './message-card';
import type { Thread } from '@/lib/types';
import { useSignalLoomStore } from '@/lib/store';

interface MessageListProps {
  thread: Thread;
}

const BOTTOM_THRESHOLD = 80; // px from bottom to consider "at bottom"

export function MessageList({ thread }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const isAutoScrolling = useRef(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  // Sprint 9: Count new messages that arrived while user scrolled away
  const [newMessageCount, setNewMessageCount] = useState(0);
  const prevMessageCountRef = useRef(thread.messages.length);
  const { highlightedMessageId, composerState } = useSignalLoomStore();

  const isStreaming = composerState.isStreaming;
  const streamingContent = composerState.streamingResponse;

  // Smart scroll to bottom:
  // - Only auto-scroll if user is already near the bottom
  // - If user scrolled away from bottom, don't interrupt them
  const scrollToBottom = useCallback((force = false) => {
    if (!bottomRef.current) return;
    const el = scrollRef.current;
    if (!el) return;

    if (force || isAtAtBottom(el)) {
      isAutoScrolling.current = true;
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => { isAutoScrolling.current = false; }, 300);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function isAtAtBottom(el: HTMLDivElement): boolean {
    const { scrollTop, scrollHeight, clientHeight } = el;
    return scrollHeight - scrollTop - clientHeight < BOTTOM_THRESHOLD;
  }

  // Detect when user scrolls away from bottom
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || isAutoScrolling.current) return;
    const atBottom = isAtAtBottom(el);
    setIsAtBottom(atBottom);
    if (atBottom) setNewMessageCount(0); // reset when back at bottom
  }, []);

  // Track new messages: if user scrolled away, count new arrivals instead of auto-scrolling
  useEffect(() => {
    const prev = prevMessageCountRef.current;
    prevMessageCountRef.current = thread.messages.length;

    if (thread.messages.length > prev) {
      if (isAtBottom) {
        // Already at bottom — let the auto-scroll handle it
      } else {
        // Scrolled away — count new messages, don't interrupt
        setNewMessageCount((n) => n + (thread.messages.length - prev));
      }
    }
  }, [thread.messages.length, isAtBottom]);

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
  // Sprint 9: Detect if the last message is the one currently being streamed in.
  // Uses 'nero' role (agent response) and content match against the live streaming accumulator.
  const isLastMsgStreaming =
    isStreaming &&
    lastMsg?.role === 'nero' &&
    streamingContent != null &&
    lastMsg.content === streamingContent;

  return (
    <div className="flex flex-col flex-1 min-h-0 relative">
      <ScrollArea
        ref={scrollRef}
        className="flex-1 px-4 py-4"
        onScroll={handleScroll}
      >
        <div className="space-y-1">
          {thread.messages.map((message, idx) => {
            const isLast = idx === thread.messages.length - 1;
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
                  // Sprint 9: Mark the last assistant message if it's actively streaming
                  isStreaming={isLast && isLastMsgStreaming}
                />
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Sprint 9: Jump-to-latest pill — appears when scrolled away and new messages arrived */}
      {newMessageCount > 0 && (
        <button
          onClick={() => {
            scrollToBottom(true);
            setNewMessageCount(0);
          }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full text-xs font-mono cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg"
          style={{
            background: 'var(--mb-teal)',
            color: 'var(--mb-carbon)',
            border: '1px solid rgba(0,0,0,0.15)',
            zIndex: 10,
          }}
          aria-label={`Jump to ${newMessageCount} new message${newMessageCount !== 1 ? 's' : ''}`}
        >
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: 'var(--mb-carbon)', animation: 'signal-pulse 1.5s ease-in-out infinite' }}
          />
          ↓ {newMessageCount} new message{newMessageCount !== 1 ? 's' : ''} — jump to latest
        </button>
      )}
    </div>
  );
}
