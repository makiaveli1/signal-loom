'use client';

import { useState, useEffect } from 'react';
import type { DelegationEvent, AgentId } from '@/lib/types';
import { cn } from '@/lib/utils';
import { getAgentLaneMeta } from '@/lib/agents';

const AGENT_COLORS: Record<string, string> = {
  hephaestus: '#e8733a',
  argus: '#c9943a',
  ariadne: '#9b8dc8',
  orion: '#3ab8c8',
  hermes: '#e8a04a',
  nero: '#e8603a',
  user: '#c0c0b0',
};

const EVENT_ICONS: Record<DelegationEvent['type'], string> = {
  received: '↓',
  delegated: '→',
  agent_active: '⚡',
  agent_returned: '✓',
  approval_requested: '▲',
  decision_made: '◆',
};

const EVENT_COLORS: Record<DelegationEvent['type'], string> = {
  received: 'var(--mb-teal)',
  delegated: 'var(--mb-brass)',
  agent_active: 'var(--mb-ember)',
  agent_returned: 'var(--mb-jade)',
  approval_requested: 'var(--mb-brass)',
  decision_made: 'var(--mb-jade)',
};

interface DelegationTimelineProps {
  events: DelegationEvent[];
  /** ISO timestamp of when events were last fetched — shown as "last updated" */
  fetchedAt?: string | null;
  onEventClick?: (event: DelegationEvent) => void;
  /** Sprint 8: Called when user wants to open a child session in the secondary pane */
  onOpenChildSession?: (childSessionId: string, delegationEventId: string) => void;
  /** Sprint 8: When true, show inline "View" buttons on delegated events */
  inlineMode?: boolean;
  /** Sprint 8: ID of the delegation event whose child is currently open (for visual marking) */
  activeEventId?: string | null;
}

const ALL_AGENTS: AgentId[] = ['hephaestus', 'argus', 'ariadne', 'orion', 'hermes'];

