'use client';

import { cn } from '@/lib/utils';
import type { Thread } from '@/lib/types';

const STATUS_LABELS: Record<Thread['status'], string> = {
  active: 'active',
  waiting_on_nero: 'wait·nero',
  waiting_on_specialist: 'wait·spec',
  waiting_on_user: 'wait·you',
  blocked: 'blocked',
  done: 'done',
};

const STATUS_COLORS: Record<Thread['status'], string> = {
  active: 'var(--mb-teal)',
  waiting_on_nero: 'var(--mb-red)',
  waiting_on_specialist: 'var(--mb-brass)',
  waiting_on_user: 'var(--mb-violet)',
  blocked: 'var(--mb-rust)',
  done: 'var(--mb-jade)',
};

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

interface ThreadListItemProps {
  thread: Thread;
  isSelected: boolean;
  onSelect: () => void;
}

export function ThreadListItem({ thread, isSelected, onSelect }: ThreadListItemProps) {
  const statusColor = STATUS_COLORS[thread.status];

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left px-3 py-3 rounded-lg transition-all duration-150 group relative",
        "hover:bg-elevated/60",
        isSelected
          ? "bg-elevated border"
          : "bg-transparent border border-transparent"
      )}
      style={{
        borderColor: isSelected ? 'rgba(61,201,196,0.2)' : 'transparent',
      }}
    >
      {/* Left accent bar — visible when active */}
      {thread.status === 'active' && (
        <span
          className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full signal-pulse"
          style={{ background: statusColor }}
        />
      )}

      {/* Pinned indicator */}
      {thread.pinned && (
        <span
          className="absolute top-2 right-2"
          aria-label="Pinned"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M6 1L7 2L9 1L8 3L9 5L6 4V9H4V4L1 5L2 3L1 1L3 2L4 1H6Z"
              fill="var(--mb-brass)" opacity="0.7" />
          </svg>
        </span>
      )}

      {/* Status dot */}
      <span
        className="absolute top-3.5 left-3 w-1.5 h-1.5 rounded-full"
        style={{ background: statusColor }}
      />

      <div className="pl-5 pr-4">
        {/* Title */}
        <p
          className={cn(
            "text-xs font-medium leading-snug mb-1.5 truncate pr-4",
            isSelected ? "text-ivory" : "text-ivory-dim group-hover:text-ivory"
          )}
        >
          {thread.title}
        </p>

        {/* Meta row */}
        <div className="flex items-center justify-between">
          <span
            className="text-xs font-mono"
            style={{ color: statusColor }}
          >
            {STATUS_LABELS[thread.status]}
          </span>
          <div className="flex items-center gap-1.5">
            {/* Approval badge */}
            {thread.hasApproval && (
              <span
                className="w-1.5 h-1.5 rounded-sm"
                style={{ background: 'var(--mb-brass)' }}
                title="Has approval pending"
              />
            )}
            {/* Unread count */}
            {thread.unreadCount > 0 && (
              <span
                className="text-xs font-mono font-semibold min-w-4 h-4 rounded-full flex items-center justify-center px-1"
                style={{ background: 'var(--mb-red-dim)', color: 'var(--mb-red)' }}
              >
                {thread.unreadCount}
              </span>
            )}
            {/* Time */}
            <span className="text-xs font-mono text-ash-muted">
              {timeAgo(thread.lastActive)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
