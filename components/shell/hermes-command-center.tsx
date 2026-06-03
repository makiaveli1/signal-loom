'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { addressAgentPrompt, agentIdentityFromDetection } from '@/lib/agent-identity';
import { useSignalLoomStore } from '@/lib/store';
import { classifyDelegatedSessions } from '@/lib/status-truth';
import { useHermesDetection } from '@/lib/use-hermes-detection';
import { cn } from '@/lib/utils';

type Capability = {
  id: string;
  label: string;
  lane: string;
  actionClass: 'fills prompt' | 'opens panel' | 'safe' | 'requires approval';
  accent: 'teal' | 'brass' | 'red' | 'violet' | 'jade';
  description: string;
  prompt: string;
  helper: string;
};

const CAPABILITIES: Capability[] = [
  {
    id: 'decision',
    label: 'Summarise decision',
    lane: 'Operator',
    actionClass: 'fills prompt',
    accent: 'red',
    description: 'Pull out the decision, risks, and next step from the current chat.',
    helper: 'Use this when the chat is long and you need the point, not every detail.',
    prompt: '{agent}: synthesize the current thread into: 1) the actual decision, 2) risks/tradeoffs, 3) what you recommend I do next, and 4) what can be ignored.',
  },
  {
    id: 'delegate',
    label: 'Split the work',
    lane: 'Council',
    actionClass: 'fills prompt',
    accent: 'teal',
    description: 'Break a larger task into coding, research, design, QA, or business work.',
    helper: 'Use this when several parts can move at the same time.',
    prompt: '{agent}: split this task into the right work lanes. Say who owns what, what evidence each part needs, and give me a compact execution plan before acting.',
  },
  {
    id: 'session-recall',
    label: 'Recall context',
    lane: 'Session search',
    actionClass: 'fills prompt',
    accent: 'violet',
    description: 'Find useful past chats before making me repeat myself.',
    helper: 'Good for “where did we leave this?” and project continuity.',
    prompt: 'Search prior Hermes sessions for context related to this task, summarize only the durable facts that matter, then continue from there without making me repeat myself.',
  },
  {
    id: 'explain-hermes',
    label: 'Explain this screen',
    lane: 'Guide',
    actionClass: 'fills prompt',
    accent: 'jade',
    description: 'Turn the dense cockpit into a plain-English walkthrough.',
    helper: 'Good for first-time users or when the operator labels are too much.',
    prompt: 'Explain how to use this Hermes workspace in plain English: what Loom, Live Lanes, Approvals, Command, Settings, and the composer do. Include the first three actions a new user should try.',
  },
  {
    id: 'watcher',
    label: 'Create a watcher',
    lane: 'Cron',
    actionClass: 'requires approval',
    accent: 'jade',
    description: 'Plan a repeated check, alert, or briefing.',
    helper: 'Nothing is scheduled until you approve the exact schedule and message.',
    prompt: 'Design a Hermes cron/watch job for this need. Include schedule, trigger condition, delivery target, prompt/script shape, and safety notes. Do not create it until I approve.',
  },
  {
    id: 'skills',
    label: 'Choose skills/tools',
    lane: 'Skills',
    actionClass: 'fills prompt',
    accent: 'brass',
    description: 'Pick the best saved runbooks and tools for this job.',
    helper: 'Use this when the safest route is not obvious.',
    prompt: 'Inspect which Hermes skills/toolsets are relevant to this task, load the right ones, then give me the shortest safe execution path.',
  },
  {
    id: 'approval',
    label: 'Review risky action',
    lane: 'Argus',
    actionClass: 'requires approval',
    accent: 'red',
    description: 'Check pending approvals, sends, deletes, or other risky actions.',
    helper: 'Use this before anything public, expensive, or hard to undo.',
    prompt: 'Review the pending approval/risky action in this thread. Tell me approve, revise, or block, with the reason and the safest next action.',
  },
  {
    id: 'connect-hermes',
    label: 'Connect Hermes',
    lane: 'Setup',
    actionClass: 'fills prompt',
    accent: 'brass',
    description: 'Check whether Hermes is installed, configured, and reachable from this app.',
    helper: 'Use this when the UI is open but sessions, chat, or tools feel disconnected.',
    prompt: 'Diagnose my local Hermes setup for Signal Loom. Check binary, config path, env path, API server, state database, gateway status, and give me the safest next command to run.',
  },
  {
    id: 'handoff',
    label: 'Draft handoff',
    lane: 'Operator',
    actionClass: 'fills prompt',
    accent: 'brass',
    description: 'Prepare a structured handoff prompt for continuing this thread safely.',
    helper: 'Fills the composer; nothing is sent until you press Send.',
    prompt: 'Create a Signal Loom handoff for this thread with active state, completed actions, pending decisions, verification evidence, files/commands, risks, and the exact next operator move.',
  },
  {
    id: 'qa',
    label: 'Verify before done',
    lane: 'Argus',
    actionClass: 'opens panel',
    accent: 'teal',
    description: 'Check the work before calling it finished.',
    helper: 'Use when a build, UI, route, or workflow needs proof, not vibes.',
    prompt: 'Argus/Sentinel: QA this work before completion. Check correctness, regressions, browser behavior, security/privacy risks, and give me a pass/fail with exact evidence needed.',
  },
];