// Hydration-safe: renders ISO timestamp on server, relative time after client mount
function TimelineEvent({
  event,
  onClick,
  onOpenChildSession,
  inlineMode,
  isActive,
  delegationEventId,
}: {
  event: DelegationEvent;
  onClick?: () => void;
  onOpenChildSession?: (childSessionId: string, delegationEventId: string) => void;
  inlineMode?: boolean;
  /** Sprint 8: True when this event is the one whose child session is currently open */
  isActive?: boolean;
  /** Sprint 8: Pass to onOpenChildSession when user clicks the open action */
  delegationEventId?: string;
}) {
  const [time, setTime] = useState(event.createdAt);

  // Update to relative time after mount — server and client initial render match.
  // useEffect only runs after component mounts, so there is no setState-before-mount error.
  useEffect(() => {
    const timer = setTimeout(() => {
      setTime(formatRelative(event.createdAt));
    }, 0);
    return () => clearTimeout(timer);
  }, [event.createdAt]);

  const isApproval =
    event.type === 'approval_requested' || event.type === 'decision_made';
  const icon = EVENT_ICONS[event.type];
  const color = EVENT_COLORS[event.type];
  const actorColor = AGENT_COLORS[event.actor] ?? 'var(--mb-ash)';

  // Sprint 8: Determine child session open action
  const canOpenChild =
    event.type === 'delegated' &&
    (event.childSessionIds?.length ?? 0) > 0 &&
    onOpenChildSession != null;
  const primaryChildId = event.childSessionIds?.[0];

  return (
    <div
      className={`flex items-start gap-3 py-1.5 group relative${isActive ? ' rounded-md' : ''}`}
      style={isActive ? { background: 'rgba(155,141,200,0.06)', border: '1px solid rgba(155,141,200,0.20)' } : undefined}
    >
      {/* Vertical line connector */}
      <div className="flex flex-col items-center flex-shrink-0 w-4">
        <div
          className="w-4 h-4 rounded-full flex items-center justify-center text-xs flex-shrink-0"
          style={{
            background: isApproval ? `${color}25` : `${color}15`,
            border: `1.5px solid ${color}60`,
            color,
            fontSize: '8px',
          }}
        >
          {icon}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Row 1: actor + title + action */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Actor badge */}
          <span
            className="text-xs font-mono capitalize"
            style={{ color: actorColor }}
          >
            {event.actor}
          </span>
          {/* Sprint 8: Delegation reason chip — why Nero delegated to this agent */}
          {event.type === 'delegated' && event.targetAgentId && (
            <span
              className="text-xs font-mono px-1.5 py-0.5 rounded-full"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.10)',
                color: 'var(--mb-ash)',
                fontSize: '9px',
              }}
              title={`Delegated for: ${getAgentLaneMeta(event.targetAgentId as AgentId)?.delegationReason ?? event.targetAgentId}`}
            >
              {getAgentLaneMeta(event.targetAgentId as AgentId)?.delegationReason ?? event.targetAgentId}
            </span>
          )}
          {/* Event phrase */}
          <span className="text-xs text-ivory-dim">{event.title}</span>

          {/* Sprint 8: Open child session action */}
          {canOpenChild && (
            <button
              onClick={() => primaryChildId && onOpenChildSession(primaryChildId, delegationEventId ?? '')}
              title={
                event.childSessionIds!.length === 1
                  ? 'View child session'
                  : `${event.childSessionIds!.length} child sessions — opening the first one`
              }
              className="flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded-full border flex-shrink-0 transition-all duration-100 cursor-pointer hover:opacity-90 active:scale-95"
              style={{
                borderColor: 'rgba(155,141,200,0.35)',
                color: '#9b8dc8',
                background: 'rgba(155,141,200,0.08)',
              }}
            >
              {/* Monitor/eye icon */}
              <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <circle cx="6" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
                <path d="M1 6C2 3.5 4 2 6 2s4 1.5 5 4c-1 2.5-3 4-5 4S2 8.5 1 6z" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round" />
              </svg>
              {inlineMode
                ? 'View'
                : event.childSessionIds!.length === 1
                ? 'View session'
                : `${event.childSessionIds!.length} sessions`}
            </button>
          )}
        </div>

        {/* Row 2: timestamp + click hint */}
        <div className="flex items-center gap-2">
          <span
            className="text-xs text-ash-muted font-mono"
            suppressHydrationWarning
          >
            {time}
          </span>
          {!inlineMode && canOpenChild && (
            <span className="text-xs text-ash-dimmed italic">
              · click to open
            </span>
          )}
        </div>
      </div>

      {/* Approval brass accent */}
      {isApproval && (
        <div
          className="w-1 rounded-full flex-shrink-0"
          style={{ background: 'var(--mb-brass)', height: '100%', minHeight: '20px' }}
        />
      )}
    </div>
  );
}

