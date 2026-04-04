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
  /** Sprint 10: true when this is the most recent message — triggers entrance animation */
  isNew?: boolean;
}

// Sprint 9.5: Parse message content into an ordered interleaved stream.
// Detects [Reasoning] blocks and interleaves them with answer text in original order.
// This enables rendering reasoning as a continuous stream rather than separate chunks.
type ContentChunk =
  | { kind: 'answer'; text: string }
  | { kind: 'reasoning'; text: string };

function parseContentStream(content: string): {
  chunks: ContentChunk[];
  /** True if content contains any reasoning blocks */
  hasReasoning: boolean;
  /** Plain answer text with reasoning blocks stripped — used for collapsed preview */
  answerOnly: string;
} {
  const chunks: ContentChunk[] = [];

  // Two patterns to detect reasoning blocks:
  // Pattern A: multi-line [Reasoning]\n\n<text> (reasoning preceded by blank line)
  // Pattern B: inline [Reasoning] <text> on same line
  // Both patterns use [\s\S] instead of dotAll flag for ES2017 compatibility.

  const BLOCK_PATTERN = /\[Reasoning\]\n\n([\s\S]+?)(?=\[Reasoning\]\n\n|\[Reasoning\]\s|\[Tool:|\[Result\]|$)/g;
  const INLINE_PATTERN = /\[Reasoning\]\s*(.+?)(?=\[Reasoning\]\s|\[Tool:|\[Result\]|$)/g;

  // Walk through content building an ordered list of answer/reasoning chunks.
  // Track the end of the last match to find the answer text between reasoning blocks.
  let lastEnd = 0;
  let match: RegExpExecArray | null;

  // Process all multi-line reasoning blocks first
  const blockMatches: Array<{ start: number; end: number; text: string }> = [];
  BLOCK_PATTERN.lastIndex = 0;
  while ((match = BLOCK_PATTERN.exec(content)) !== null) {
    blockMatches.push({
      start: match.index,
      end: match.index + match[0].length,
      text: (match[1] ?? '').trim(),
    });
  }

  // Also find all inline reasoning blocks that aren't part of multi-line blocks
  const inlineMatches: Array<{ start: number; end: number; text: string }> = [];
  INLINE_PATTERN.lastIndex = 0;
  while ((match = INLINE_PATTERN.exec(content)) !== null) {
    // Skip if this match falls inside a block match
    const insideBlock = blockMatches.some(
      (b) => match!.index >= b.start && match!.index < b.end
    );
    if (!insideBlock && match[1]) {
      inlineMatches.push({
        start: match.index,
        end: match.index + match[0].length,
        text: (match[1] ?? '').trim(),
      });
    }
  }

  // Merge and sort all reasoning positions
  const allReasoning = [...blockMatches, ...inlineMatches].sort((a, b) => a.start - b.start);

  // Build ordered chunks: answer text between reasoning blocks, then each reasoning block
  let searchStart = 0;
  for (const r of allReasoning) {
    if (r.start > searchStart) {
      const answerText = content.slice(searchStart, r.start)
        .replace(/\[Tool:[^\]]*\]/g, '')
        .replace(/\[Result\]\s*.+?$/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      if (answerText) {
        chunks.push({ kind: 'answer', text: answerText });
      }
    }
    if (r.text) {
      chunks.push({ kind: 'reasoning', text: r.text });
    }
    searchStart = r.end;
  }

  // Remaining answer text after last reasoning block
  if (searchStart < content.length) {
    const answerText = content.slice(searchStart)
      .replace(/\[Tool:[^\]]*\]/g, '')
      .replace(/\[Result\]\s*.+?$/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (answerText) {
      chunks.push({ kind: 'answer', text: answerText });
    }
  }

  // Build answer-only (no reasoning) for collapsed preview
  const answerOnly = content
    .replace(/\[Reasoning\][\s\S]*?(?=\[Reasoning\]|\[Tool:|\[Result\]|$)/g, '')
    .replace(/\[Tool:[^\]]*\]/g, '')
    .replace(/\[Result\]\s*.+?$/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return {
    chunks: chunks.length > 0 ? chunks : [{ kind: 'answer', text: content }],
    hasReasoning: allReasoning.length > 0,
    answerOnly,
  };
}

export function MessageCard({ message, isHighlighted, isStreaming, isNew }: MessageCardProps) {
  if (message.role === 'action-summary') {
    return <ActionSummaryCard message={message} isHighlighted={isHighlighted} isNew={isNew} />;
  }

  // Sprint 9.5: Parse into ordered content stream
  const { chunks, hasReasoning, answerOnly } = parseContentStream(message.content);
  const [reasoningExpanded, setReasoningExpanded] = useState(false);
  // Sprint 9.5/10: Derive reasoning chunks at outer scope for use in both
  // the expand/collapse section and the InterleavedContent
  const reasoningChunks = chunks.filter((c) => c.kind === 'reasoning');

  // Sprint 10: Entrance animation — runs once on mount when isNew=true
  useEffect(() => {
    if (!isNew) return;
    // Animation plays once via CSS; no state update needed
  }, [isNew]);

  // Determine if this message has only answer chunks (no reasoning at all)
  const pureAnswer = !hasReasoning;

  // Collapsed preview: show the first answer chunk or a truncated answer-only string
  const previewText = chunks.find((c) => c.kind === 'answer')?.text ?? answerOnly;
  const collapsedPreview = previewText.length > 280
    ? previewText.slice(0, 280).trimEnd() + '…'
    : previewText;

  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-3 rounded-lg transition-all duration-300",
        message.role === 'user'
          ? "bg-elevated/70 ml-8"
          : message.role === 'nero'
          ? "bg-reading/80 mr-8 border"
          : "bg-graphite/50 mr-8",
        isNew && "msg-enter"
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

      {/* Content — Sprint 9.5: continuous stream rendering */}
      <div className="flex-1 min-w-0">

        {/* Main content area — answer always visible */}
        <div className="relative">
          <p
            className={cn(
              "text-sm leading-relaxed",
              message.role === 'nero' ? "text-ivory" : "text-ivory-dim"
            )}
          >
            {/* Sprint 9.5: Render content as continuous stream */}
            {reasoningExpanded
              ? (
                // Expanded: full interleaved stream
                <InterleavedContent chunks={chunks} isStreaming={isStreaming} />
              )
              : (
                // Collapsed: answer preview only (reasoning hidden)
                <>
                  {collapsedPreview}
                  {/* Blinking cursor while streaming */}
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
                </>
              )}
          </p>

          {/* Sprint 9.5: Show "still thinking…" indicator for streaming with reasoning */}
          {isStreaming && reasoningExpanded && (
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
        </div>

        {/* Sprint 9.5/10: Reasoning toggle + animated expand/collapse — only shown when reasoning exists */}
        {hasReasoning && (
          <div className="mt-1.5">
            {/* Collapse/expand toggle */}
            <button
              onClick={() => setReasoningExpanded((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 text-[10px] font-mono transition-all duration-150",
                "hover:opacity-80 active:scale-[0.98]",
                reasoningExpanded ? "text-brass/50" : "text-brass/60"
              )}
              style={reasoningExpanded ? { color: 'rgba(201,160,58,0.5)' } : { color: 'rgba(201,160,58,0.6)' }}
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
              {reasoningExpanded ? (
                <span>hide reasoning</span>
              ) : (
                <span>reasoning ({countReasoningWords(chunks)})</span>
              )}
            </button>

            {/* Sprint 10: Animated expand/collapse using grid-row technique */}
            <div className={cn('expand-grid', reasoningExpanded && 'is-open')}>
              <div className="expand-inner">
                <div
                  className="mt-1.5 rounded border px-3 py-2"
                  style={{
                    background: 'rgba(201,160,58,0.04)',
                    borderColor: 'rgba(201,160,58,0.12)',
                  }}
                >
                  {/* Reasoning label */}
                  <span
                    className="block text-[9px] uppercase tracking-widest mb-1 opacity-50"
                    style={{
                      color: 'rgba(201,160,58,0.4)',
                      letterSpacing: '0.1em',
                      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
                    }}
                  >
                    reasoning
                  </span>
                  {/* Reasoning content — rendered inline in the interleaved stream */}
                  <span
                    className="block"
                    style={{
                      color: 'rgba(201,160,58,0.65)',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      fontSize: '11px',
                      lineHeight: '1.6',
                    }}
                  >
                    {reasoningChunks.map((c, i) => (
                      <span key={`r-${i}`} className="block mb-1 last:mb-0">
                        {c.text}
                      </span>
                    ))}
                    {isStreaming && (
                      <span
                        className="inline-block w-1 h-2 ml-1 rounded-sm"
                        style={{
                          background: 'rgba(201,160,58,0.6)',
                          animation: 'signal-pulse 1.2s ease-in-out infinite',
                          verticalAlign: 'text-bottom',
                        }}
                        aria-hidden="true"
                      />
                    )}
                  </span>
                </div>
              </div>
            </div>
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

// Sprint 9.5/10: Render answer chunks as a continuous text stream.
// Reasoning lives in the animated expand/collapse section below.
// This function only handles the answer portion of the interleaved content.
function InterleavedContent({
  chunks,
  isStreaming,
}: {
  chunks: ContentChunk[];
  isStreaming?: boolean;
}) {
  const answerChunks = chunks.filter((c) => c.kind === 'answer');

  return (
    <>
      {answerChunks.map((c, i) => (
        <span key={`a-${i}`}>{c.text}</span>
      ))}
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
    </>
  );
}

// Sprint 9.5: Count total reasoning words for the toggle label
function countReasoningWords(chunks: ContentChunk[]): string {
  const words = chunks
    .filter((c) => c.kind === 'reasoning')
    .reduce((acc, c) => acc + c.text.split(/\s+/).length, 0);
  if (words === 0) return '';
  if (words < 50) return `${words}w`;
  return `${Math.round(words / 100) * 100}w+`;
}

function ActionSummaryCard({ message, isHighlighted, isNew }: MessageCardProps) {
  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-3 rounded-lg mx-8 my-2 border transition-all duration-300",
        isNew && "msg-enter"
      )}
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
