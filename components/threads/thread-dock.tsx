'use client';

import { useSignalLoomStore } from '@/lib/store';
import { useCrmStore } from '@/lib/crm/store';
import { ThreadListItem } from './thread-list-item';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Thread } from '@/lib/types';
import type { EmailGateStoreItem } from '@/lib/store';
import { getConceptBadgeLabel, getConceptBadgeColor } from '@/lib/crm/concept';
import type { Lead } from '@/lib/crm/types';

export function ThreadDock() {
  const { threads, selectedThreadId, selectThread, sessionsLoading, sessionsError, sessionsFetchedAt, loadSessions } =
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
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4 py-8">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-xs"
            style={{
              background: 'rgba(232,96,58,0.12)',
              border: '1.5px solid rgba(232,96,58,0.3)',
              color: 'var(--mb-ember)',
              fontSize: '8px',
            }}
          >
            !
          </div>
          <p className="text-xs text-ember text-center font-semibold">Sessions unavailable</p>
          {sessionsFetchedAt && (
            <p className="text-xs text-ash-muted text-center">
              Last loaded:{' '}
              {new Date(sessionsFetchedAt).toLocaleTimeString('en-IE', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
          <p className="text-xs text-ash-muted text-center leading-relaxed opacity-75 max-w-[180px]">
            {sessionsError}
          </p>
          <button
            onClick={() => loadSessions()}
            className="text-xs px-3 py-1.5 rounded-md font-medium transition-all duration-150 hover:opacity-90"
            style={{
              background: 'var(--mb-graphite)',
              color: 'var(--mb-ivory)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            ↻ Retry
          </button>
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
  const { emailGates } = useSignalLoomStore();
  const { leads, getConceptBadge } = useCrmStore();

  const pendingEmailGates = (emailGates as EmailGateStoreItem[]).filter(
    (g) =>
      g.threadId === thread.id &&
      (g.gateStatus === 'ready_for_approval' || g.gateStatus === 'needs_review')
  );
  const hasPendingEmail = pendingEmailGates.length > 0;
  const hasReviewRequired = pendingEmailGates.some((g) => g.gateStatus === 'needs_review');

  // Find the lead associated with this thread via email gate leadId
  const leadId = (emailGates as EmailGateStoreItem[]).find(
    (g) => g.threadId === thread.id && g.leadId
  )?.leadId;
  const lead: Lead | undefined = leadId ? leads.find((l) => l.id === leadId) : undefined;

  // Concept badge for CRM leads
  const conceptBadge = lead ? getConceptBadge(lead) : null;

  return (
    <ThreadListItem
      thread={thread}
      isSelected={isSelected}
      onSelect={onSelect}
      hasPendingEmail={hasPendingEmail}
      emailGateUrgent={hasReviewRequired}
      conceptBadge={conceptBadge}
    />
  );
}