export function DelegationTimeline({
  events,
  onEventClick,
  onOpenChildSession,
  fetchedAt,
  inlineMode = false,
  activeEventId,
}: DelegationTimelineProps) {
  const [filter, setFilter] = useState<AgentId | 'all'>('all');
  const [expanded, setExpanded] = useState(false);

  const MAX_VISIBLE = 5;

  const filtered = filter === 'all'
    ? events
    : events.filter((e) => e.actor === filter || e.targetAgentId === filter);

  // Sort newest first
  const sorted = [...filtered].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Collapse consecutive duplicate events (same type + same actor, within 2 minutes)
  const collapsed: Array<DelegationEvent | { _count: number; _representative: DelegationEvent }> = [];
  for (const event of sorted) {
    const prev = collapsed[collapsed.length - 1];
    if (
      prev &&
      !('_count' in prev) &&
      prev.type === event.type &&
      prev.actor === event.actor &&
      Math.abs(new Date(prev.createdAt).getTime() - new Date(event.createdAt).getTime()) < 2 * 60 * 1000
    ) {
      // Merge into a count card
      const rep = collapsed.pop() as DelegationEvent;
      collapsed.push({ _count: 2, _representative: rep });
    } else if (
      prev &&
      '_count' in prev &&
      prev._representative.type === event.type &&
      prev._representative.actor === event.actor &&
      Math.abs(new Date(prev._representative.createdAt).getTime() - new Date(event.createdAt).getTime()) < 2 * 60 * 1000
    ) {
      prev._count += 1;
    } else {
      collapsed.push(event);
    }
  }

  const visible = expanded ? collapsed : collapsed.slice(0, MAX_VISIBLE);
  const hiddenCount = collapsed.length - MAX_VISIBLE;

  return (
    <div
      className="px-4 py-3 border-b"
      style={{
        background: 'rgba(0,0,0,0.15)',
        borderColor: 'rgba(255,255,255,0.04)',
      }}
    >
      {/* Header + filter row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-ash-muted">
            Delegation Timeline
          </span>
          {fetchedAt && (
            <span className="text-xs font-mono text-ash-dimmed" title={`Last refreshed ${new Date(fetchedAt).toLocaleTimeString()}`}>
              · {formatRelative(fetchedAt)}
            </span>
          )}
        </div>

        {/* Agent filter pills */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFilter('all')}
            className={cn(
              'text-xs px-2 py-0.5 rounded-full border transition-all duration-100',
              filter === 'all'
                ? 'border-white/20 bg-white/10 text-ivory'
                : 'border-transparent text-ash-muted hover:text-ivory-dim'
            )}
          >
            All
          </button>
          {ALL_AGENTS.map((agent) => (
            <button
              key={agent}
              onClick={() => setFilter(filter === agent ? 'all' : agent)}
              className={cn(
                'text-xs px-2 py-0.5 rounded-full border capitalize transition-all duration-100',
                filter === agent
                  ? 'text-ivory'
                  : 'border-transparent text-ash-muted hover:text-ivory-dim'
              )}
              style={
                filter === agent
                  ? {
                      borderColor: `${AGENT_COLORS[agent]}40`,
                      background: `${AGENT_COLORS[agent]}15`,
                    }
                  : undefined
              }
            >
              {agent}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline nodes */}
      <div className="relative">
        {visible.length === 0 ? (
          <p className="text-xs text-ash-muted italic py-1">
            No delegation events yet — start a conversation with Nero.
          </p>
        ) : (
          <div className="space-y-0">
            {visible.map((item, idx) => {
              // Collapsed group of repeated events
              if ('_count' in item) {
                const rep = item._representative;
                const color = EVENT_COLORS[rep.type];
                const actorColor = AGENT_COLORS[rep.actor] ?? 'var(--mb-ash)';
                return (
                  <div key={`collapsed-${rep.id}-${idx}`}>
                    <div
                      className="flex items-start gap-3 py-1.5"
                      style={{ opacity: 0.6 }}
                    >
                      <div className="flex flex-col items-center flex-shrink-0 w-4">
                        <div
                          className="w-4 h-4 rounded-full flex items-center justify-center text-xs flex-shrink-0"
                          style={{
                            background: `${color}15`,
                            border: `1.5px solid ${color}40`,
                            color,
                            fontSize: '8px',
                          }}
                        >
                          {EVENT_ICONS[rep.type]}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono capitalize" style={{ color: actorColor }}>
                          {rep.actor}
                        </span>
                        <span className="text-xs text-ivory-dim">{rep.title}</span>
                        <span
                          className="text-xs font-mono px-1.5 py-0.5 rounded"
                          style={{
                            background: 'rgba(255,255,255,0.06)',
                            color: 'var(--mb-ash)',
                          }}
                        >
                          ×{item._count}
                        </span>
                      </div>
                    </div>
                    {idx < visible.length - 1 && (
                      <div
                        className="ml-[0.625rem] w-px"
                        style={{
                          height: 'calc(100% + 0.375rem)',
                          background: 'rgba(255,255,255,0.06)',
                          marginTop: '-0.125rem',
                          marginBottom: '0.125rem',
                        }}
                      />
                    )}
                  </div>
                );
              }

              // Regular event
              const isActive = item.id === activeEventId;
              return (
                <div key={item.id}>
                  <TimelineEvent
                    event={item}
                    onClick={() => onEventClick?.(item)}
                    onOpenChildSession={onOpenChildSession}
                    inlineMode={inlineMode}
                    isActive={isActive}
                  />
                  {idx < visible.length - 1 && (
                    <div
                      className="ml-[0.625rem] w-px"
                      style={{
                        height: 'calc(100% + 0.375rem)',
                        background: 'rgba(255,255,255,0.06)',
                        marginTop: '-0.125rem',
                        marginBottom: '0.125rem',
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Show more / less */}
      {sorted.length > MAX_VISIBLE && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-ash-muted hover:text-ivory-dim transition-colors mt-1"
        >
          {expanded
            ? 'Show less'
            : `+${hiddenCount} more event${hiddenCount !== 1 ? 's' : ''}`}
        </button>
      )}
    </div>
  );
}

function formatRelative(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
