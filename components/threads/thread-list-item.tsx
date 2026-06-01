'use client';

import { cn } from '@/lib/utils';
import type { Thread } from '@/lib/types';
import { RelativeTime } from '@/components/ui/relative-time';
import { PretextSmartTitle } from '@/components/ui/pretext-smart-title';
import { motion } from 'motion/react';

const STATUS_LABELS: Record<Thread['status'], string> = {
  active:               'active',
  waiting_on_nero:      'waiting on agent',
  waiting_on_specialist:'waiting on helper',
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
  /** Sprint 8: Number of child sessions delegated from this thread (for indicator) */
  childCount?: number;
  isHidden?: boolean;
  onHide?: () => void;
  onUnhide?: () => void;
}

export function ThreadListItem({ thread, isSelected, onSelect, childCount, isHidden = false, onHide, onUnhide }: ThreadListItemProps) {
  const statusColor = STATUS_COLORS[thread.status];
  const statusBg    = STATUS_BG[thread.status];
  const isActive    = thread.status === 'active';

  // Sprint 10.5: layoutId enables smooth shared-element transition when selection
  // changes — Framer Motion animates the shared border indicator between items.
  return (
    <motion.div
      layoutId={isSelected ? `thread-selected-border` : undefined}
      className="group relative"
      transition={{ type: 'spring', stiffness: 400, damping: 30, mass: 0.8 }}
    >
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "thread-row-flat w-full text-left px-3 py-3 rounded-lg transition-all duration-150 relative",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset",
          isSelected ? "bg-elevated/80" : "bg-transparent",
          isSelected && "is-selected",
          isHidden && "opacity-70"
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
          <div
            className={cn(
              "min-w-0 flex-1 pr-2 text-xs leading-snug transition-colors duration-150 flex items-start gap-1.5",
              isActive ? "text-ivory font-medium" : "text-ivory-dim group-hover:text-ivory",
              isSelected && "text-ivory font-medium"
            )}
          >
            {/* Sprint 9: Live pulse dot for active sessions in dock */}
            {isActive && (
              <span
                className="mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 signal-pulse"
                style={{ background: 'var(--mb-teal)' }}
                title="Active session"
              />
            )}
            <PretextSmartTitle
              text={thread.title}
              maxWidth={190}
              maxLines={2}
              className="min-w-0"
              font="500 12px Geist, ui-sans-serif, system-ui, sans-serif"
              lineHeight={15}
            />
          </div>
          {/* Sprint 8: Child sessions indicator */}
          {(childCount ?? 0) > 0 && (
            <span
              className="flex items-center gap-0.5 text-xs font-mono flex-shrink-0"
              style={{ color: '#9b8dc8', fontSize: '9px' }}
              title={`${childCount} delegated child session${childCount !== 1 ? 's' : ''}`}
            >
              <svg width="8" height="8" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <circle cx="6" cy="6" r="2.5" stroke="#9b8dc8" strokeWidth="1.2" fill="none" />
                <path d="M1 6C2 3.5 4 2 6 2s4 1.5 5 4c-1 2.5-3 4-5 4S2 8.5 1 6z" stroke="#9b8dc8" strokeWidth="1.2" fill="none" strokeLinejoin="round" />
              </svg>
              {childCount}
            </span>
          )}
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
      {(onHide || onUnhide) && (
        <button
          type="button"
          className="thread-row-action"
          onClick={(event) => {
            event.stopPropagation();
            if (isHidden) onUnhide?.();
            else onHide?.();
          }}
          aria-label={isHidden ? `Restore ${thread.title}` : `Hide ${thread.title}`}
        >
          {isHidden ? 'Restore' : 'Tuck'}
        </button>
      )}
    </motion.div>
  );
}
