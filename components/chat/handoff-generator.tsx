'use client';

import { useMemo, useState } from 'react';
import { buildThreadHandoffReport, type ConnectionTruthSummary } from '@/lib/operator-qol';
import { useSignalLoomStore } from '@/lib/store';
import type { Approval, DelegationEvent, Message, Thread } from '@/lib/types';

export function HandoffGenerator({
  thread,
  messages,
  approvals,
  delegationEvents,
  connection,
  childCount,
}: {
  thread: Thread;
  messages: Message[];
  approvals: Approval[];
  delegationEvents: DelegationEvent[];
  connection?: Pick<ConnectionTruthSummary, 'state' | 'primaryLabel' | 'sendAllowed' | 'warnings'>;
  childCount?: number;
}) {
  const setComposerDraft = useSignalLoomStore((state) => state.setComposerDraft);
  const [copied, setCopied] = useState(false);
  const report = useMemo(() => buildThreadHandoffReport({ thread, messages, approvals, delegationEvents, connection, childCount }), [approvals, childCount, connection, delegationEvents, messages, thread]);

  const copyReport = async () => {
    await navigator.clipboard.writeText(report.markdown);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const fillComposer = () => {
    setComposerDraft(`Continue from this Signal Loom handoff. Treat it as historical until verified against the live repo/session.

${report.markdown}`);
  };

  const downloadReport = () => {
    const blob = new Blob([report.markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `signal-loom-handoff-${thread.session?.shortId ?? thread.id}.md`.replace(/[^a-z0-9._-]+/gi, '-');
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="handoff-generator" aria-label="Thread handoff generator">
      <span className="handoff-generator-label">Handoff</span>
      <button type="button" onClick={copyReport}>{copied ? 'Copied' : 'Copy'}</button>
      <button type="button" onClick={fillComposer}>Fill composer</button>
      <button type="button" onClick={downloadReport}>Export .md</button>
    </div>
  );
}
