import { mkdir, appendFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

export type ApprovalDecision = {
  approvalId: string;
  decision: 'approved' | 'denied' | 'revised';
  note?: string;
  recordedAt: string;
  synced: false;
};

const APPROVAL_LOG_PATH = process.env.SIGNAL_LOOM_APPROVAL_LOG
  ?? join(homedir(), '.hermes', 'signal-loom', 'approval-decisions.jsonl');

export async function recordApprovalDecision(args: {
  approvalId: string;
  decision: 'approved' | 'denied' | 'revised';
  note?: string;
}): Promise<ApprovalDecision> {
  const entry: ApprovalDecision = {
    approvalId: args.approvalId,
    decision: args.decision,
    note: args.note,
    recordedAt: new Date().toISOString(),
    synced: false,
  };

  await mkdir(dirname(APPROVAL_LOG_PATH), { recursive: true });
  await appendFile(APPROVAL_LOG_PATH, `${JSON.stringify(entry)}\n`, 'utf8');

  return entry;
}

export { APPROVAL_LOG_PATH };
