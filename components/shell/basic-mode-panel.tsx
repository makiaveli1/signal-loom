'use client';

import { useMemo } from 'react';
import { buildConnectionTruthSummary } from '@/lib/operator-qol';
import { useSignalLoomStore } from '@/lib/store';
import { useHermesDetection } from '@/lib/use-hermes-detection';
import { cn } from '@/lib/utils';
import { DesktopBoundaryPanel } from './desktop-boundary-panel';

type QuickAction = {
  id: string;
  label: string;
  detail: string;
  action: () => void;
  tone?: 'primary' | 'warn' | 'neutral';
};

export function BasicModePanel({ compact = false }: { compact?: boolean }) {
  const {
    runtime,
    liveConnected,
    approvals,
    sessions,
    sessionsError,
    sessionsLoading,
    startNewSession,
    setComposerDraft,
    toggleApprovalsPanel,
    toggleHermesSettings,
    toggleHermesCommandCenter,
    setWorkspaceMode,
    setPreset,
  } = useSignalLoomStore();
  const { detection, loading, refresh } = useHermesDetection({ pollMs: 60_000 });
  const summary = useMemo(
    () => buildConnectionTruthSummary({ runtime, detection, liveConnected, loading }),
    [detection, liveConnected, loading, runtime]
  );

  const pendingApprovals = approvals.filter((approval) => approval.status === undefined || approval.status === 'pending').length;
  const connectedEnough = summary.state === 'ready' || summary.state === 'degraded';

  const quickActions: QuickAction[] = [
    {
      id: 'new-chat',
      label: 'Start chat',
      detail: 'Create a local draft session and keep the composer ready.',
      tone: 'primary',
      action: () => startNewSession(),
    },
    {
      id: 'connect',
      label: connectedEnough ? 'Connection details' : 'Connect Hermes',
      detail: connectedEnough ? 'Review local runtime, token, and state DB truth.' : 'Open the setup panel and fix the first blocked check.',
      tone: connectedEnough ? 'neutral' : 'warn',
      action: toggleHermesSettings,
    },
    {
      id: 'approvals',
      label: 'Approvals',
      detail: pendingApprovals > 0 ? String(pendingApprovals) + ' pending decision' + (pendingApprovals === 1 ? '' : 's') + '.' : 'No pending decisions in the local queue.',
      tone: pendingApprovals > 0 ? 'warn' : 'neutral',
      action: toggleApprovalsPanel,
    },
    {
      id: 'ask-guide',
      label: 'Explain this screen',
      detail: 'Fill a plain-English help prompt. Nothing sends until you press Send.',
      action: () => {
        setComposerDraft('Explain this Signal Loom screen in plain English: where chats are, what approvals mean, how to connect Hermes, and the first three safe actions to try.');
        toggleHermesCommandCenter();
      },
    },
  ];

  return (
    <aside className={cn('basic-mode-panel', compact && 'is-compact')} aria-label="Basic Signal Loom guide">
      <section className={cn('basic-connection-card', 'is-' + summary.state)}>
        <p className="basic-kicker">Basic mode</p>
        <h2>{summary.primaryLabel}</h2>
        <p>{summary.sendAllowed ? 'Chat sending is available when the composer is enabled.' : 'Signal Loom is intentionally blocking sends until Hermes is connected safely.'}</p>
        <div className="basic-check-stack" aria-label="Connection checks">
          {summary.checks.map((check) => (
            <div key={check.id} className={cn('basic-check-row', 'tone-' + check.tone)}>
              <span>{check.group}</span>
              <strong>{check.label}</strong>
              <small>{check.detail}</small>
            </div>
          ))}
        </div>
        <div className="basic-card-actions">
          <button type="button" onClick={refresh}>Re-check</button>
          <button type="button" onClick={toggleHermesSettings}>Open setup</button>
        </div>
      </section>

      <section className="basic-section-card">
        <div className="basic-section-heading">
          <p className="basic-kicker">First-run map</p>
          <strong>What to do here</strong>
        </div>
        <ol className="basic-onboarding-list">
          <li><span>1</span><p><strong>Connect Hermes.</strong> Fix token/API/state DB warnings before trusting sends.</p></li>
          <li><span>2</span><p><strong>Pick a chat.</strong> Use the Loom panel for recent, pinned, hidden/archive, or searched sessions.</p></li>
          <li><span>3</span><p><strong>Ask safely.</strong> Drafts stay local; risky work goes through approvals.</p></li>
          <li><span>4</span><p><strong>Switch up later.</strong> Operator mode restores lanes, receipts, verification, and dense routing.</p></li>
        </ol>
      </section>

      <section className="basic-section-card">
        <div className="basic-section-heading">
          <p className="basic-kicker">Quick actions</p>
          <strong>{sessionsLoading ? 'Loading sessions…' : sessionsError ? 'Sessions degraded' : String(sessions.length) + ' sessions visible'}</strong>
        </div>
        <div className="basic-action-grid">
          {quickActions.map((action) => (
            <button key={action.id} type="button" onClick={action.action} className={cn('basic-action-card', action.tone && 'tone-' + action.tone)}>
              <strong>{action.label}</strong>
              <span>{action.detail}</span>
            </button>
          ))}
        </div>
      </section>

      <DesktopBoundaryPanel compact />

      <section className="basic-section-card desktop-boundary-card">
        <div className="basic-card-actions">
          <button type="button" onClick={() => { setWorkspaceMode('operator'); setPreset('operator'); }}>Operator mode</button>
          <button type="button" onClick={() => { setWorkspaceMode('operator'); setPreset('verify'); }}>Verify layout</button>
        </div>
      </section>
    </aside>
  );
}
