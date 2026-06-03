'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSignalLoomStore } from '@/lib/store';
import { addressAgentPrompt, agentIdentityFromDetection } from '@/lib/agent-identity';
import { getComposerConnectionGate } from '@/lib/status-truth';
import { useHermesDetection } from '@/lib/use-hermes-detection';
import type { ComposerMode } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ComposerProps {
  threadId: string;
}

type ModeConfig = {
  label: string;
  hint: string;
  placeholder: (agentName: string) => string;
  scaffold: string;
  chips: Array<{ label: string; prompt: string }>;
};

const DRAFT_STORAGE_PREFIX = 'signal-loom:draft:v1:';

type SlashCommand = { command: string; label: string; prompt: string };

const SLASH_COMMANDS: SlashCommand[] = [
  { command: '/plan', label: 'Plan mode', prompt: 'Write a concise implementation plan with files, risks, stop points, and verification commands. Do not edit yet.' },
  { command: '/review', label: 'Review mode', prompt: 'Review this for correctness, regressions, accessibility, security/privacy risks, and missing evidence.' },
  { command: '/debug', label: 'Debug mode', prompt: 'Debug this systematically: reproduce, isolate root cause, patch the smallest safe fix, then verify.' },
  { command: '/research', label: 'Research mode', prompt: 'Research this with sources, separate facts from assumptions, and give a recommendation.' },
  { command: '/handoff', label: 'Handoff mode', prompt: 'Create a continuation handoff with active state, files changed, commands run, blockers, and next move.' },
  { command: '/resume', label: 'Resume session', prompt: 'Resume this Hermes session. Re-check live state first, then continue from the verified context.' },
  { command: '/watcher', label: 'Draft watcher', prompt: 'Draft a Hermes cron/watch job with schedule, trigger condition, delivery target, safety notes, and approval gate. Do not create it until I approve.' },
];

