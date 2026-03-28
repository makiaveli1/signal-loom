'use client';

import { useSignalLoomStore } from '@/lib/store';
import { MessageList } from './message-list';
import { ThreadHeader } from '../threads/thread-header';
import { Composer } from './composer';

export function NeroWorkspace() {
  const { threads, selectedThreadId } = useSignalLoomStore();
  const thread = threads.find((t) => t.id === selectedThreadId);

  if (!thread) {
    return (
      <main
        className="flex flex-col flex-1 items-center justify-center"
        style={{ background: 'var(--mb-carbon)' }}
      >
        <div className="text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-4 mx-auto"
            style={{ background: 'var(--mb-elevated)' }}
          >
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="4" fill="var(--mb-teal)" opacity="0.8" />
              <circle cx="16" cy="16" r="9" stroke="var(--mb-teal)" strokeWidth="1.5" opacity="0.3" />
            </svg>
          </div>
          <p className="text-ivory-dim text-sm">Select a thread to begin</p>
        </div>
      </main>
    );
  }

  return (
    <main
      className="flex flex-col flex-1 min-w-0"
      style={{ background: 'var(--mb-carbon)' }}
    >
      <ThreadHeader thread={thread} />
      <MessageList thread={thread} />
      <Composer />
    </main>
  );
}