const accentClass: Record<Capability['accent'], string> = {
  teal: 'capability-teal',
  brass: 'capability-brass',
  red: 'capability-red',
  violet: 'capability-violet',
  jade: 'capability-jade',
};

export function HermesCommandCenter() {
  const panelRef = useRef<HTMLElement>(null);
  const { detection } = useHermesDetection({ pollMs: 60_000 });
  const agentIdentity = agentIdentityFromDetection(detection?.identity);

  const {
    hermesCommandCenterOpen,
    closeHermesCommandCenter,
    setComposerDraft,
    toggleApprovalsPanel,
    approvalsPanelOpen,
    runtime,
    agents,
    approvals,
    sessions,
    runtimeActivities,
    toggleVerificationPanel,
    setPreset,
  } = useSignalLoomStore();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const filteredCapabilities = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return CAPABILITIES;
    return CAPABILITIES.filter((capability) =>
      [capability.label, capability.lane, capability.actionClass, capability.description, capability.helper].join(' ').toLowerCase().includes(normalized)
    );
  }, [query]);

  useEffect(() => {
    const timer = window.setTimeout(() => setActiveIndex(0), 0);
    return () => window.clearTimeout(timer);
  }, [query, hermesCommandCenterOpen]);

  const stats = useMemo(() => {
    const delegated = classifyDelegatedSessions({ sessions, runtimeActivities });
    const active = agents.filter((agent) => agent.status === 'active').length + delegated.runningNow.length;
    const watching = delegated.createdEmpty.length + delegated.recentlyDelegated.length;
    const pendingApprovals = approvals.filter((approval) => approval.status === undefined || approval.status === 'pending').length;
    return { active, watching, pendingApprovals };
  }, [agents, approvals, sessions, runtimeActivities]);

  useEffect(() => {
    if (!hermesCommandCenterOpen) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusableSelector = [
      'button:not([disabled]):not([tabindex="-1"])',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    window.setTimeout(() => {
      const searchInput = panelRef.current?.querySelector<HTMLInputElement>('.hermes-command-search');
      searchInput?.focus({ preventScroll: true });
      if (!searchInput) panelRef.current?.focus({ preventScroll: true });
    }, 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeHermesCommandCenter();
        return;
      }

      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (element) => !element.hasAttribute('disabled') && element.offsetParent !== null
      );
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, [closeHermesCommandCenter, hermesCommandCenterOpen]);

  if (!hermesCommandCenterOpen) return null;

  const applyPrompt = (prompt: string) => {
    const personalizedPrompt = prompt.startsWith('{agent}:')
      ? addressAgentPrompt(agentIdentity, prompt.replace('{agent}:', '').trim())
      : prompt;
    setComposerDraft(personalizedPrompt);
    closeHermesCommandCenter();
  };

  return (
    <div className="hermes-command-layer" role="dialog" aria-modal="true" aria-label="Quick actions">
      <button
        type="button"
        className="hermes-command-backdrop"
        aria-label="Close quick actions"
        aria-hidden="true"
        tabIndex={-1}
        onClick={closeHermesCommandCenter}
      />

      <section ref={panelRef} className="hermes-command-panel" aria-labelledby="hermes-command-title" tabIndex={-1}>
        <header className="hermes-command-header">
          <div className="min-w-0">
            <p className="hermes-command-kicker">Quick actions</p>
            <h2 id="hermes-command-title" className="hermes-command-title">
              Pick what you need. Signal Loom fills the prompt.
            </h2>
            <p className="hermes-command-subtitle">
              These shortcuts only prepare a prompt or open a panel. They do not send, post, schedule, or delete anything.
            </p>
          </div>
          <button type="button" onClick={closeHermesCommandCenter} className="hermes-command-close" aria-label="Close quick actions">
            ×
          </button>
        </header>

        <label className="hermes-command-search-label">
          <span className="sr-only">Search quick actions</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveIndex((current) => Math.min(current + 1, Math.max(filteredCapabilities.length - 1, 0)));
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveIndex((current) => Math.max(current - 1, 0));
              }
              if (event.key === 'Enter') {
                const selected = filteredCapabilities[activeIndex] ?? filteredCapabilities[0];
                if (selected) {
                  event.preventDefault();
                  applyPrompt(selected.prompt);
                }
              }
            }}
            placeholder="Search actions… try model, doctor, approval, watcher, verify"
            className="hermes-command-search"
            aria-activedescendant={filteredCapabilities[activeIndex]?.id ? 'command-action-' + filteredCapabilities[activeIndex].id : undefined}
            autoFocus
          />
        </label>

        <div className="hermes-command-status" aria-label="Hermes status summary">
          <StatusPill label="Gateway" value={runtime.gateway} good={runtime.gateway === 'healthy'} />
          <StatusPill label="Queue" value={runtime.queue} good={runtime.queue === 'healthy'} />
          <StatusPill label="Heartbeat" value={runtime.heartbeatFreshness} good={runtime.heartbeatFreshness === 'fresh'} />
          <StatusPill label="Running lanes" value={`${stats.active}`} good={stats.active > 0} />
          <StatusPill label="Watching lanes" value={`${stats.watching}`} good={stats.watching === 0} />
          <StatusPill label="Needs review" value={`${stats.pendingApprovals}`} good={stats.pendingApprovals === 0} />
        </div>

        <div className="hermes-command-quickrow" aria-label="Open review panels">
          <button
            type="button"
            className={cn('hermes-command-quick', approvalsPanelOpen && 'is-open')}
            onClick={toggleApprovalsPanel}
          >
            <span>Needs review</span>
            <strong>{stats.pendingApprovals}</strong>
          </button>
          <button
            type="button"
            className="hermes-command-quick"
            onClick={() => applyPrompt('Show me the current Hermes status, active agents, pending review items, and the one next operational move.')}
          >
            <span>Runtime check</span>
            <strong>ask</strong>
          </button>
          <button
            type="button"
            className="hermes-command-quick"
            onClick={() => { toggleVerificationPanel(); closeHermesCommandCenter(); }}
          >
            <span>Verification</span>
            <strong>open</strong>
          </button>
          <button
            type="button"
            className="hermes-command-quick"
            onClick={() => { setPreset('verify'); toggleVerificationPanel(); closeHermesCommandCenter(); }}
          >
            <span>Verify layout</span>
            <strong>safe</strong>
          </button>
        </div>

        <div className="hermes-capability-grid">
          {filteredCapabilities.map((capability, index) => (
            <button
              id={'command-action-' + capability.id}
              key={capability.id}
              type="button"
              onClick={() => applyPrompt(capability.prompt)}
              onMouseEnter={() => setActiveIndex(index)}
              className={cn('hermes-capability-card', accentClass[capability.accent], activeIndex === index && 'is-active')}
            >
              <span className="hermes-capability-lane">{capability.lane} · {capability.actionClass}</span>
              <span className="hermes-capability-label">{capability.label}</span>
              <span className="hermes-capability-description">{capability.description}</span>
              <span className="hermes-capability-helper">{capability.helper}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatusPill({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <span className={cn('hermes-status-pill', good ? 'is-good' : 'is-watch')}>
      <span className="hermes-status-dot" aria-hidden="true" />
      <span className="text-ash">{label}</span>
      <strong>{value}</strong>
    </span>
  );
}
