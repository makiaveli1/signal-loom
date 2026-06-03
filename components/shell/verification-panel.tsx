'use client';

import { useMemo, useState } from 'react';
import { buildConnectionTruthSummary } from '@/lib/operator-qol';
import { useSignalLoomStore } from '@/lib/store';
import { useHermesDetection } from '@/lib/use-hermes-detection';
import { sanitizeRuntimeDetail } from '@/lib/runtime-contract';
import { cn } from '@/lib/utils';

export function VerificationPanel() {
  const {
    verificationPanelOpen,
    closeVerificationPanel,
    runtime,
    liveConnected,
    sessions,
    sessionsError,
    sessionsFetchedAt,
    approvals,
    runtimeActivities,
  } = useSignalLoomStore();
  const { detection, loading } = useHermesDetection({ pollMs: 60_000 });
  const [copied, setCopied] = useState(false);
  const summary = useMemo(() => buildConnectionTruthSummary({ runtime, detection, liveConnected, loading }), [detection, liveConnected, loading, runtime]);
  const safeSessionsError = sessionsError ? sanitizeRuntimeDetail(sessionsError) : null;

  if (!verificationPanelOpen) return null;

  const pendingApprovals = approvals.filter((approval) => approval.status === undefined || approval.status === 'pending').length;
  const activeActivities = Object.values(runtimeActivities).filter((activity) => activity.status === 'active').length;
  const lines = [
    `Connection: ${summary.primaryLabel} (${summary.state}; send ${summary.sendAllowed ? 'allowed' : 'blocked'})`,
    `Checks: ${summary.okCount}/${summary.totalCount}`,
    `Sessions: ${sessions.length}${safeSessionsError ? `; error: ${safeSessionsError}` : ''}${sessionsFetchedAt ? `; fetched ${sessionsFetchedAt}` : ''}`,
    `Live stream: ${liveConnected ? 'connected' : 'offline'}`,
    `Runtime: gateway ${runtime.gateway}; queue ${runtime.queue}; heartbeat ${runtime.heartbeatFreshness}; issues ${runtime.issueCount}`,
    `Approvals pending: ${pendingApprovals}`,
    `Runtime activities active: ${activeActivities}`,
    `Warnings: ${summary.warnings.length ? summary.warnings.join('; ') : 'none'}`,
  ];

  const copySummary = async () => {
    await navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <aside className="verification-panel" role="dialog" aria-modal="false" aria-labelledby="verification-panel-title">
      <header className="verification-panel-header">
        <div>
          <p className="verification-kicker">Argus verification</p>
          <h2 id="verification-panel-title">Local confidence panel</h2>
          <p>Browser-side truth only. Shell tests still need terminal evidence before pass claims.</p>
        </div>
        <button type="button" onClick={closeVerificationPanel} aria-label="Close verification panel">×</button>
      </header>

      <section className="verification-section">
        <div className={cn('verification-summary-card', `is-${summary.state}`)}>
          <strong>{summary.primaryLabel}</strong>
          <span>{summary.okCount}/{summary.totalCount} checks · send {summary.sendAllowed ? 'allowed' : 'blocked'}</span>
        </div>
        <div className="verification-check-grid">
          {summary.checks.map((check) => (
            <div key={check.id} className={cn('verification-check-row', `tone-${check.tone}`)}>
              <span>{check.group}</span>
              <strong>{check.label}</strong>
              <small>{check.detail}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="verification-section">
        <h3>Workflow snapshot</h3>
        <ul>
          <li>Sessions loaded: {sessions.length}</li>
          <li>Sessions fetch: {safeSessionsError ? `error — ${safeSessionsError}` : sessionsFetchedAt ? `ok — ${new Date(sessionsFetchedAt).toLocaleString('en-IE')}` : 'not fetched yet'}</li>
          <li>Live SSE: {liveConnected ? 'connected' : 'offline/degraded'}</li>
          <li>Pending approvals: {pendingApprovals}</li>
          <li>Active runtime activities: {activeActivities}</li>
        </ul>
      </section>

      {summary.nextActions.length > 0 && (
        <section className="verification-section">
          <h3>Next checks</h3>
          <ul>{summary.nextActions.map((action) => <li key={action}>{action}</li>)}</ul>
        </section>
      )}

      <footer className="verification-panel-footer">
        <button type="button" onClick={copySummary}>{copied ? 'Copied summary' : 'Copy verification summary'}</button>
      </footer>
    </aside>
  );
}
