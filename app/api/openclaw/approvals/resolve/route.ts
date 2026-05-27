/**
 * POST /api/openclaw/approvals/resolve
 *
 * Hermes does not expose OpenClaw's legacy /tools/invoke approval endpoint.
 * During migration, approval decisions are recorded in a local Hermes-side
 * JSONL audit log and reported as unsynced rather than throwing noisy 404s.
 */

import { NextRequest, NextResponse } from 'next/server';
import { recordApprovalDecision } from '@/lib/openclaw/adapter/approval-log';

export const dynamic = 'force-dynamic';

type Decision = 'approved' | 'denied' | 'revised';

const VALID_DECISIONS = new Set<Decision>(['approved', 'denied', 'revised']);

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 });
  }

  const { approvalId, decision, note } = body as Record<string, unknown>;

  if (!approvalId || typeof approvalId !== 'string') {
    return NextResponse.json({ error: 'approvalId is required' }, { status: 400 });
  }

  if (!decision || typeof decision !== 'string' || !VALID_DECISIONS.has(decision as Decision)) {
    return NextResponse.json({ error: 'decision must be approved, denied, or revised' }, { status: 400 });
  }

  if (note !== undefined && typeof note !== 'string') {
    return NextResponse.json({ error: 'note must be a string when provided' }, { status: 400 });
  }

  if (typeof note === 'string' && note.length > 2_000) {
    return NextResponse.json({ error: 'note is too long (max 2000 chars)' }, { status: 400 });
  }

  const entry = await recordApprovalDecision({
    approvalId,
    decision: decision as Decision,
    note: typeof note === 'string' && note.trim() ? note : undefined,
  });

  return NextResponse.json(
    {
      resolved: true,
      synced: false,
      recordedAt: entry.recordedAt,
      message: 'Approval recorded locally in Hermes; no legacy OpenClaw approval tool is available.',
    },
    { headers: { 'X-Approval-Synced': 'false' } },
  );
}