const MODE_CONFIG: Record<ComposerMode, ModeConfig> = {
  chat: {
    label: 'Chat',
    hint: 'plain conversation',
    placeholder: (agentName) => `Ask ${agentName} to synthesize, route, or decide…`,
    scaffold: 'Give me the useful answer, the tradeoffs, and the next move.',
    chips: [
      { label: 'Decision', prompt: 'give me the decision, risks, tradeoffs, and exact next move for this thread.' },
      { label: 'Split task', prompt: 'Split this into the right Hermes helper tasks and tell me what each helper should do before acting.' },
      { label: 'Recall', prompt: 'Search prior Hermes sessions for relevant context, then continue from the useful facts only.' },
    ],
  },
  plan: {
    label: 'Plan',
    hint: 'scope before acting',
    placeholder: (agentName) => `Ask ${agentName} for a tight plan before execution…`,
    scaffold: 'Write a concise implementation plan with files, steps, verification commands, risks, and stop points. Do not edit yet.',
    chips: [
      { label: 'Plan', prompt: 'Write a concise implementation plan with files, steps, verification commands, risks, and stop points. Do not edit yet.' },
      { label: 'Tradeoffs', prompt: 'Compare the two safest implementation routes, then recommend one.' },
      { label: 'Precheck', prompt: 'Inspect relevant repo state and prerequisites before proposing edits.' },
    ],
  },
  execute: {
    label: 'Execute',
    hint: 'do the work safely',
    placeholder: (agentName) => `Tell ${agentName} exactly what to build or fix…`,
    scaffold: 'Implement this in the current repo. Re-check live state first, keep the diff scoped, and run the appropriate verification before claiming completion.',
    chips: [
      { label: 'Implement', prompt: 'Implement this in the current repo. Re-check live state first, keep the diff scoped, and run the appropriate verification before claiming completion.' },
      { label: 'Fix bug', prompt: 'Diagnose the root cause first, then patch the smallest safe fix and verify it.' },
      { label: 'Refactor', prompt: 'Refactor this without changing behavior; call out any risky seams and verify before/after.' },
    ],
  },
  review: {
    label: 'Review',
    hint: 'Argus pass',
    placeholder: (agentName) => `Ask ${agentName} to review evidence, risks, and regressions…`,
    scaffold: 'Review this work for correctness, regressions, browser behavior, accessibility, security/privacy risks, and missing verification evidence.',
    chips: [
      { label: 'QA', prompt: 'Run an Argus QA pass: regressions, browser behavior, security/privacy risks, and evidence needed before completion.' },
      { label: 'Risk', prompt: 'List related risks, unrelated residuals, and what must be fixed before pass.' },
      { label: 'Approve', prompt: 'Review this approval gate and tell me approve, revise, or block with the safest next action.' },
    ],
  },
  debug: {
    label: 'Debug',
    hint: 'root cause lane',
    placeholder: (agentName) => `Ask ${agentName} to isolate the failing path…`,
    scaffold: 'Debug this systematically: reproduce, isolate likely cause, patch only after evidence, then verify the exact failure is gone.',
    chips: [
      { label: 'Repro', prompt: 'Reproduce the issue first and show the smallest failing signal before changing code.' },
      { label: 'Trace', prompt: 'Trace the data/control flow that makes this happen, then name the root cause.' },
      { label: 'Verify fix', prompt: 'After the fix, rerun the focused failing lane and one broad regression lane.' },
    ],
  },
  research: {
    label: 'Research',
    hint: 'Scout evidence',
    placeholder: (agentName) => `Ask ${agentName} to gather evidence before recommending…`,
    scaffold: 'Research this with sources, separate facts from assumptions, and return a recommendation with confidence and open questions.',
    chips: [
      { label: 'Sources', prompt: 'Research this with sources, separate facts from assumptions, and return a recommendation with confidence and open questions.' },
      { label: 'Compare', prompt: 'Compare the top options by evidence, cost, risk, and implementation effort.' },
      { label: 'Last 30d', prompt: 'Check current/latest sources first, then summarize what changed recently.' },
    ],
  },
  handoff: {
    label: 'Handoff',
    hint: 'continuation brief',
    placeholder: (agentName) => `Ask ${agentName} for a safe continuation handoff…`,
    scaffold: 'Create a handoff with active state, completed actions, files changed, commands run, verification evidence, blockers, risks, and the exact next operator move.',
    chips: [
      { label: 'Handoff', prompt: 'Create a handoff with active state, completed actions, files changed, commands run, verification evidence, blockers, risks, and the exact next operator move.' },
      { label: 'Evidence', prompt: 'Summarize only the verified evidence from this thread and flag anything historical/unverified.' },
      { label: 'Next move', prompt: 'Tell the next operator where to continue and what to verify before editing.' },
    ],
  },
};

