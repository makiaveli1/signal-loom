import { NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { promisify } from 'node:util';
import { resolveAgentIdentity } from '@/lib/hermes/agent-identity-server';
import { resolveHermesGatewayConfig } from '@/lib/hermes-server-gate';

export const dynamic = 'force-dynamic';

const execFileAsync = promisify(execFile);
const DEFAULT_HOME = homedir();
const HERMES_HOME = process.env.HERMES_HOME ?? `${DEFAULT_HOME}/.hermes`;

type DetectionStatus =
  | 'ready'
  | 'missing_binary'
  | 'installed_not_configured'
  | 'configured_api_missing'
  | 'api_unreachable'
  | 'state_db_missing'
  | 'needs_token'
  | 'unknown_error';

type NextStep = {
  id: string;
  label: string;
  command?: string;
  risk: 'safe' | 'requires_permission' | 'manual_only';
};

async function run(command: string, args: string[], timeout = 5_000): Promise<{ ok: boolean; output: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, { timeout, maxBuffer: 32_000 });
    return { ok: true, output: `${stdout}${stderr}`.trim() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, output: message };
  }
}

async function detectApi(url: string, token: string): Promise<{ reachable: boolean; authenticated?: boolean; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_500);
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/v1/models`, {
      cache: 'no-store',
      signal: controller.signal,
      headers: token
        ? { Authorization: `Bearer ${token}` }
        : undefined,
    });
    if (res.status === 401 || res.status === 403) {
      return { reachable: true, authenticated: false, error: `HTTP ${res.status}` };
    }
    return { reachable: res.ok, authenticated: res.ok, error: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { reachable: false, error: message };
  } finally {
    clearTimeout(timeout);
  }
}

function buildNextSteps(status: DetectionStatus, apiUrl: string): NextStep[] {
  if (status === 'ready') {
    return [
      { id: 'ask', label: 'Start with a plain Hermes walkthrough', command: 'Ask Signal Loom: Explain this screen', risk: 'safe' },
      { id: 'doctor', label: 'Run a read-only Hermes health check', command: 'hermes doctor', risk: 'safe' },
    ];
  }

  if (status === 'missing_binary') {
    return [
      { id: 'install', label: 'Install Hermes Agent manually', command: 'curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash', risk: 'manual_only' },
      { id: 'setup', label: 'Run the Hermes setup wizard after install', command: 'hermes setup', risk: 'safe' },
    ];
  }

  if (status === 'installed_not_configured') {
    return [
      { id: 'setup', label: 'Run the Hermes setup wizard', command: 'hermes setup', risk: 'safe' },
      { id: 'doctor', label: 'Check what Hermes still needs', command: 'hermes doctor', risk: 'safe' },
    ];
  }

  if (status === 'needs_token') {
    return [
      { id: 'token', label: 'Set the API key Signal Loom should use', command: 'export HERMES_API_KEY=your-local-api-key', risk: 'manual_only' },
      { id: 'doctor', label: 'Re-check Hermes after setting the token', command: 'hermes doctor', risk: 'safe' },
    ];
  }

  if (status === 'api_unreachable' || status === 'configured_api_missing') {
    return [
      { id: 'status', label: 'Check Hermes runtime status', command: 'hermes status --all', risk: 'safe' },
      { id: 'gateway', label: `Start or configure the API server for ${apiUrl}`, command: 'hermes gateway setup', risk: 'requires_permission' },
      { id: 'doctor', label: 'Run health diagnostics', command: 'hermes doctor', risk: 'safe' },
    ];
  }

  if (status === 'state_db_missing') {
    return [
      { id: 'chat', label: 'Create your first Hermes session', command: 'hermes', risk: 'safe' },
      { id: 'sessions', label: 'Inspect saved sessions', command: 'hermes sessions list', risk: 'safe' },
    ];
  }

  return [
    { id: 'doctor', label: 'Run Hermes doctor and inspect the output', command: 'hermes doctor', risk: 'safe' },
  ];
}

export async function GET() {
  const gatewayConfig = resolveHermesGatewayConfig();
  const identity = resolveAgentIdentity();
  try {
    const which = await run('which', ['hermes']);
    const binaryFound = which.ok && Boolean(which.output);
    const binaryPath = binaryFound ? which.output.split('\n')[0] : undefined;

    const version = binaryFound ? await run('hermes', ['--version']) : { ok: false, output: '' };
    const configProbe = binaryFound ? await run('hermes', ['config', 'path']) : { ok: false, output: '' };
    const envProbe = binaryFound ? await run('hermes', ['config', 'env-path']) : { ok: false, output: '' };

    const configPath = process.env.HERMES_CONFIG ?? (configProbe.ok && configProbe.output ? configProbe.output.split('\n')[0] : `${HERMES_HOME}/config.yaml`);
    const envPath = process.env.HERMES_ENV ?? (envProbe.ok && envProbe.output ? envProbe.output.split('\n')[0] : `${HERMES_HOME}/.env`);
    const stateDbPath = process.env.HERMES_STATE_DB ?? `${HERMES_HOME}/state.db`;

    const configExists = existsSync(/* turbopackIgnore: true */ configPath);
    const envExists = existsSync(/* turbopackIgnore: true */ envPath);
    const stateDbExists = existsSync(/* turbopackIgnore: true */ stateDbPath);
    const api = await detectApi(gatewayConfig.apiUrl, gatewayConfig.token);

    let status: DetectionStatus = 'ready';
    if (!binaryFound) status = 'missing_binary';
    else if (!configExists) status = 'installed_not_configured';
    else if (api.reachable && api.authenticated === false) status = 'needs_token';
    else if (!api.reachable) status = 'api_unreachable';
    else if (!stateDbExists) status = 'state_db_missing';

    return NextResponse.json({
      ok: status === 'ready',
      status,
      fetchedAt: new Date().toISOString(),
      binary: {
        found: binaryFound,
        path: binaryPath,
        version: version.ok ? version.output : undefined,
      },
      home: {
        path: HERMES_HOME,
        exists: existsSync(/* turbopackIgnore: true */ HERMES_HOME),
        configPath,
        configExists,
        envPath,
        envExists,
        stateDbPath,
        stateDbExists,
      },
      identity,
      api: {
        url: gatewayConfig.apiUrl,
        reachable: api.reachable,
        authenticated: api.authenticated,
        error: api.error,
      },
      nextSteps: buildNextSteps(status, gatewayConfig.apiUrl),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      ok: false,
      status: 'unknown_error' satisfies DetectionStatus,
      fetchedAt: new Date().toISOString(),
      error: message,
      identity,
      nextSteps: buildNextSteps('unknown_error', gatewayConfig.apiUrl),
    }, { status: 500 });
  }
}
