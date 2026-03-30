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
  const { highlightedMessageId } = useSignalLoomStore();

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
      // Reset the flag after animation completes
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
    setIsAtBottom(isAtAtBottom(el));
  }, []);

  // Scroll to bottom when new messages arrive IF already at bottom
  useEffect(() => {
    scrollToBottom();
  }, [thread.messages.length, scrollToBottom]);

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

  return (
    <ScrollArea
      ref={scrollRef}
      className="flex-1 px-4 py-4"
      onScroll={handleScroll}
    >
      <div className="space-y-1">
        {thread.messages.map((message) => (
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
            />
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
