'use client';

import { useSignalLoomStore } from '@/lib/store';
import { ThreadListItem } from './thread-list-item';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Thread } from '@/lib/types';

export function ThreadDock() {
  const { threads, selectedThreadId, selectThread } = useSignalLoomStore();

  const pinned = threads.filter((t) => t.pinned);
  const unpinned = threads.filter((t) => !t.pinned);

  return (
    <aside
      className="flex flex-col h-full border-r"
      style={{
        background: 'var(--mb-shell)',
        borderColor: 'rgba(255,255,255,0.05)',
        width: '260px',
        minWidth: '260px',
      }}
    >
      {/* Dock header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'rgba(255,255,255,0.05)' }}
      >
        <span className="text-xs font-semibold uppercase tracking-widest text-ash-muted">
          Threads
        </span>
        <span
          className="text-xs font-mono text-ash-muted px-1.5 py-0.5 rounded"
          style={{ background: 'var(--mb-graphite)' }}
        >
          {threads.length}
        </span>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {pinned.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-ash-muted">
                Pinned
              </div>
              {pinned.map((thread) => (
                <ThreadListItemWrapper
                  key={thread.id}
                  thread={thread}
                  isSelected={thread.id === selectedThreadId}
                  onSelect={() => selectThread(thread.id)}
                />
              ))}
              <div className="my-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.04)' }} />
            </>
          )}

          {unpinned.map((thread) => (
            <ThreadListItemWrapper
              key={thread.id}
              thread={thread}
              isSelected={thread.id === selectedThreadId}
              onSelect={() => selectThread(thread.id)}
            />
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}

function ThreadListItemWrapper({
  thread,
  isSelected,
  onSelect,
}: {
  thread: Thread;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <ThreadListItem
      thread={thread}
      isSelected={isSelected}
      onSelect={onSelect}
    />
  );
}
