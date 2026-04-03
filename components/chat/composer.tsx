'use client';

import { useState, useRef, useEffect } from 'react';
import { useSignalLoomStore } from '@/lib/store';
import { cn } from '@/lib/utils';

interface ComposerProps {
  threadId: string;
}

/** Streaming mode indicator — shows progressive response as it arrives */
function StreamingIndicator({ text }: { text: string }) {
  const PREVIEW_LEN = 300;
  const preview = text.length > PREVIEW_LEN
    ? text.slice(0, PREVIEW_LEN) + '…'
    : text;

  return (
    <div
      className="mb-2 px-3 py-2.5 rounded-lg border text-xs"
      style={{
        background: 'rgba(0,200,150,0.04)',
        borderColor: 'rgba(0,200,150,0.15)',
        color: 'var(--mb-ivory-dim)',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: 'var(--mb-teal)', animation: 'pulse-dot 1s ease-in-out infinite' }}
        />
        <span
          className="text-[10px] font-mono uppercase tracking-widest"
          style={{ color: 'var(--mb-teal)' }}
        >
          Streaming
        </span>
        <span className="text-ivory/20 ml-auto text-[10px]">
          {text.length} chars
        </span>
      </div>
      {/* Progressive text preview */}
      <p className="leading-relaxed whitespace-pre-wrap break-words text-ivory/80">
        {preview}
      </p>
    </div>
  );
}

export function Composer({ threadId }: ComposerProps) {
  const { composerState, sendMessage, sendStreamingMessage } = useSignalLoomStore();
  const [value, setValue] = useState('');
  const [streamingMode, setStreamingMode] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { isSending, isStreaming, streamingResponse, error, lastSentAt } = composerState;

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    const el = e.currentTarget;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const handleSend = async () => {
    const trimmed = value.trim();
    if (!trimmed || isSending) return;
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    if (streamingMode) {
      await sendStreamingMessage(threadId, trimmed);
    } else {
      await sendMessage(threadId, trimmed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Focus management — don't steal focus from textarea while typing
  useEffect(() => {
    if (!isSending && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isSending]);

  const canSend = value.trim().length > 0 && !isSending;

  return (
    <div
      className="px-4 py-3 border-t"
      style={{
        background: 'var(--mb-shell)',
        borderColor: 'rgba(255,255,255,0.05)',
      }}
    >
      {/* Streaming indicator — shows progressive response */}
      {isStreaming && streamingResponse !== null && (
        <StreamingIndicator text={streamingResponse} />
      )}

      {/* Sending indicator (non-streaming) */}
      {isSending && !isStreaming && (
        <div
          className="flex items-center gap-2 mb-2 text-xs font-mono"
          style={{ color: 'var(--mb-brass)' }}
        >
          <span className="animate-pulse">◷</span>
          <span>Sending…</span>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div
          className="flex items-center justify-between mb-2 px-3 py-2 rounded-lg text-xs"
          style={{
            background: 'rgba(232,96,58,0.10)',
            border: '1px solid rgba(232,96,58,0.25)',
            color: 'var(--mb-red)',
          }}
        >
          <span>{error}</span>
          <button
            onClick={() => useSignalLoomStore.getState().clearComposerError()}
            className="underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Composer input row */}
      <div className="flex items-end gap-2">
        {/* Stream mode toggle */}
        <button
          onClick={() => setStreamingMode((v) => !v)}
          title={streamingMode ? 'Disable streaming mode' : 'Enable streaming mode — streams response in real time'}
          className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-all duration-150 mb-0.5"
          style={{
            background: streamingMode
              ? 'rgba(0,200,150,0.15)'
              : 'rgba(255,255,255,0.04)',
            border: streamingMode
              ? '1px solid rgba(0,200,150,0.30)'
              : '1px solid rgba(255,255,255,0.08)',
            color: streamingMode ? 'var(--mb-teal)' : 'var(--mb-ash-muted)',
            cursor: isSending ? 'not-allowed' : 'pointer',
            opacity: isSending ? 0.5 : 1,
          }}
          disabled={isSending}
          aria-label={streamingMode ? 'Streaming mode on — click to disable' : 'Streaming mode off — click to enable'}
        >
          {/* Lightning bolt SVG */}
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path
              d="M7 1L3 7H6L5 11L9 5H6L7 1Z"
              fill="currentColor"
              stroke="currentColor"
              strokeWidth="0.5"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* Input area */}
        <div
          className="flex-1 flex items-end gap-2 px-3 py-2.5 rounded-lg border transition-all duration-150"
          style={{
            background: 'var(--mb-panel)',
            borderColor: canSend
              ? streamingMode
                ? 'rgba(0,200,150,0.25)'
                : 'rgba(232,96,58,0.25)'
              : error
              ? 'rgba(232,96,58,0.30)'
              : 'rgba(255,255,255,0.08)',
            boxShadow: canSend
              ? streamingMode
                ? '0 0 0 1px rgba(0,200,150,0.10), inset 0 0 0 1px rgba(0,200,150,0.05)'
                : '0 0 0 1px rgba(232,96,58,0.10), inset 0 0 0 1px rgba(232,96,58,0.05)'
              : error
              ? '0 0 0 1px rgba(232,96,58,0.15)'
              : 'none',
          }}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Message Nero…"
            rows={1}
            disabled={isSending}
            className={cn(
              'flex-1 bg-transparent text-sm text-ivory placeholder:text-ash-muted resize-none outline-none leading-relaxed',
              isSending && 'opacity-50'
            )}
            style={{ minHeight: '22px', maxHeight: '120px' }}
          />
          <button
            onClick={handleSend}
            className={cn(
              'flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-all duration-150',
              canSend ? 'cursor-pointer' : 'cursor-not-allowed'
            )}
            style={{
              background: canSend
                ? streamingMode
                  ? 'var(--mb-teal)'
                  : 'var(--mb-red)'
                : 'var(--mb-graphite)',
              color: canSend
                ? 'var(--mb-ivory)'
                : 'var(--mb-ash-muted)',
              transform: canSend ? 'scale(1)' : 'scale(0.95)',
              opacity: canSend || isSending ? 1 : 0.6,
            }}
            disabled={!canSend}
            aria-label="Send message"
          >
            {isSending ? (
              <span className="animate-spin" style={{ fontSize: '10px' }}>◷</span>
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M1 6L11 1L6 11L5 7L1 6Z" fill="currentColor" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Footer hint */}
      <p className="text-xs text-ash-muted mt-1.5 px-1 flex items-center gap-2">
        {isSending && !isStreaming && <span>Sending…</span>}
        {isSending && isStreaming && <span className="animate-pulse">◷ Streaming response…</span>}
        {!isSending && lastSentAt && (
          <span>Last sent {new Date(lastSentAt).toLocaleTimeString()}</span>
        )}
        {!isSending && !lastSentAt && (
          <span>
            <span
              className="inline-flex items-center gap-1"
              style={{ color: streamingMode ? 'var(--mb-teal)' : 'var(--mb-ash-muted)' }}
            >
              {streamingMode && (
                <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                  <path d="M7 1L3 7H6L5 11L9 5H6L7 1Z" fill="currentColor" />
                </svg>
              )}
              {streamingMode ? 'Streaming mode · Enter to send' : 'Nero is monitoring · routing is live'}
            </span>
          </span>
        )}
      </p>

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
