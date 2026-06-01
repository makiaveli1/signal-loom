'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSignalLoomStore } from '@/lib/store';
import { addressAgentPrompt, agentIdentityFromDetection } from '@/lib/agent-identity';
import { getComposerConnectionGate } from '@/lib/status-truth';
import { useHermesDetection } from '@/lib/use-hermes-detection';
import { cn } from '@/lib/utils';

interface ComposerProps {
  threadId: string;
}

/** Live streaming HUD — connection state, throughput, and progressive preview. */
function StreamingIndicator({
  text,
  status,
  chunks,
  charsPerSecond,
  lastChunkAt,
}: {
  text: string;
  status: string;
  chunks: number;
  charsPerSecond: number;
  lastChunkAt: string | null;
}) {
  const PREVIEW_LEN = 420;
  const preview = text.length > PREVIEW_LEN
    ? text.slice(Math.max(0, text.length - PREVIEW_LEN))
    : text;
  const statusLabel = status === 'connecting'
    ? 'Opening stream'
    : status === 'finalizing'
      ? 'Finalizing'
      : status === 'error'
        ? 'Stream needs attention'
        : 'Streaming live';
  const freshness = lastChunkAt ? new Date(lastChunkAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'waiting';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32, mass: 0.7 }}
      className="streaming-hud mb-2 overflow-hidden rounded-2xl border px-3.5 py-3 text-xs"
      style={{
        background: 'linear-gradient(135deg, rgba(61,201,196,0.10), rgba(201,160,58,0.055), rgba(0,0,0,0.18))',
        borderColor: status === 'error' ? 'rgba(232,96,58,0.28)' : 'rgba(61,201,196,0.24)',
        boxShadow: '0 18px 45px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.05)',
        color: 'var(--mb-ivory-dim)',
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal-teal opacity-40" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-signal-teal" />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-signal-teal">
          {statusLabel}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5 font-mono text-[10px] text-ash">
          <span className="rounded-full border border-white/10 bg-black/15 px-2 py-0.5">{chunks} frames</span>
          <span className="rounded-full border border-white/10 bg-black/15 px-2 py-0.5">{text.length} chars</span>
          <span className="rounded-full border border-white/10 bg-black/15 px-2 py-0.5">{charsPerSecond}/s</span>
          <span className="rounded-full border border-white/10 bg-black/15 px-2 py-0.5">last {freshness}</span>
        </div>
      </div>

      <div className="relative mt-2.5 overflow-hidden rounded-xl border border-white/10 bg-black/20 p-3">
        <motion.div
          className="absolute left-0 top-0 h-px bg-signal-teal"
          initial={{ width: '0%' }}
          animate={{ width: status === 'connecting' ? ['8%', '38%', '12%'] : ['35%', '100%', '55%'] }}
          transition={{ duration: status === 'connecting' ? 1.2 : 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <p className="max-h-28 overflow-hidden whitespace-pre-wrap break-words leading-relaxed text-ivory/82">
          {preview || 'Waiting for the first token…'}
          <motion.span
            className="ml-0.5 inline-block h-3 w-1 rounded-sm bg-signal-teal align-[-2px]"
            animate={{ opacity: [1, 0.15, 1] }}
            transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden="true"
          />
        </p>
      </div>
    </motion.div>
  );
}

export function Composer({ threadId }: ComposerProps) {
  const {
    composerState,
    sendMessage,
    sendStreamingMessage,
    composerDraft,
    clearComposerDraft,
    hermesSettingsOpen,
    toggleHermesSettings,
  } = useSignalLoomStore();
  const { detection, loading: detectionLoading, refresh: refreshDetection } = useHermesDetection({ pollMs: 60_000 });
  const [value, setValue] = useState('');
  const [streamingMode, setStreamingMode] = useState(true);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [sendPulse, setSendPulse] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { isSending, isStreaming, streamingResponse, streamingStatus, streamingTokenCount, streamingCharsPerSecond, streamingLastChunkAt, error, lastSentAt } = composerState;
  const connectionGate = getComposerConnectionGate({ detection, loading: detectionLoading });
  const agentIdentity = agentIdentityFromDetection(detection?.identity);
  const showConnectionGate = connectionGate.blocked || connectionGate.tone === 'warn';

  const openHermesSettings = () => {
    if (!hermesSettingsOpen) toggleHermesSettings();
  };

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    // Sprint 10: Fire micro-interaction on send button when text becomes available
    if (!value.trim() && e.target.value.trim()) {
      setSendPulse(true);
      setTimeout(() => setSendPulse(false), 350);
    }
    const el = e.currentTarget;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const handleSend = async () => {
    const trimmed = value.trim();
    if (!trimmed || isSending || connectionGate.blocked) return;
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

  // Global command center can safely pre-fill the composer without auto-sending.
  useEffect(() => {
    if (!composerDraft) return;
    queueMicrotask(() => {
      setValue(composerDraft);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
        textareaRef.current.focus();
      }
      clearComposerDraft();
    });
  }, [clearComposerDraft, composerDraft]);

  const canSend = value.trim().length > 0 && !isSending && !connectionGate.blocked;
  const sendButtonDisabled = connectionGate.blocked ? detectionLoading || isSending : !canSend;
  const sendButtonLabel = connectionGate.blocked ? connectionGate.actionLabel : 'Send message';
  const commandChips = [
    { label: 'Decision', prompt: addressAgentPrompt(agentIdentity, 'give me the decision, risks, tradeoffs, and exact next move for this thread.') },
    { label: 'Split task', prompt: 'Split this into the right Hermes helper tasks and tell me what each helper should do before acting.' },
    { label: 'Recall', prompt: 'Search prior Hermes sessions for relevant context, then continue from the useful facts only.' },
    { label: 'Watcher', prompt: 'Design a safe Hermes cron/watch job for this need. Do not create it until I approve schedule and delivery.' },
    { label: 'Approve', prompt: 'Review this approval gate and tell me approve, revise, or block with the safest next action.' },
    { label: 'QA', prompt: 'Run an Argus QA pass: regressions, browser behavior, security/privacy risks, and evidence needed before completion.' },
  ];

  const applyChip = (prompt: string) => {
    setValue(prompt);
    queueMicrotask(() => textareaRef.current?.focus());
  };

  return (
    <div
      className="composer-shell border-t px-4 py-3 sm:px-5"
      style={{
        background: 'linear-gradient(180deg, color-mix(in srgb, var(--sl-shell) 92%, transparent), color-mix(in srgb, var(--sl-bg) 98%, transparent))',
        borderColor: 'var(--sl-border-soft)',
        boxShadow: '0 -18px 42px color-mix(in srgb, var(--sl-bg) 22%, transparent)',
      }}
    >
      {/* Streaming indicator — shows progressive response */}
      <AnimatePresence initial={false}>
        {isStreaming && streamingResponse !== null && (
          <StreamingIndicator
            text={streamingResponse}
            status={streamingStatus}
            chunks={streamingTokenCount}
            charsPerSecond={streamingCharsPerSecond}
            lastChunkAt={streamingLastChunkAt}
          />
        )}
      </AnimatePresence>

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

      {showConnectionGate && (
        <div
          role={connectionGate.blocked ? 'alert' : 'status'}
          className={cn(
            'mb-2 flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-3 py-2 text-xs leading-5',
            connectionGate.tone === 'danger' && 'border-signal-red/25 bg-signal-red/10 text-signal-red',
            connectionGate.tone === 'warn' && 'border-brass/25 bg-brass/10 text-brass',
            connectionGate.tone === 'neutral' && 'border-white/10 bg-white/[0.03] text-ash'
          )}
        >
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-ivory-dim">{connectionGate.reason}</div>
            <div className="mt-0.5 text-ash">{connectionGate.detail}</div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={refreshDetection} className="min-h-9 rounded-full border border-white/10 bg-black/15 px-3 text-[11px] font-semibold text-ivory-dim transition hover:border-signal-teal/30 hover:text-signal-teal">
              Re-check
            </button>
            <button type="button" onClick={openHermesSettings} disabled={detectionLoading} className="min-h-9 rounded-full border border-brass/30 bg-brass-dim px-3 text-[11px] font-semibold text-brass transition hover:border-brass/50 disabled:cursor-wait disabled:opacity-55">
              {connectionGate.actionLabel}
            </button>
          </div>
        </div>
      )}

      {/* Composer options — one quiet affordance instead of a row of tiny always-visible controls */}
      <div className="composer-quiet-row mb-2 flex items-center justify-between gap-3 text-[11px] text-ash">
        <button
          type="button"
          onClick={() => setShortcutsOpen((v) => !v)}
          className="composer-options-trigger rounded-full border border-white/10 bg-black/15 px-3 py-1.5 text-[11px] font-mono text-ivory-dim transition-all duration-150 hover:border-brass/30 hover:text-brass"
          aria-expanded={shortcutsOpen}
        >
          Options
        </button>
        <span className="hidden truncate sm:inline">
          {streamingMode ? 'Streaming replies · Enter sends' : 'Direct send · Enter sends'}
        </span>
      </div>

      {shortcutsOpen && (
        <div className="composer-options-panel mb-2 rounded-2xl border border-white/10 bg-black/15 p-2.5">
          <div className="mb-2 flex items-center justify-between gap-3 border-b border-white/5 pb-2">
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-ash-muted">Reply mode</span>
            <button
              type="button"
              onClick={() => setStreamingMode((v) => !v)}
              title={streamingMode ? 'Disable streaming mode' : 'Enable streaming mode — streams response in real time'}
              className="layout-pill rail-toggle"
              disabled={isSending}
              aria-pressed={streamingMode}
              aria-label={streamingMode ? 'Streaming mode on — click to disable' : 'Streaming mode off — click to enable'}
            >
              <span className="rail-toggle-dot" aria-hidden="true" />
              {streamingMode ? 'Streaming on' : 'Streaming off'}
            </button>
          </div>
          <div className="composer-shortcuts flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-ash">
            {commandChips.map((chip) => (
              <button
                type="button"
                key={chip.label}
                onClick={() => {
                  applyChip(chip.prompt);
                  setShortcutsOpen(false);
                }}
                disabled={isSending}
                className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1.5 transition-all duration-150 hover:-translate-y-0.5 hover:border-brass/30 hover:bg-brass/10 disabled:opacity-40"
                style={{ color: chip.label === 'Synthesize' ? 'var(--mb-brass)' : 'var(--mb-ivory-dim)' }}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Composer input row */}
      <div className="flex items-end gap-2">
        {/* Input area */}
        <div
          className="composer-input-frame composer-flat-input flex-1 flex items-end gap-2 rounded-2xl border px-3.5 py-2.5 transition-all"
          style={{
            background: 'linear-gradient(135deg, color-mix(in srgb, var(--sl-panel-raised) 96%, transparent), color-mix(in srgb, var(--sl-stage) 96%, transparent))',
            borderColor: canSend
              ? streamingMode
                ? 'color-mix(in srgb, var(--sl-success) 32%, transparent)'
                : 'color-mix(in srgb, var(--sl-danger) 32%, transparent)'
              : error
              ? 'color-mix(in srgb, var(--sl-danger) 36%, transparent)'
              : 'var(--sl-border-soft)',
            boxShadow: canSend
              ? streamingMode
                ? '0 0 0 1px color-mix(in srgb, var(--sl-success) 14%, transparent), inset 0 0 0 1px color-mix(in srgb, var(--sl-success) 8%, transparent)'
                : '0 0 0 1px color-mix(in srgb, var(--sl-danger) 14%, transparent), inset 0 0 0 1px color-mix(in srgb, var(--sl-danger) 8%, transparent)'
              : error
              ? '0 0 0 1px color-mix(in srgb, var(--sl-danger) 18%, transparent)'
              : 'none',
            transitionProperty: 'border-color, box-shadow',
            transitionDuration: '200ms',
            transitionTimingFunction: 'ease',
          }}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={`Ask ${agentIdentity.name} to synthesize, route, or decide…`}
            aria-label={`Message ${agentIdentity.name}`}
            rows={1}
            disabled={isSending}
            className={cn(
              'flex-1 bg-transparent text-sm text-ivory placeholder:text-ash resize-none outline-none leading-relaxed',
              isSending && 'opacity-50'
            )}
            style={{ minHeight: '2.5rem', maxHeight: '120px' }}
          />
          <button
            type="button"
            onClick={connectionGate.blocked ? openHermesSettings : handleSend}
            className={cn(
              'composer-icon-button flex h-9 flex-shrink-0 items-center justify-center rounded-xl transition-all duration-150',
              connectionGate.blocked ? 'w-auto px-3 text-[11px] font-semibold' : 'w-9',
              sendButtonDisabled ? 'cursor-not-allowed' : 'cursor-pointer',
              sendPulse && !connectionGate.blocked && 'composer-send-ready'
            )}
            style={{
              background: canSend
                ? streamingMode
                  ? 'var(--mb-teal)'
                  : 'var(--mb-red)'
                : connectionGate.blocked && !detectionLoading
                  ? 'var(--mb-brass-dim)'
                  : 'var(--mb-graphite)',
              color: canSend
                ? 'var(--mb-ivory)'
                : connectionGate.blocked && !detectionLoading
                  ? 'var(--mb-brass)'
                  : 'var(--mb-ash-muted)',
              transform: canSend || connectionGate.blocked ? 'scale(1)' : 'scale(0.95)',
              opacity: canSend || isSending || connectionGate.blocked ? 1 : 0.6,
            }}
            disabled={sendButtonDisabled}
            aria-label={sendButtonLabel}
          >
            {isSending || detectionLoading ? (
              <span className="animate-spin" style={{ fontSize: '10px' }}>◷</span>
            ) : connectionGate.blocked ? (
              <span>{connectionGate.actionLabel}</span>
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M1 6L11 1L6 11L5 7L1 6Z" fill="currentColor" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Footer hint — only appears when state changes, keeping the default composer calm. */}
      {(isSending || lastSentAt) && (
        <p className="mt-1.5 flex items-center gap-2 px-1 text-xs text-ash-muted">
          {isSending && !isStreaming && <span>Sending…</span>}
          {isSending && isStreaming && <span className="animate-pulse">Streaming response…</span>}
          {!isSending && lastSentAt && (
            <span>Last sent {new Date(lastSentAt).toLocaleTimeString()}</span>
          )}
        </p>
      )}

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
