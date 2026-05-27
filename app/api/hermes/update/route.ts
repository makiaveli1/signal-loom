import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { spawn } from 'node:child_process';

export async function POST(req: NextRequest) {
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const { confirmUpdate } = (body ?? {}) as { confirmUpdate?: unknown };
  if (confirmUpdate !== true) {
    return NextResponse.json({
      ok: false,
      output: 'Hermes update is approval-gated. Re-submit with confirmUpdate: true.',
    }, { status: 400 });
  }

  const startedAt = new Date().toISOString();

  const result = await new Promise<{ ok: boolean; code: number | null; output: string }>((resolve) => {
    const child = spawn('hermes', ['update'], {
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    const cap = 180_000;
    const append = (chunk: Buffer) => {
      output += chunk.toString('utf8');
      if (output.length > cap) output = output.slice(output.length - cap);
    };
    const timer = setTimeout(() => {
      output += '\n[signal-loom] Hermes update timed out after 5 minutes.';
      child.kill('SIGTERM');
    }, 300_000);

    child.stdout.on('data', append);
    child.stderr.on('data', append);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, code, output: output.trim() });
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ ok: false, code: null, output: error.message });
    });
  });

  return NextResponse.json({
    ...result,
    startedAt,
    finishedAt: new Date().toISOString(),
  }, { status: result.ok ? 200 : 500 });
}
