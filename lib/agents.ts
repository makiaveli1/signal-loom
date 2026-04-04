import type { AgentId } from '@/lib/types';

export interface AgentLaneMeta {
  lane: string;
  role: string;
  delegationReason: string;
  name: string;
}

export const AGENT_LANE_META: Record<AgentId, AgentLaneMeta> = {
  hephaestus: {
    lane: 'Build',
    role: 'execution',
    delegationReason: 'implementation',
    name: 'Hephaestus',
  },
  argus: {
    lane: 'Review',
    role: 'risk + security',
    delegationReason: 'security + risk review',
    name: 'Argus',
  },
  ariadne: {
    lane: 'Design',
    role: 'UX critique',
    delegationReason: 'UX design review',
    name: 'Ariadne',
  },
  orion: {
    lane: 'Research',
    role: 'evidence',
    delegationReason: 'research + evidence',
    name: 'Orion',
  },
  hermes: {
    lane: 'Commercial',
    role: 'drafts + outreach',
    delegationReason: 'commercial drafting',
    name: 'Hermes',
  },
};

export function getAgentLaneMeta(agentId?: AgentId | null): AgentLaneMeta | null {
  if (!agentId) return null;
  return AGENT_LANE_META[agentId] ?? null;
}
