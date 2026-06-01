import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { buildAgentIdentity, type AgentIdentity } from '../agent-identity.ts';

type EnvLike = Record<string, string | undefined>;

const EXPLICIT_NAME_KEYS = [
  'SIGNAL_LOOM_AGENT_NAME',
  'HERMES_AGENT_NAME',
  'HERMES_ASSISTANT_NAME',
  'HERMES_PERSONA_NAME',
  'AGENT_NAME',
];

function firstEnvValue(env: EnvLike, keys: string[]): string | null {
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value) return value;
  }
  return null;
}

export function extractAgentNameFromSoul(content: string): string | null {
  const patterns = [
    /^#\s*SOUL\.md\s*[—-]\s*([^\n#]+?)(?:\s+for\s+.+)?$/im,
    /\bYou are\s+\*\*([^*]+)\*\*/i,
    /\bYou are\s+([^,\.\n]+)(?:,|\.|\n)/i,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    const candidate = match?.[1]?.trim();
    if (!candidate) continue;
    const cleaned = candidate.replace(/\s+(?:for|on)\s+Hermes(?: Agent)?$/i, '').trim();
    if (cleaned) return cleaned;
  }

  return null;
}

export function resolveAgentIdentity({
  env = process.env,
  hermesHome = env.HERMES_HOME ?? join(homedir(), '.hermes'),
}: {
  env?: EnvLike;
  hermesHome?: string;
} = {}): AgentIdentity {
  const explicitName = firstEnvValue(env, EXPLICIT_NAME_KEYS);
  const explicitRole = env.SIGNAL_LOOM_AGENT_ROLE ?? env.HERMES_AGENT_ROLE ?? null;
  if (explicitName) {
    return buildAgentIdentity({ name: explicitName, roleLabel: explicitRole, source: 'env' });
  }

  const soulPath = env.HERMES_SOUL_PATH ?? join(hermesHome, 'SOUL.md');
  if (existsSync(/* turbopackIgnore: true */ soulPath)) {
    try {
      const soul = readFileSync(/* turbopackIgnore: true */ soulPath, 'utf8');
      const soulName = extractAgentNameFromSoul(soul);
      if (soulName) return buildAgentIdentity({ name: soulName, roleLabel: explicitRole, source: 'soul' });
    } catch {
      // Ignore unreadable SOUL files. Detection should still return a safe fallback.
    }
  }

  return buildAgentIdentity({ roleLabel: explicitRole, source: 'fallback' });
}
