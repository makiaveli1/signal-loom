'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useSignalLoomStore } from '@/lib/store';
import { cn } from '@/lib/utils';

type Capability = {
  id: string;
  label: string;
  lane: string;
  accent: 'teal' | 'brass' | 'red' | 'violet' | 'jade';
  description: string;
  prompt: string;
  helper: string;
};

const CAPABILITIES: Capability[] = [
  {
    id: 'decision',
    label: 'Summarise decision',
    lane: 'Nero',
    accent: 'red',
    description: 'Pull out the decision, risks, and next step from the current chat.',
    helper: 'Use this when the chat is long and you need the point, not every detail.',
    prompt: 'Nero: synthesize the current thread into: 1) the actual decision, 2) risks/tradeoffs, 3) what you recommend I do next, and 4) what can be ignored.',
  },
  {
    id: 'delegate',
    label: 'Split the work',
    lane: 'Council',
    accent: 'teal',
    description: 'Break a larger task into coding, research, design, QA, or business work.',
    helper: 'Use this when several parts can move at the same time.',
    prompt: 'Nero: split this task into the right work lanes. Say who owns what, what evidence each part needs, and give me a compact execution plan before acting.',
  },
  {
    id: 'session-recall',
    label: 'Recall context',
    lane: 'Session search',
    accent: 'violet',
    description: 'Find useful past chats before making me repeat myself.',
    helper: 'Good for “where did we leave this?” and project continuity.',
    prompt: 'Search prior Hermes sessions for context related to this task, summarize only the durable facts that matter, then continue from there without making me repeat myself.',
  },
  {
    id: 'watcher',
    label: 'Create a watcher',
    lane: 'Cron',
    accent: 'jade',
    description: 'Plan a repeated check, alert, or briefing.',
    helper: 'Nothing is scheduled until you approve the exact schedule and message.',
    prompt: 'Design a Hermes cron/watch job for this need. Include schedule, trigger condition, delivery target, prompt/script shape, and safety notes. Do not create it until I approve.',
  },
  {
    id: 'skills',
    label: 'Choose skills/tools',
    lane: 'Skills',
    accent: 'brass',
    description: 'Pick the best saved runbooks and tools for this job.',
    helper: 'Use this when the safest route is not obvious.',
    prompt: 'Inspect which Hermes skills/toolsets are relevant to this task, load the right ones, then give me the shortest safe execution path.',
  },
  {
    id: 'approval',
    label: 'Review risky action',
    lane: 'Argus',
    accent: 'red',
    description: 'Check pending approvals, sends, deletes, or other risky actions.',
    helper: 'Use this before anything public, expensive, or hard to undo.',
    prompt: 'Review the pending approval/risky action in this thread. Tell me approve, revise, or block, with the reason and the safest next action.',
  },
  {
    id: 'commercial',
    label: 'Draft outreach',
    lane: 'Mercury',
    accent: 'brass',
    description: 'Draft Verdantia outreach, follow-ups, posts, or offer copy.',
    helper: 'Commercial output stays draft-only unless you explicitly approve sending/posting.',
    prompt: 'Mercury lane: draft this as Verdantia-facing commercial communication. Keep it useful, specific, non-salesy, and approval-gated. Return 2 options plus your recommendation.',
  },
  {
    id: 'qa',
    label: 'Verify before done',
    lane: 'Argus',
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

  const {
    hermesCommandCenterOpen,
    closeHermesCommandCenter,
    setComposerDraft,
    toggleApprovalsPanel,
    toggleEmailComposer,
    approvalsPanelOpen,
    emailComposerOpen,
    runtime,
    agents,
    emailGates,
    approvals,
  } = useSignalLoomStore();

  const stats = useMemo(() => {
    const active = agents.filter((agent) => agent.status === 'active').length;
    const pendingEmail = emailGates.filter((gate) => gate.gateStatus === 'needs_review' || gate.gateStatus === 'ready_for_approval').length;
    const pendingApprovals = approvals.filter((approval) => approval.status === undefined || approval.status === 'pending').length;
    return { active, pendingEmail, pendingApprovals };
  }, [agents, approvals, emailGates]);

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

    window.setTimeout(() => panelRef.current?.focus(), 0);

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
    setComposerDraft(prompt);
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

        <div className="hermes-command-status" aria-label="Hermes status summary">
          <StatusPill label="Gateway" value={runtime.gateway} good={runtime.gateway === 'healthy'} />
          <StatusPill label="Queue" value={runtime.queue} good={runtime.queue === 'healthy'} />
          <StatusPill label="Heartbeat" value={runtime.heartbeatFreshness} good={runtime.heartbeatFreshness === 'fresh'} />
          <StatusPill label="Active agents" value={`${stats.active}`} good={stats.active > 0} />
          <StatusPill label="Needs review" value={`${stats.pendingApprovals + stats.pendingEmail}`} good={stats.pendingApprovals + stats.pendingEmail === 0} />
        </div>

        <div className="hermes-command-quickrow" aria-label="Open review panels">
          <button
            type="button"
            className={cn('hermes-command-quick', approvalsPanelOpen && 'is-open')}
            onClick={toggleApprovalsPanel}
          >
            <span>Needs review</span>
            <strong>{stats.pendingApprovals + stats.pendingEmail}</strong>
          </button>
          <button
            type="button"
            className={cn('hermes-command-quick', emailComposerOpen && 'is-open')}
            onClick={toggleEmailComposer}
          >
            <span>Email drafts</span>
            <strong>{stats.pendingEmail}</strong>
          </button>
          <button
            type="button"
            className="hermes-command-quick"
            onClick={() => applyPrompt('Show me the current Hermes status, active agents, pending review items, and the one next operational move.')}
          >
            <span>Runtime check</span>
            <strong>ask</strong>
          </button>
        </div>

        <div className="hermes-capability-grid">
          {CAPABILITIES.map((capability) => (
            <button
              key={capability.id}
              type="button"
              onClick={() => applyPrompt(capability.prompt)}
              className={cn('hermes-capability-card', accentClass[capability.accent])}
            >
              <span className="hermes-capability-lane">{capability.lane}</span>
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
