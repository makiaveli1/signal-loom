export type AgentIdentitySource = 'env' | 'soul' | 'config' | 'fallback';

export type AgentIdentity = {
  id: string;
  name: string;
  initials: string;
  roleLabel: string;
  source: AgentIdentitySource;
};

export const DEFAULT_AGENT_IDENTITY: AgentIdentity = {
  id: 'hermes-agent',
  name: 'Hermes Agent',
  initials: 'HA',
  roleLabel: 'Operator',
  source: 'fallback',
};

const MAX_NAME_LENGTH = 48;

function titleCaseFallback(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function normalizeAgentName(value: string | null | undefined): string | null {
  const normalized = value
    ?.replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return null;

  const stripped = normalized
    .replace(/^(?:agent|assistant|identity|persona|name)\s*[:=]\s*/i, '')
    .replace(/^you are\s+/i, '')
    .replace(/[.。]\s*$/u, '')
    .trim();

  if (!stripped || stripped.length > MAX_NAME_LENGTH) return null;
  if (/^(hermes agent|assistant|operator)$/i.test(stripped)) return titleCaseFallback(stripped);
  return stripped;
}

export function slugifyAgentName(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || DEFAULT_AGENT_IDENTITY.id;
}

export function initialsForAgentName(name: string): string {
  const words = name.match(/[\p{L}\p{N}]+/gu) ?? [];
  if (words.length >= 2) return `${words[0]?.[0] ?? ''}${words[1]?.[0] ?? ''}`.toUpperCase();
  if (words.length === 1) return (words[0] ?? '').slice(0, 2).toUpperCase();
  return DEFAULT_AGENT_IDENTITY.initials;
}

export function buildAgentIdentity({
  name,
  source = 'fallback',
  roleLabel,
}: {
  name?: string | null;
  source?: AgentIdentitySource;
  roleLabel?: string | null;
} = {}): AgentIdentity {
  const normalizedName = normalizeAgentName(name) ?? DEFAULT_AGENT_IDENTITY.name;
  return {
    id: slugifyAgentName(normalizedName),
    name: normalizedName,
    initials: initialsForAgentName(normalizedName),
    roleLabel: normalizeAgentName(roleLabel) ?? DEFAULT_AGENT_IDENTITY.roleLabel,
    source: normalizeAgentName(name) ? source : 'fallback',
  };
}

export function agentIdentityFromDetection(identity?: Partial<AgentIdentity> | null): AgentIdentity {
  if (!identity?.name) return DEFAULT_AGENT_IDENTITY;
  return {
    id: identity.id || slugifyAgentName(identity.name),
    name: identity.name,
    initials: identity.initials || initialsForAgentName(identity.name),
    roleLabel: identity.roleLabel || DEFAULT_AGENT_IDENTITY.roleLabel,
    source: identity.source || 'fallback',
  };
}

export function addressAgentPrompt(identity: AgentIdentity, prompt: string): string {
  return `${identity.name}: ${prompt}`;
}
