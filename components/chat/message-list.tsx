'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCard } from './message-card';
import type { Thread } from '@/lib/types';
import { useEffect, useRef } from 'react';
import { useSignalLoomStore } from '@/lib/store';

interface MessageListProps {
  thread: Thread;
}

export function MessageList({ thread }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const { highlightedMessageId } = useSignalLoomStore();

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread.messages.length]);

  // Scroll to highlighted message when highlight changes
  useEffect(() => {
    if (highlightedMessageId) {
      const el = messageRefs.current.get(highlightedMessageId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Clear highlight after animation
        const timer = setTimeout(() => {
          useSignalLoomStore.getState().highlightMessage(null);
        }, 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [highlightedMessageId]);

  return (
    <ScrollArea className="flex-1 px-4 py-4">
      <div className="space-y-1">
        {thread.messages.map((message) => (
          <div key={message.id} ref={(el) => {
            if (el) messageRefs.current.set(message.id, el);
            else messageRefs.current.delete(message.id);
          }}>
            <MessageCard message={message} isHighlighted={message.id === highlightedMessageId} />
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
