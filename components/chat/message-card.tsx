'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  /** True when this message is actively receiving streaming content */
  isStreaming?: boolean;
  /** True when this is the most recent message — triggers entrance animation */
  isNew?: boolean;
  /** Sprint 10.5: True when this message is in a child/secondary session (specialist work) */
  isChildSession?: boolean;
}

// Sprint 10.5: MotionText — word-by-word streaming reveal with spring physics.
// Each word fades in with a subtle spring, creating the feel of a thought unfolding.
function MotionText({
  text,
  className,
  isStreaming,
}: {
  text: string;
  className?: string;
  isStreaming?: boolean;
}) {
  // Split into words, preserving whitespace and line breaks
  const words = useMemo(() => text.split(/(\s+)/), [text]);
  const [visibleCount, setVisibleCount] = useState(words.length);

  // When streaming stops (isStreaming goes false→true→false cycle), content is final
  // We animate in waves: if text is already fully arrived, show all immediately
  const contentFinal = !isStreaming;

  useEffect(() => {
    if (contentFinal) {
      setVisibleCount(words.length);
      return;
    }
    // Streaming: reveal words progressively in batches
    if (words.length === 0) return;

    const batchSize = isStreaming ? Math.min(8, Math.max(3, words.length / 20)) : words.length;
    let current = 0;
    const interval = setInterval(() => {
      current += batchSize;
      setVisibleCount(Math.min(current, words.length));
      if (current >= words.length) clearInterval(interval);
    }, isStreaming ? 40 : 0);
    return () => clearInterval(interval);
  }, [text, contentFinal, words.length, isStreaming]);

  return (
    <span className={className}>
      {words.slice(0, visibleCount).map((word, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            type: 'spring',
            stiffness: 400,
            damping: 28,
            mass: 0.4,
          }}
          style={{ display: 'inline' }}
        >
          {word}
        </motion.span>
      ))}
    </span>
  );
}

// Sprint 9.5/10: Parse message content into an ordered interleaved stream.
type ContentChunk =
  | { kind: 'answer'; text: string }
  | { kind: 'reasoning'; text: string };

