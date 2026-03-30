'use client';

import { useSignalLoomStore } from '@/lib/store';
import { ThreadListItem } from './thread-list-item';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Thread } from '@/lib/types';

export function ThreadDock() {
  const { threads, selectedThreadId, selectThread, sessionsLoading, sessionsError } =
    useSignalLoomStore();

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
        {sessionsLoading ? (
          <span
            className="text-xs font-mono text-ash-muted px-1.5 py-0.5 rounded"
            style={{ background: 'var(--mb-graphite)' }}
          >
            …
          </span>
        ) : (
          <span
            className="text-xs font-mono text-ash-muted px-1.5 py-0.5 rounded"
            style={{ background: 'var(--mb-graphite)' }}
          >
            {threads.length}
          </span>
        )}
      </div>

      {/* Loading state */}
      {sessionsLoading && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4 py-8">
          <div
            className="w-5 h-5 rounded-full border-2 border-t-ash-muted animate-spin"
            style={{ borderColor: 'rgba(255,255,255,0.1)', borderTopColor: 'var(--mb-ash)' }}
          />
          <p className="text-xs text-ash-muted text-center">Loading sessions…</p>
        </div>
      )}

      {/* Error state */}
      {!sessionsLoading && sessionsError && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 px-4 py-8">
          <p className="text-xs text-ember text-center">Sessions unavailable</p>
          <p className="text-xs text-ash-muted text-center">{sessionsError}</p>
        </div>
      )}

      {/* Empty state */}
      {!sessionsLoading && threads.length === 0 && !sessionsError && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 px-4 py-8">
          <p className="text-xs text-ash-muted text-center">No active sessions</p>
          <p className="text-xs text-ash-muted text-center opacity-60">
            Start a conversation with Nero to begin
          </p>
        </div>
      )}

      {/* Thread list */}
      {!sessionsLoading && threads.length > 0 && (
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
                <div
                  className="my-1 border-t"
                  style={{ borderColor: 'rgba(255,255,255,0.04)' }}
                />
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
      )}
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
