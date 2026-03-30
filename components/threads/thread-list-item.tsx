'use client';

import { cn } from '@/lib/utils';
import type { Thread } from '@/lib/types';
import { RelativeTime } from '@/components/ui/relative-time';

const STATUS_LABELS: Record<Thread['status'], string> = {
  active:               'active',
  waiting_on_nero:      'waiting on Nero',
  waiting_on_specialist:'waiting on specialist',
  waiting_on_user:      'waiting on you',
  blocked:              'blocked',
  done:                 'done',
};

const STATUS_COLORS: Record<Thread['status'], string> = {
  active:               'var(--mb-teal)',
  waiting_on_nero:      'var(--mb-red)',
  waiting_on_specialist:'var(--mb-brass)',
  waiting_on_user:      'var(--mb-violet)',
  blocked:              'var(--mb-rust)',
  done:                 'var(--mb-jade)',
};

const STATUS_BG: Record<Thread['status'], string> = {
  active:               'rgba(61,201,196,0.10)',
  waiting_on_nero:      'rgba(232,96,58,0.10)',
  waiting_on_specialist:'rgba(201,160,58,0.10)',
  waiting_on_user:      'rgba(139,126,200,0.10)',
  blocked:              'rgba(196,90,58,0.10)',
  done:                 'rgba(74,184,138,0.08)',
};

interface ThreadListItemProps {
  thread: Thread;
  isSelected: boolean;
  onSelect: () => void;
  hasPendingEmail?: boolean;
  emailGateUrgent?: boolean;
}

export function ThreadListItem({ thread, isSelected, onSelect }: ThreadListItemProps) {
  const statusColor = STATUS_COLORS[thread.status];
  const statusBg    = STATUS_BG[thread.status];
  const isActive    = thread.status === 'active';

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left px-3 py-3 rounded-lg transition-all duration-150 group relative",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset",
        isSelected
          ? "bg-elevated/80 shadow-[0_0_0_1px_rgba(61,201,196,0.15)]"
          : "bg-transparent",
      )}
      style={isSelected ? {
        boxShadow: `inset 3px 0 0 ${statusColor}50, 0 0 0 1px rgba(61,201,196,0.12)`,
      } : undefined}
    >
      {/* Pinned indicator */}
      {thread.pinned && (
        <span className="absolute top-2 right-2" aria-label="Pinned">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M6 1L7 2L9 1L8 3L9 5L6 4V9H4V4L1 5L2 3L1 1L3 2L4 1H6Z"
              fill="var(--mb-brass)" opacity="0.7" />
          </svg>
        </span>
      )}

      <div className="pl-5 pr-3">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <p
            className={cn(
              "text-xs leading-snug truncate pr-2 transition-colors duration-150",
              isActive ? "text-ivory font-medium" : "text-ivory-dim group-hover:text-ivory",
              isSelected && "text-ivory font-medium"
            )}
          >
            {thread.title}
          </p>
        </div>

        {/* Status + badges row */}
        <div className="flex items-center justify-between gap-2">
          {/* Status pill */}
          <span
            className="inline-flex items-center gap-1 text-xs font-mono px-1.5 py-0.5 rounded-full"
            style={{
              color: statusColor,
              background: statusBg,
              border: `1px solid ${statusColor}25`,
            }}
          >
            {isActive && (
              <span
                className="w-1.5 h-1.5 rounded-full signal-pulse flex-shrink-0"
                style={{ background: statusColor }}
              />
            )}
            {STATUS_LABELS[thread.status]}
          </span>

          {/* Badges + time */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Approval indicator */}
            {thread.hasApproval && (
              <span
                className="text-xs leading-none flex-shrink-0 font-bold"
                style={{ color: 'var(--mb-brass)', fontSize: '10px' }}
                title="Approval pending"
              >
                ▲
              </span>
            )}
            {/* Unread count */}
            {thread.unreadCount > 0 && (
              <span
                className="text-xs font-mono font-semibold min-w-4 h-4 rounded-full flex items-center justify-center px-1"
                style={{
                  background: 'var(--mb-red-dim)',
                  color: 'var(--mb-red)',
                  fontSize: '10px',
                  lineHeight: 1,
                }}
              >
                {thread.unreadCount}
              </span>
            )}
            {/* Relative time — stable on first render, live after mount */}
            <RelativeTime
              isoString={thread.lastActive}
              className="text-xs font-mono text-ash-muted flex-shrink-0"
            />
          </div>
        </div>
      </div>
    </button>
  );
}
