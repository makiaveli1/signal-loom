'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/utils';
import type { Message, MessageRole } from '@/lib/types';

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
  /** True when this message is in a child/secondary session (specialist work) */
  isChildSession?: boolean;
}

function MotionText({
  text,
  className,
  isStreaming,
}: {
  text: string;
  className?: string;
  isStreaming?: boolean;
}) {
  const words = useMemo(() => text.split(/(\s+)/), [text]);

  return (
    <span className={className}>
      {words.map((word, i) => (
        <span
          key={i}
          className="word-animated"
          style={{ '--word-delay': isStreaming ? `${Math.min(i * 18, 420)}ms` : '0ms', display: 'inline' } as React.CSSProperties}
        >
          {word}
        </span>
      ))}
    </span>
  );
}

type TraceSection = {
  label: string;
  tone: 'reasoning' | 'tool' | 'system';
  text: string;
};

type MessageDisplay = {
  answer: string;
  traceSections: TraceSection[];
  operationalOnly: boolean;
};

type RuntimeRole = MessageRole | 'assistant' | 'tool';

const OPERATIONAL_HINTS = [
  '"success"',
  '"diff"',
  '"exit_code"',
  '"content"',
  '"matches"',
  '"files"',
  '"bytes_written"',
  '"dirs_created"',
  '"total_count"',
  '"lsp_diagnostics"',
  '<diagnostics',
  'Tool loop warning',
  'Background process',
  'Command:',
  'Matched output:',
  'Code generation for chunk item errored',
];

