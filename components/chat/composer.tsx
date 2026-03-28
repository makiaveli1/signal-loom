'use client';

import { useState, useRef, useEffect } from 'react';
import { useSignalLoomStore } from '@/lib/store';
import { cn } from '@/lib/utils';

interface ComposerProps {
  threadId: string;
}

export function Composer({ threadId }: ComposerProps) {
  const { composerState, sendMessage } = useSignalLoomStore();
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { isSending, error, lastSentAt } = composerState;

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
    await sendMessage(threadId, trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Focus management
  useEffect(() => {
    if (!isSending && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isSending]);

  return (
    <div
      className="px-4 py-3 border-t"
      style={{
        background: 'var(--mb-shell)',
        borderColor: 'rgba(255,255,255,0.05)',
      }}
    >
      {/* Sending / error indicator */}
      {isSending && (
        <div
          className="flex items-center gap-2 mb-2 text-xs font-mono"
          style={{ color: 'var(--mb-brass)' }}
        >
          <span className="animate-pulse">◷</span>
          <span>Sending...</span>
        </div>
      )}

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

      {/* Composer input area */}
      <div
        className="flex items-end gap-2 px-3 py-2.5 rounded-lg border transition-all duration-150"
        style={{
          background: 'var(--mb-panel)',
          borderColor: value.trim()
            ? 'rgba(232,96,58,0.25)'
            : error
            ? 'rgba(232,96,58,0.30)'
            : 'rgba(255,255,255,0.08)',
          boxShadow:
            value.trim()
              ? '0 0 0 1px rgba(232,96,58,0.10), inset 0 0 0 1px rgba(232,96,58,0.05)'
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
          placeholder="Message Nero..."
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
            value.trim() && !isSending
              ? 'cursor-pointer'
              : 'cursor-not-allowed'
          )}
          style={{
            background: value.trim() && !isSending ? 'var(--mb-red)' : 'var(--mb-graphite)',
            color: value.trim() && !isSending ? 'var(--mb-ivory)' : 'var(--mb-ash-muted)',
            transform: value.trim() && !isSending ? 'scale(1)' : 'scale(0.95)',
            opacity: value.trim() || isSending ? 1 : 0.6,
          }}
          disabled={!value.trim() || isSending}
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

      {/* Footer hint */}
      <p className="text-xs text-ash-muted mt-1.5 px-1">
        {isSending
          ? 'Sending...'
          : lastSentAt
          ? `Sent at ${new Date(lastSentAt).toLocaleTimeString()}`
          : 'Nero is monitoring · routing is live'}
      </p>
    </div>
  );
}