function parseContentStream(content: string): {
  chunks: ContentChunk[];
  hasReasoning: boolean;
  answerOnly: string;
} {
  const reasoningSections: string[] = [];

  // Pattern A: multi-line [Reasoning]\n\n<text>
  const MULTI = /\[Reasoning\]\n\n([\s\S]+?)(?=\[Reasoning\]\n\n|\[Reasoning\]\s|\[Tool:|\[Result\]|$)/g;
  let match: RegExpExecArray | null;
  while ((match = MULTI.exec(content)) !== null) {
    const block = (match[1] ?? '').trim();
    if (block) reasoningSections.push(block);
  }

  // Pattern B: inline [Reasoning] <text>
  const SINGLE = /\[Reasoning\]\s*(.+?)(?=\[Reasoning\]\s|\[Tool:|\[Result\]|$)/g;
  while ((match = SINGLE.exec(content)) !== null) {
    const block = (match[1] ?? '').trim();
    if (block && !reasoningSections.includes(block)) reasoningSections.push(block);
  }

  // Build ordered chunks
  const chunks: ContentChunk[] = [];
  let searchStart = 0;

  // Collect all reasoning positions
  const allReasoning: Array<{ start: number; end: number; text: string }> = [];
  const MULTI_POS = /\[Reasoning\]\n\n([\s\S]+?)(?=\[Reasoning\]\n\n|\[Reasoning\]\s|\[Tool:|\[Result\]|$)/g;
  while ((match = MULTI_POS.exec(content)) !== null) {
    allReasoning.push({ start: match.index, end: match.index + match[0].length, text: (match[1] ?? '').trim() });
  }
  const SINGLE_POS = /\[Reasoning\]\s*(.+?)(?=\[Reasoning\]\s|\[Tool:|\[Result\]|$)/g;
  while ((match = SINGLE_POS.exec(content)) !== null) {
    const inside = allReasoning.some((r) => match!.index >= r.start && match!.index < r.end);
    if (!inside && match[1]) {
      allReasoning.push({ start: match.index, end: match.index + match[0].length, text: (match[1] ?? '').trim() });
    }
  }
  allReasoning.sort((a, b) => a.start - b.start);

  for (const r of allReasoning) {
    if (r.start > searchStart) {
      const answerText = content.slice(searchStart, r.start)
        .replace(/\[Tool:[^\]]*\]/g, '').replace(/\[Result\]\s*.+?$/g, '').replace(/\n{3,}/g, '\n\n').trim();
      if (answerText) chunks.push({ kind: 'answer', text: answerText });
    }
    if (r.text) chunks.push({ kind: 'reasoning', text: r.text });
    searchStart = r.end;
  }

  if (searchStart < content.length) {
    const answerText = content.slice(searchStart)
      .replace(/\[Tool:[^\]]*\]/g, '').replace(/\[Result\]\s*.+?$/g, '').replace(/\n{3,}/g, '\n\n').trim();
    if (answerText) chunks.push({ kind: 'answer', text: answerText });
  }

  const answerOnly = content
    .replace(/\[Reasoning\][\s\S]*?(?=\[Reasoning\]|\[Tool:|\[Result\]|$)/g, '')
    .replace(/\[Tool:[^\]]*\]/g, '').replace(/\[Result\]\s*.+?$/g, '').replace(/\n{3,}/g, '\n\n').trim();

  return {
    chunks: chunks.length > 0 ? chunks : [{ kind: 'answer', text: content || '…' }],
    hasReasoning: allReasoning.length > 0,
    answerOnly,
  };
}

export function MessageCard({ message, isHighlighted, isStreaming, isNew, isChildSession }: MessageCardProps) {
  if (message.role === 'action-summary') {
    return <ActionSummaryCard message={message} isHighlighted={isHighlighted} isNew={isNew} />;
  }

  const { chunks, hasReasoning, answerOnly } = parseContentStream(message.content);
  const [reasoningExpanded, setReasoningExpanded] = useState(false);
  const reasoningChunks = chunks.filter((c) => c.kind === 'reasoning');
  const answerText = chunks.find((c) => c.kind === 'answer')?.text ?? answerOnly;
  const pureAnswer = !hasReasoning;

  // Sprint 10: Entrance animation — CSS handles this via .msg-enter
  useEffect(() => {
    if (!isNew) return;
  }, [isNew]);

  // Sprint 10.5: Streaming cursor — teal blinking cursor at end of content
  const streamingCursor = isStreaming ? (
    <motion.span
      key="cursor"
      className="inline-block w-1.5 h-3 ml-0.5 rounded-sm"
      style={{ background: 'var(--mb-teal)', verticalAlign: 'text-bottom' }}
      animate={{ opacity: [1, 0, 1] }}
      transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
      aria-hidden="true"
    />
  ) : null;

  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-3 rounded-lg transition-all duration-300",
        message.role === 'user' ? "bg-elevated/70 ml-8" : message.role === 'nero' ? "bg-reading/80 mr-8 border" : "bg-graphite/50 mr-8",
        isNew && "msg-enter"
      )}
      style={{
        ...(message.role === 'nero' ? {
          borderColor: isHighlighted ? 'rgba(232,96,58,0.8)' : 'rgba(232,96,58,0.35)',
          borderLeftColor: isHighlighted ? 'var(--mb-brass)' : isChildSession ? 'rgba(0,200,150,0.4)' : 'var(--mb-red)',
          boxShadow: isHighlighted ? '0 0 0 2px rgba(201,160,58,0.25), inset 0 0 0 1px rgba(201,160,58,0.10)' : undefined,
        } : {
          // Sprint 10.5: Child session accent — teal left border for specialist/child session work
          borderLeftColor: isChildSession ? 'rgba(0,200,150,0.4)' : undefined,
          boxShadow: isHighlighted ? '0 0 0 2px rgba(201,160,58,0.3)' : undefined,
        }),
      }}
    >
      {/* Role icon */}
      <div className="flex-shrink-0 mt-0.5">
        {message.role === 'user' && <span className="text-ivory-dim text-sm font-semibold">You</span>}
        {message.role === 'nero' && (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'var(--mb-red)', color: 'var(--mb-ivory)' }}>
              N
            </div>
          </div>
        )}
        {message.role === 'system' && (
          <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'var(--mb-fog)', opacity: 0.6 }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <circle cx="5" cy="5" r="4" stroke="var(--mb-ivory)" strokeWidth="1.2" />
              <circle cx="5" cy="5" r="1.5" fill="var(--mb-ivory)" />
            </svg>
          </div>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 min-w-0">

        {/* Main answer text — Sprint 10.5: MotionText for streaming word reveal */}
        <p className={cn("text-sm leading-relaxed", message.role === 'nero' ? "text-ivory" : "text-ivory-dim")}>
          {pureAnswer ? (
            // Pure answer: full content, MotionText for streaming reveal
            <>
              <MotionText
                text={answerText}
                className="whitespace-pre-wrap"
                isStreaming={isStreaming}
              />
              {streamingCursor}
            </>
          ) : reasoningExpanded ? (
            // Expanded: answer + reasoning stream via InterleavedContent
            <>
              <MotionText
                text={answerText}
                className="whitespace-pre-wrap"
                isStreaming={isStreaming}
              />
              <InterleavedContent chunks={chunks} isStreaming={isStreaming} />
            </>
          ) : (
            // Collapsed: truncated answer + reasoning toggle
            <>
              <MotionText
                text={answerText.length > 400 ? answerText.slice(0, 400).trimEnd() + '…' : answerText}
                className="whitespace-pre-wrap"
                isStreaming={isStreaming}
              />
              {streamingCursor}
            </>
          )}
        </p>

        {/* Sprint 10.5: Thought Capsule — animated expand/collapse with AnimatePresence */}
        <AnimatePresence initial={false}>
          {hasReasoning && (
            <motion.div
              className="mt-1.5"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            >
              {/* Toggle button */}
              <button
                onClick={() => setReasoningExpanded((v) => !v)}
                className="flex items-center gap-1.5 text-[10px] font-mono transition-opacity hover:opacity-80 active:scale-[0.98]"
                style={{ color: reasoningExpanded ? 'rgba(201,160,58,0.5)' : 'rgba(201,160,58,0.65)' }}
                aria-expanded={reasoningExpanded}
              >
                {/* Animated thinking icon */}
                <motion.span
                  animate={isStreaming && !reasoningExpanded ? { rotate: 360 } : { rotate: 0 }}
                  transition={isStreaming && !reasoningExpanded ? { duration: 2, repeat: Infinity, ease: 'linear' } : {}}
                  className="flex-shrink-0"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
                    <path d="M3.5 5c0-0.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5z" fill="currentColor" opacity="0.6" />
                  </svg>
                </motion.span>

                {reasoningExpanded ? (
                  <motion.span
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -4 }}
                    transition={{ duration: 0.15 }}
                  >
                    hide reasoning
                  </motion.span>
                ) : (
                  <span>reasoning ({countReasoningWords(chunks)})</span>
                )}

                {/* Animated chevron */}
                <motion.svg
                  width="7" height="7" viewBox="0 0 8 8" fill="none"
                  animate={{ rotate: reasoningExpanded ? 90 : 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                >
                  <path d="M2 1L6 4L2 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </motion.svg>
              </button>

              {/* Sprint 10.5: Thought capsule content — spring-animated reveal */}
              <motion.div
                initial={false}
                animate={reasoningExpanded ? { opacity: 1, height: 'auto' } : { opacity: 0, height: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                style={{ overflow: 'hidden' }}
              >
                <div
                  className="mt-2 rounded border px-3 py-2.5"
                  style={{
                    background: 'rgba(201,160,58,0.04)',
                    borderColor: 'rgba(201,160,58,0.20)',
                  }}
                >
                  {/* Thought capsule header */}
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="flex items-center gap-1 text-[9px] uppercase tracking-widest"
                      style={{ color: 'rgba(201,160,58,0.45)', letterSpacing: '0.12em', fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
                    >
                      <motion.span
                        animate={isStreaming ? { scale: [1, 1.3, 1] } : {}}
                        transition={isStreaming ? { duration: 1.2, repeat: Infinity } : {}}
                        className="inline-block w-1.5 h-1.5 rounded-full"
                        style={{ background: 'rgba(201,160,58,0.5)' }}
                      />
                      thought process
                    </span>
                    {isStreaming && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-[9px] font-mono"
                        style={{ color: 'rgba(201,160,58,0.35)' }}
                      >
                        streaming…
                      </motion.span>
                    )}
                  </div>

                  {/* Reasoning content — Sprint 10.5: MotionText word reveal */}
                  <span
                    className="block"
                    style={{
                      color: 'rgba(201,160,58,0.70)',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      fontSize: '11px',
                      lineHeight: '1.65',
                    }}
                  >
                    {reasoningChunks.map((c, i) => (
                      <MotionText
                        key={`r-${i}`}
                        text={c.text}
                        className="block mb-2 last:mb-0"
                        isStreaming={isStreaming && reasoningExpanded}
                      />
                    ))}
                    {/* Streaming cursor for reasoning */}
                    {isStreaming && reasoningExpanded && (
                      <motion.span
                        key="reasoning-cursor"
                        className="inline-block w-1 h-2 ml-1 rounded-sm"
                        animate={{ opacity: [1, 0, 1] }}
                        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                        style={{ background: 'rgba(201,160,58,0.6)', verticalAlign: 'text-bottom' }}
                        aria-hidden="true"
                      />
                    )}
                  </span>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <span className="text-xs font-mono text-ash-muted mt-1 block">
          <MessageTimestamp isoString={message.timestamp} />
        </span>
      </div>

      {/* Highlight indicator */}
      {isHighlighted && (
        <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 rounded-full" style={{ background: 'var(--mb-brass)', height: '60%' }} />
      )}
    </div>
  );
}

// Sprint 9.5: Answer chunks only — reasoning lives in the thought capsule
function InterleavedContent({ chunks, isStreaming }: { chunks: ContentChunk[]; isStreaming?: boolean }) {
  const answerChunks = chunks.filter((c) => c.kind === 'answer');
  return (
    <>
      {answerChunks.map((c, i) => (
        <span key={`a-${i}`}>
          <MotionText text={c.text} className="whitespace-pre-wrap" isStreaming={isStreaming} />
        </span>
      ))}
    </>
  );
}

function countReasoningWords(chunks: ContentChunk[]): string {
  const words = chunks.filter((c) => c.kind === 'reasoning').reduce((acc, c) => acc + c.text.split(/\s+/).length, 0);
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
        borderColor: isHighlighted ? 'rgba(201,160,58,0.6)' : 'rgba(139,126,200,0.2)',
        boxShadow: isHighlighted ? '0 0 0 2px rgba(201,160,58,0.25)' : undefined,
      }}
    >
      <div className="flex-shrink-0 mt-0.5">
        <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: 'var(--mb-violet-dim)' }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1.5 5L4 7.5L8.5 2.5" stroke="var(--mb-violet)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-signal-violet mb-1 uppercase tracking-wider">Action Summary</p>
        <p className="text-sm text-ivory-dim leading-relaxed">{message.content}</p>
        <span className="text-xs font-mono text-ash-muted mt-1 block">
          <MessageTimestamp isoString={message.timestamp} />
        </span>
      </div>
    </div>
  );
}