function compactText(text: string): string {
  return text.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function splitVisibleTailFromTrace(text: string): { trace: string; visibleTail: string } {
  const compact = compactText(text);
  const parts = compact.split(/\n{2,}/);
  if (parts.length < 2) return { trace: compact, visibleTail: '' };

  const tail = parts[parts.length - 1]?.trim() ?? '';
  const looksLikeAnswer = /^(final|answer|done|fixed|verified|summary|here|i\b|the\b|server\b|root cause|##|###)/i.test(tail);
  if (!looksLikeAnswer || tail.length < 24) return { trace: compact, visibleTail: '' };

  return {
    trace: compactText(parts.slice(0, -1).join('\n\n')),
    visibleTail: tail,
  };
}

function pullReasoning(content: string): { stripped: string; sections: TraceSection[] } {
  const sections: TraceSection[] = [];
  const pattern = /\[Reasoning\]\s*([\s\S]*?)(?=\[Reasoning\]|\[Tool:|\[Result\]|$)/g;
  const stripped = content.replace(pattern, (_full, body: string) => {
    const { trace, visibleTail } = splitVisibleTailFromTrace(body ?? '');
    if (trace) sections.push({ label: 'Private reasoning', tone: 'reasoning', text: trace });
    return visibleTail ? `\n${visibleTail}\n` : '\n';
  });
  return { stripped, sections };
}

function pullToolBlocks(content: string): { stripped: string; sections: TraceSection[] } {
  const sections: TraceSection[] = [];
  let stripped = content.replace(/\[Tool:([^\]]+)\]\s*([\s\S]*?)(?=\[Tool:|\[Result\]|\[Reasoning\]|$)/g, (_full, name: string, body: string) => {
    const text = compactText(body ?? '');
    sections.push({ label: `Tool call · ${name}`, tone: 'tool', text: text || 'Tool call recorded.' });
    return '\n';
  });

  stripped = stripped.replace(/\[Result\]\s*([\s\S]*?)(?=\[Tool:|\[Reasoning\]|$)/g, (_full, body: string) => {
    const text = compactText(body ?? '');
    if (text) sections.push({ label: 'Tool result', tone: 'tool', text });
    return '\n';
  });

  return { stripped, sections };
}

function looksOperational(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return OPERATIONAL_HINTS.some((hint) => trimmed.includes(hint)) ||
    (/^\{[\s\S]*\}$/.test(trimmed) && /"(output|status|message|error|path|files_modified|content|matches|files|total_lines)"/.test(trimmed)) ||
    (/^\s*\d+\|/.test(trimmed) && trimmed.split('\n').length > 4);
}

function summarizeOperational(role: RuntimeRole, sections: TraceSection[]): string {
  if (role === 'system') return 'System event recorded. Details are tucked into receipts.';
  if (role === 'tool') return 'Tool output recorded. I folded the raw details into receipts.';
  const tools = sections.filter((s) => s.tone === 'tool' || s.tone === 'system').length;
  if (tools > 1) return `${tools} work artifacts recorded. Open receipts if you want the raw plumbing.`;
  return 'Work artifact recorded. Open receipts if you need the raw output.';
}

function buildMessageDisplay(content: string, role: RuntimeRole): MessageDisplay {
  const reasoning = pullReasoning(content);
  const tools = pullToolBlocks(reasoning.stripped);
  let answer = compactText(tools.stripped);
  const traceSections = [...reasoning.sections, ...tools.sections];
  const conversationalRole = role === 'user' || role === 'nero' || role === 'assistant';

  if ((!conversationalRole && answer) || (looksOperational(answer) && role !== 'user')) {
    traceSections.push({ label: 'Raw work output', tone: 'system', text: answer });
    answer = summarizeOperational(role, traceSections);
    return { answer, traceSections, operationalOnly: true };
  }

  if (!answer && traceSections.length > 0) {
    answer = role === 'nero'
      ? 'I have hidden the working notes so the conversation stays readable.'
      : 'Working notes recorded.';
  }

  return {
    answer: answer || '…',
    traceSections,
    operationalOnly: false,
  };
}

export function MessageCard(props: MessageCardProps) {
  if (props.message.role === 'action-summary') {
    return <ActionSummaryCard {...props} />;
  }

  return <StandardMessageCard {...props} />;
}

function StandardMessageCard({ message, isHighlighted, isStreaming, isNew, isChildSession }: MessageCardProps) {
  const runtimeRole = message.role as RuntimeRole;
  const display = useMemo(() => buildMessageDisplay(message.content, runtimeRole), [message.content, runtimeRole]);
  const [traceExpanded, setTraceExpanded] = useState(false);

  const isUser = runtimeRole === 'user';
  const isNero = runtimeRole === 'nero' || runtimeRole === 'assistant';
  const isTool = runtimeRole === 'tool';
  const isSystem = runtimeRole === 'system' || isTool;
  const hasTrace = display.traceSections.length > 0;
  const traceWordCount = display.traceSections.reduce((acc, section) => acc + section.text.split(/\s+/).filter(Boolean).length, 0);

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
    <article
      className={cn(
        'group relative flex w-full transition-all duration-300',
        isUser ? 'justify-end' : 'justify-start',
        isNew && 'msg-enter'
      )}
    >
      {isHighlighted && (
        <div
          className={cn(
            'absolute top-3 bottom-3 w-1 rounded-full',
            isUser ? 'right-0' : 'left-0'
          )}
          style={{ background: 'var(--mb-brass)' }}
        />
      )}

      <div
        className={cn(
          'message-card-premium flex gap-3 rounded-2xl border px-4 py-3.5',
          isUser && 'message-card-user ml-auto flex-row-reverse',
          isNero && 'message-card-nero',
          isSystem && 'message-card-system',
          isStreaming && 'message-card-streaming',
          isChildSession && !isUser && 'message-card-child',
          display.operationalOnly && 'message-card-folded'
        )}
      >
        <div className={cn('message-avatar flex-shrink-0', isUser ? 'message-avatar-user' : isNero ? 'message-avatar-nero' : 'message-avatar-system')} aria-hidden="true">
          {isUser ? 'G' : isNero ? 'N' : isTool ? 'T' : '•'}
        </div>

        <div className={cn('min-w-0 flex-1', isUser && 'text-right')}>
          <div className={cn('mb-1.5 flex items-center gap-2', isUser ? 'justify-end' : 'justify-start')}>
            <span className={cn('text-[10px] font-semibold uppercase tracking-[0.22em]', isUser ? 'text-signal-teal' : isNero ? 'text-nero-brass' : 'text-ash')}>
              {isUser ? 'Gbemi' : isNero ? 'Nero' : isTool ? 'Tool' : 'System'}
            </span>
            {display.operationalOnly && (
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[9px] uppercase tracking-[0.16em] text-ash">
                folded
              </span>
            )}
          </div>

          <div className={cn('message-copy text-sm leading-7', isUser ? 'text-ivory' : 'text-ivory/90')}>
            <MotionText
              text={display.answer}
              className="whitespace-pre-wrap"
              isStreaming={isStreaming}
            />
            {streamingCursor}
          </div>

          <AnimatePresence initial={false}>
            {hasTrace && (
              <motion.div
                className={cn('mt-3', isUser && 'flex flex-col items-end')}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
              >
                <button
                  type="button"
                  onClick={() => setTraceExpanded((v) => !v)}
                  className={cn(
                    'work-trace-toggle inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.16em] transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0',
                    traceExpanded && 'is-open'
                  )}
                  aria-expanded={traceExpanded}
                >
                  <span className="work-trace-dot" aria-hidden="true" />
                  <span>{traceExpanded ? 'Hide receipts' : 'Receipts'}</span>
                  <span className="normal-case tracking-normal text-ash">
                    {display.traceSections.length} item{display.traceSections.length !== 1 ? 's' : ''}
                    {traceWordCount ? ` · ${traceWordCount < 100 ? `${traceWordCount}w` : `${Math.round(traceWordCount / 100) * 100}w+`}` : ''}
                  </span>
                  <motion.span
                    aria-hidden="true"
                    animate={{ rotate: traceExpanded ? 90 : 0 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                  >
                    ›
                  </motion.span>
                </button>

                <motion.div
                  initial={false}
                  animate={traceExpanded ? { opacity: 1, height: 'auto', marginTop: 10 } : { opacity: 0, height: 0, marginTop: 0 }}
                  transition={{ type: 'spring', stiffness: 360, damping: 34 }}
                  style={{ overflow: 'hidden' }}
                  className="w-full"
                >
                  <div className="work-trace-panel">
                    {display.traceSections.map((section, idx) => (
                      <section key={`${section.label}-${idx}`} className={cn('work-trace-section', `trace-${section.tone}`)}>
                        <div className="mb-1.5 flex items-center justify-between gap-3">
                          <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-ash">
                            {section.label}
                          </span>
                          <span className="text-[9px] text-ash-muted">#{idx + 1}</span>
                        </div>
                        <pre className="work-trace-pre">{section.text}</pre>
                      </section>
                    ))}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <span className={cn('mt-2 block text-[10px] font-mono text-ash-muted', isUser && 'text-right')}>
            <MessageTimestamp isoString={message.timestamp} />
          </span>
        </div>
      </div>
    </article>
  );
}

function ActionSummaryCard({ message, isHighlighted, isNew }: MessageCardProps) {
  return (
    <article
      className={cn('flex justify-center px-6 py-2 transition-all duration-300', isNew && 'msg-enter')}
    >
      <div
        className="action-summary-premium rounded-2xl border px-4 py-3"
        style={{
          boxShadow: isHighlighted ? '0 0 0 2px rgba(201,160,58,0.25)' : undefined,
        }}
      >
        <div className="mb-1 flex items-center gap-2">
          <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-signal-violet">
            Action summary
          </span>
          <span className="text-[10px] font-mono text-ash-muted">
            <MessageTimestamp isoString={message.timestamp} />
          </span>
        </div>
        <p className="text-sm leading-6 text-ivory-dim">{message.content}</p>
      </div>
    </article>
  );
}
