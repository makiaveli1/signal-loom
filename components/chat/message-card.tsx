'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { Message } from '@/lib/types';

function formatLocalTime(isoString: string): string {
  const d = new Date(isoString);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

interface MessageTimestampProps {
  isoString: string;
}

function MessageTimestamp({ isoString }: MessageTimestampProps) {
  const [display, setDisplay] = useState(isoString);
  useEffect(() => {
    const timer = setTimeout(() => setDisplay(formatLocalTime(isoString)), 0);
    return () => clearTimeout(timer);
  }, [isoString]);
  return <span suppressHydrationWarning>{display}</span>;
}

interface MessageCardProps {
  message: Message;
  isHighlighted?: boolean;
  /** Sprint 9: true when this message is actively receiving streaming content */
  isStreaming?: boolean;
}

// Sprint 9: Parse message content into reasoning and answer sections.
// Detects [Reasoning] ... blocks (from gateway thinking blocks) and separates
// them from the main answer text. Reasoning is collapsed by default.
function parseContent(content: string): {
  answer: string;
  reasoningSections: string[];
  hasReasoning: boolean;
} {
  // Match [Reasoning] <text> blocks — the gateway flattens thinking blocks this way.
  // Uses [\s\S] instead of dotAll flag to avoid ES2018 target requirement.
  const reasoningSections: string[] = [];

  // Pattern 1: multi-line [Reasoning]\n\n<text> form (blank line after the tag)
  const MULTI = /\[Reasoning\]\n\n([\s\S]+?)(?=\[Reasoning\]|\[Tool\]|\[Result\]|$)/g;
  let match;
  while ((match = MULTI.exec(content)) !== null) {
    const block = (match[1] ?? '').trim();
    if (block) reasoningSections.push(block);
  }

  // Pattern 2: inline [Reasoning] <text> form (single line)
  const SINGLE = /\[Reasoning\]\s*(.+?)(?=\[Reasoning\]|\[Tool\]|\[Result\]|$)/g;
  while ((match = SINGLE.exec(content)) !== null) {
    const block = (match[1] ?? '').trim();
    if (block && !reasoningSections.includes(block)) reasoningSections.push(block);
  }

  // Remove reasoning blocks from the answer text
  const answer = content
    .replace(/\[Reasoning\]\n\n[\s\S]+?(?=\[Reasoning\]|\[Tool\]|\[Result\]|$)/g, '')
    .replace(/\[Reasoning\]\s*.+?(?=\[Reasoning\]|\[Tool\]|\[Result\]|$)/g, '')
    .replace(/\[Tool:[^\]]*\]/g, '')
    .replace(/\[Result\]\s*.+?$/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return {
    answer,
    reasoningSections,
    hasReasoning: reasoningSections.length > 0,
  };
}

export function MessageCard({ message, isHighlighted, isStreaming }: MessageCardProps) {
  if (message.role === 'action-summary') {
    return <ActionSummaryCard message={message} isHighlighted={isHighlighted} />;
  }

  // Sprint 9: Parse reasoning sections from content
  const { answer, reasoningSections, hasReasoning } = parseContent(message.content);
  const [reasoningExpanded, setReasoningExpanded] = useState(false);

  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-3 rounded-lg transition-all duration-300",
        message.role === 'user'
          ? "bg-elevated/70 ml-8"
          : message.role === 'nero'
          ? "bg-reading/80 mr-8 border"
          : "bg-graphite/50 mr-8"
      )}
      style={
        message.role === 'nero'
          ? {
              borderColor: isHighlighted
                ? 'rgba(232,96,58,0.8)'
                : 'rgba(232,96,58,0.35)',
              borderLeftColor: isHighlighted ? 'var(--mb-brass)' : 'var(--mb-red)',
              boxShadow: isHighlighted
                ? '0 0 0 2px rgba(201,160,58,0.25), inset 0 0 0 1px rgba(201,160,58,0.10)'
                : undefined,
            }
          : isHighlighted
          ? { boxShadow: '0 0 0 2px rgba(201,160,58,0.3)' }
          : {}
      }
    >
      {/* Role icon */}
      <div className="flex-shrink-0 mt-0.5">
        {message.role === 'user' && (
          <span className="text-ivory-dim text-sm font-semibold">You</span>
        )}
        {message.role === 'nero' && (
          <div className="flex items-center gap-1.5">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: 'var(--mb-red)', color: 'var(--mb-ivory)' }}
            >
              N
            </div>
          </div>
        )}
        {message.role === 'system' && (
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center"
            style={{ background: 'var(--mb-fog)', opacity: 0.6 }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <circle cx="5" cy="5" r="4" stroke="var(--mb-ivory)" strokeWidth="1.2" />
              <circle cx="5" cy="5" r="1.5" fill="var(--mb-ivory)" />
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Main answer text */}
        <p
          className={cn(
            "text-sm leading-relaxed",
            message.role === 'nero' ? "text-ivory" : "text-ivory-dim"
          )}
        >
          {answer || <span className="text-ivory/30 italic">waiting for response…</span>}
          {/* Sprint 9: Blinking cursor while streaming */}
          {isStreaming && (
            <span
              className="inline-block w-1.5 h-3 ml-0.5 rounded-sm"
              style={{
                background: 'var(--mb-teal)',
                animation: 'signal-pulse 1s ease-in-out infinite',
                verticalAlign: 'text-bottom',
              }}
              aria-hidden="true"
            />
          )}
        </p>

        {/* Sprint 9: Collapsible reasoning section */}
        {hasReasoning && (
          <div className="mt-2">
            <button
              onClick={() => setReasoningExpanded((v) => !v)}
              className="flex items-center gap-1.5 text-[10px] font-mono transition-opacity hover:opacity-80"
              aria-expanded={reasoningExpanded}
            >
              <svg
                width="7"
                height="7"
                viewBox="0 0 8 8"
                fill="none"
                className={cn('transition-transform duration-200', reasoningExpanded && 'rotate-90')}
              >
                <path d="M2 1L6 4L2 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ color: 'var(--mb-brass)', opacity: 0.7 }}>
                {reasoningExpanded
                  ? 'Hide reasoning'
                  : `Show reasoning (${reasoningSections.length})`}
              </span>
            </button>

            {reasoningExpanded && (
              <div
                className="mt-1.5 rounded border px-3 py-2 text-[11px] leading-relaxed"
                style={{
                  background: 'rgba(201,160,58,0.04)',
                  borderColor: 'rgba(201,160,58,0.12)',
                  color: 'var(--mb-ash)',
                }}
              >
                {reasoningSections.map((section, i) => (
                  <p key={i} className="mb-1 last:mb-0">{section}</p>
                ))}
              </div>
            )}
          </div>
        )}

        <span className="text-xs font-mono text-ash-muted mt-1 block">
          <MessageTimestamp isoString={message.timestamp} />
        </span>
      </div>

      {/* Highlight indicator */}
      {isHighlighted && (
        <div
          className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 rounded-full"
          style={{ background: 'var(--mb-brass)', height: '60%' }}
        />
      )}
    </div>
  );
}

function ActionSummaryCard({ message, isHighlighted }: MessageCardProps) {
  return (
    <div
      className="flex gap-3 px-4 py-3 rounded-lg mx-8 my-2 border transition-all duration-300"
      style={{
        background: 'rgba(139,126,200,0.06)',
        borderColor: isHighlighted
          ? 'rgba(201,160,58,0.6)'
          : 'rgba(139,126,200,0.2)',
        boxShadow: isHighlighted
          ? '0 0 0 2px rgba(201,160,58,0.25)'
          : undefined,
      }}
    >
      <div className="flex-shrink-0 mt-0.5">
        <div
          className="w-5 h-5 rounded flex items-center justify-center"
          style={{ background: 'var(--mb-violet-dim)' }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1.5 5L4 7.5L8.5 2.5" stroke="var(--mb-violet)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-signal-violet mb-1 uppercase tracking-wider">
          Action Summary
        </p>
        <p className="text-sm text-ivory-dim leading-relaxed">
          {message.content}
        </p>
        <span className="text-xs font-mono text-ash-muted mt-1 block">
          <MessageTimestamp isoString={message.timestamp} />
        </span>
      </div>
    </div>
  );
}
