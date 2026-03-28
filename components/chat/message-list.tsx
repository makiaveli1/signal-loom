'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCard } from './message-card';
import type { Thread } from '@/lib/types';
import { useEffect, useRef } from 'react';

interface MessageListProps {
  thread: Thread;
}

export function MessageList({ thread }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread.messages.length]);

  return (
    <ScrollArea className="flex-1 px-4 py-4">
      <div className="space-y-1">
        {thread.messages.map((message) => (
          <MessageCard key={message.id} message={message} />
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