export function Composer({ threadId }: ComposerProps) {
  const {
    composerState,
    sendMessage,
    sendStreamingMessage,
    composerDraft,
    composerMode,
    setComposerMode,
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
  const draftHydratedRef = useRef(false);

  const { isSending, error, lastSentAt } = composerState;
  const connectionGate = getComposerConnectionGate({ detection, loading: detectionLoading });
  const agentIdentity = agentIdentityFromDetection(detection?.identity);
  const modeConfig = MODE_CONFIG[composerMode];
  const draftStorageKey = DRAFT_STORAGE_PREFIX + threadId;
  const slashQuery = value.trimStart().startsWith('/') && !value.includes('\n') ? value.trim().toLowerCase() : '';
  const slashMatches = slashQuery
    ? SLASH_COMMANDS.filter((item) => item.command.startsWith(slashQuery) || item.label.toLowerCase().includes(slashQuery.slice(1))).slice(0, 5)
    : [];
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
    try { window.localStorage.removeItem(draftStorageKey); } catch {}
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
    if (e.key === 'Escape' && shortcutsOpen) {
      e.preventDefault();
      setShortcutsOpen(false);
      return;
    }
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

  useEffect(() => {
    if (!shortcutsOpen) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setShortcutsOpen(false);
        queueMicrotask(() => textareaRef.current?.focus());
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [shortcutsOpen]);

  useEffect(() => {
    draftHydratedRef.current = false;
    const timer = window.setTimeout(() => {
      try {
        setValue(window.localStorage.getItem(draftStorageKey) ?? '');
      } catch {
        setValue('');
      } finally {
        draftHydratedRef.current = true;
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [draftStorageKey]);

  useEffect(() => {
    if (!draftHydratedRef.current) return;
    try {
      if (value.trim()) window.localStorage.setItem(draftStorageKey, value);
      else window.localStorage.removeItem(draftStorageKey);
    } catch {
      // Local drafts are a convenience, not a send dependency.
    }
  }, [draftStorageKey, value]);

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
  const commandChips = modeConfig.chips.map((chip) => ({
    ...chip,
    prompt: addressAgentPrompt(agentIdentity, chip.prompt),
  }));

  const applyChip = (prompt: string) => {
    setValue((current) => current.trim() ? current.trimEnd() + '\n\n' + prompt : prompt);
    queueMicrotask(() => textareaRef.current?.focus());
  };

  const applySlashCommand = (command: SlashCommand) => {
    setValue(command.prompt);
    queueMicrotask(() => textareaRef.current?.focus());
  };

  return (
    <div
      className="composer-shell border-t px-4 py-3 sm:px-5"
      style={{
        background: 'var(--sl-surface)',
        borderColor: 'var(--sl-rule-hairline)',
        boxShadow: 'none',
      }}
    >
      {/* Error banner */}
      {error && (
        <div
          className="flex items-center justify-between mb-2 rounded-[var(--sl-radius-card)] px-3 py-2 text-xs"
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
            'mb-2 flex flex-wrap items-center justify-between gap-2 rounded-[var(--sl-radius-card)] border px-3 py-2 text-xs leading-5',
            connectionGate.tone === 'danger' && 'text-signal-red',
            connectionGate.tone === 'warn' && 'text-brass',
            connectionGate.tone === 'neutral' && 'text-ash'
          )}
          style={{
            background: connectionGate.tone === 'danger'
              ? 'color-mix(in srgb, var(--sl-surface-flat) 92%, var(--sl-danger) 8%)'
              : connectionGate.tone === 'warn'
                ? 'color-mix(in srgb, var(--sl-surface-flat) 92%, var(--sl-decision) 8%)'
                : 'var(--sl-surface-flat)',
            borderColor: connectionGate.tone === 'danger'
              ? 'var(--sl-danger-edge)'
              : connectionGate.tone === 'warn'
                ? 'var(--sl-decision-edge)'
                : 'var(--sl-rule-hairline)',
          }}
        >
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-ivory-dim">{connectionGate.reason}</div>
            <div className="mt-0.5 text-ash">{connectionGate.detail}</div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={refreshDetection} className="min-h-9 rounded-[var(--sl-radius-control)] border border-white/10 bg-black/15 px-3 text-[11px] font-semibold text-ivory-dim transition hover:border-signal-teal/30 hover:text-signal-teal">
              Re-check
            </button>
            <button type="button" onClick={openHermesSettings} disabled={detectionLoading} className="min-h-9 rounded-[var(--sl-radius-control)] border border-brass/30 bg-brass-dim px-3 text-[11px] font-semibold text-brass transition hover:border-brass/50 disabled:cursor-wait disabled:opacity-55">
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
          className={cn(
            'composer-options-trigger rounded-[var(--sl-radius-control)] border border-white/10 bg-black/15 px-3 py-1.5 text-[11px] font-mono text-ivory-dim transition-all duration-150 hover:border-brass/30 hover:text-brass',
            shortcutsOpen && 'is-open'
          )}
          aria-expanded={shortcutsOpen}
        >
          {shortcutsOpen ? 'Close options' : `${modeConfig.label} mode`}
        </button>
        <span className="hidden truncate sm:inline">
          {modeConfig.hint} · {streamingMode ? 'live reply bubble' : 'direct send'} · Enter sends
        </span>
      </div>

      <AnimatePresence initial={false}>
        {shortcutsOpen && (
          <motion.div
            key="composer-options-panel"
            initial={{ opacity: 0, y: 6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: 4, height: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="composer-options-panel mb-2 overflow-hidden rounded-[var(--sl-radius-card)] border p-2.5"
            style={{
              background: 'var(--sl-surface-flat)',
              borderColor: 'var(--sl-rule-hairline)',
              boxShadow: 'none',
            }}
          >
            <div className="mb-2 flex items-center justify-between gap-3 border-b border-white/5 pb-2">
              <div>
                <span className="block text-[10px] font-mono uppercase tracking-[0.2em] text-ash-muted">Composer mode</span>
                <span className="mt-0.5 hidden text-[10px] text-ash-muted sm:block">Esc closes this panel · Shift+Enter adds a line</span>
              </div>
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

            <div className="composer-mode-grid mb-2" role="radiogroup" aria-label="Composer mode">
              {(Object.keys(MODE_CONFIG) as ComposerMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={composerMode === mode}
                  onClick={() => setComposerMode(mode)}
                  className={cn('composer-mode-button', composerMode === mode && 'is-active')}
                  title={MODE_CONFIG[mode].hint}
                >
                  <span>{MODE_CONFIG[mode].label}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              className="composer-scaffold-button mb-2 w-full rounded-[var(--sl-radius-control)] border border-brass/20 bg-black/15 px-3 py-2 text-left text-[11px] text-ivory-dim transition hover:border-brass/40 hover:text-brass"
              onClick={() => applyChip(addressAgentPrompt(agentIdentity, modeConfig.scaffold))}
              disabled={isSending}
            >
              Insert {modeConfig.label.toLowerCase()} scaffold
              <span className="mt-0.5 block text-[10px] text-ash-muted">Adds text to the draft only. Nothing sends until you press Send.</span>
            </button>

            <div className="composer-shortcuts flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-ash">
              {commandChips.map((chip, index) => (
                <motion.button
                  type="button"
                  key={chip.label}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.018, 0.09), duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                  onClick={() => {
                    applyChip(chip.prompt);
                    setShortcutsOpen(false);
                  }}
                  disabled={isSending}
                  className="rounded-[var(--sl-radius-control)] border border-white/10 bg-black/20 px-2.5 py-1.5 transition-all duration-150 hover:-translate-y-0.5 hover:border-brass/30 hover:bg-brass/10 disabled:opacity-40"
                  style={{ color: 'var(--mb-ivory-dim)' }}
                >
                  {chip.label}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {slashMatches.length > 0 && (
        <div className="composer-slash-panel" role="listbox" aria-label="Slash command suggestions">
          {slashMatches.map((command) => (
            <button key={command.command} type="button" onClick={() => applySlashCommand(command)} className="composer-slash-command" role="option" aria-selected="false">
              <strong>{command.command}</strong>
              <span>{command.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Composer input row */}
      <div className="flex items-end gap-2">
        {/* Input area */}
        <div
          className={cn(
            'composer-input-frame composer-flat-input boxed-corner-mark flex flex-1 items-end gap-2 rounded-[var(--sl-radius-card)] border px-3.5 py-2.5 transition-all',
            canSend && 'is-ready',
            streamingMode && 'composer-streaming'
          )}
          style={{
            background: 'var(--sl-surface-raised)',
            borderColor: canSend
              ? streamingMode
                ? 'var(--sl-active-edge)'
                : 'var(--sl-danger-edge)'
              : error
              ? 'var(--sl-danger-edge)'
              : 'var(--sl-rule-visible)',
            borderLeft: `3px solid ${canSend ? (streamingMode ? 'var(--sl-active-edge)' : 'var(--sl-danger-edge)') : error ? 'var(--sl-danger-edge)' : 'var(--sl-rule-hairline)'}`,
            boxShadow: 'none',
            transitionProperty: 'border-color',
            transitionDuration: '200ms',
            transitionTimingFunction: 'ease',
          }}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={modeConfig.placeholder(agentIdentity.name)}
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
              'composer-icon-button flex h-11 flex-shrink-0 items-center justify-center rounded-[var(--sl-radius-control)] transition-all duration-150',
              connectionGate.blocked ? 'w-auto px-3 text-[11px] font-semibold' : 'w-11',
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

      {/* Footer hint — keep runtime activity inside the transcript bubble, not above the composer. */}
      {!isSending && lastSentAt && (
        <p className="mt-1.5 flex items-center gap-2 px-1 text-xs text-ash-muted">
          <span>Last sent {new Date(lastSentAt).toLocaleTimeString()}</span>
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
