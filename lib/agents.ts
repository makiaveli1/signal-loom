import type { AgentId } from '@/lib/types';

export interface AgentLaneMeta {
  lane: string;
  laneName: string;
  role: string;
  delegationReason: string;
  name: string;
  visualName: string;
  stateVerb: string;
  outputLabel: string;
}

export const AGENT_LANE_META: Record<AgentId, AgentLaneMeta> = {
  hephaestus: {
    lane: 'Forge',
    laneName: 'Forge Lane',
    role: 'implementation + systems craft',
    delegationReason: 'implementation',
    name: 'Hephaestus',
    visualName: 'Hephaestus / Forge',
    stateVerb: 'Forging',
    outputLabel: 'code, fixes, architecture',
  },
  argus: {
    lane: 'Sentinel',
    laneName: 'Sentinel Lane',
    role: 'QA, risk + security',
    delegationReason: 'security + risk review',
    name: 'Argus',
    visualName: 'Argus / Sentinel',
    stateVerb: 'Reviewing',
    outputLabel: 'risk calls, gates, regressions',
  },
  ariadne: {
    lane: 'Studio',
    laneName: 'Studio Lane',
    role: 'UX, visual systems + accessibility',
    delegationReason: 'UX design review',
    name: 'Ariadne',
    visualName: 'Ariadne / Studio',
    stateVerb: 'Designing',
    outputLabel: 'interface critique, polish',
  },
  orion: {
    lane: 'Scout',
    laneName: 'Scout Lane',
    role: 'research + evidence',
    delegationReason: 'research + evidence',
    name: 'Orion',
    visualName: 'Orion / Scout',
    stateVerb: 'Scouting',
    outputLabel: 'source packs, comparisons',
  },
  hermes: {
    lane: 'Mercury',
    laneName: 'Mercury Lane',
    role: 'commercial drafting + outreach',
    delegationReason: 'commercial drafting',
    name: 'Hermes',
    visualName: 'Hermes / Mercury',
    stateVerb: 'Composing',
    outputLabel: 'offers, drafts, follow-ups',
  },
};

export function getAgentLaneMeta(agentId?: AgentId | null): AgentLaneMeta | null {
  if (!agentId) return null;
  return AGENT_LANE_META[agentId] ?? null;
}
