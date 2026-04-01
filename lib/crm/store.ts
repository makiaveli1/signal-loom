/**
 * CRM store — Lead and Concept Package state
 * Extends the SignalLoom Zustand store with first-class lead management.
 */

'use client';

import { create } from 'zustand';
import type { Lead, LeadStage, ConceptStatus, ConceptPackage, SendGate } from './types';
import {
  computeSendGate,
  createEmptyConcept,
  createLead,
  getConceptBadgeLabel,
  getConceptBadgeColor,
  conceptIsApproved,
  conceptHasOutput,
} from './concept';
import type { EmailGateStoreItem } from '@/lib/store';

// ---------------------------------------------------------------------------
// Lead store interface
// ---------------------------------------------------------------------------

export interface CrmStore {
  // Leads — all known leads with concept packages
  leads: Lead[];

  // Which lead is currently selected in the dossier view
  selectedLeadId: string | null;

  // Actions
  addLead: (lead: Lead) => void;
  updateLead: (id: string, patch: Partial<Lead>) => void;
  selectLead: (id: string | null) => void;

  // Concept actions
  updateConcept:    (leadId: string, patch: Partial<ConceptPackage>) => void;
  setConceptStatus: (leadId: string, status: ConceptStatus, approvedBy?: string) => void;

  // Stage actions
  advanceStage:   (leadId: string) => void;
  regressStage:   (leadId: string) => void;
  setStage:       (leadId: string, stage: LeadStage) => void;

  // Queries
  getLead:           (id: string) => Lead | undefined;
  getLeadByThreadId: (threadId: string) => Lead | undefined;

  // Send gate — computes whether a lead+email combo is sendable
  getSendGate: (leadId: string, emailGate: EmailGateStoreItem | null) => SendGate;

  // Concept status helpers for UI
  getConceptBadge: (lead: Lead) => { label: string; color: string };
}

// ---------------------------------------------------------------------------
// Mock leads — Sprint 3.5 baseline
// ---------------------------------------------------------------------------

const MOCK_LEADS: Lead[] = [
  {
    id: 'brian-mcgarry-plumber',
    name: 'Brian McGarry',
    businessName: 'Brian McGarry Plumber',
    industry: 'Plumbing',
    location: 'Ireland',
    website: 'https://brianmcgarryplumber.ie',
    score: 44,
    contact: {
      name: 'Brian McGarry',
      role: 'Owner',
      email: 'brian@example.com',
      phone: '+353 87 123 4567',
    },
    stage: 'concept_in_build',
    concept: {
      status: 'building',
      conceptType: 'homepage_mock',
      tier: 1,
      previewUrl: undefined,
      screenshots: [],
      notes: 'Single-page homepage concept — plumber in Dublin. Strong local SEO opportunity.',
      lastChangedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    notes: 'Brian was responsive in initial contact. Confirmed interest in a website. Strong local SEO case.',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    outbound: {
      pitchEmail: undefined, // not yet drafted
      sendStatus: undefined,
    },
    tags: ['plumber', 'dublin', 'local-seo'],
  },
  {
    id: 'cpk-heating-plumbing',
    name: 'Brian McGarry (CPK)',
    businessName: 'CPK Heating & Plumbing',
    industry: 'HVAC / Plumbing',
    location: 'Ireland',
    website: 'https://cpkheating.ie',
    score: 42,
    contact: {
      name: 'Brian McGarry',
      role: 'Commercial Director',
      email: undefined,
      phone: '+353 87 123 4567',
    },
    stage: 'qualified',
    concept: createEmptyConcept(),
    notes: 'UK entity dissolved Oct 2024. Irish entity active. Phone-only contact — no email found.',
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    tags: ['hvac', 'plumbing', 'concern-flag'],
  },
  {
    id: 'larkfield-plumbing-contractors',
    name: 'Sarah McGarry',
    businessName: 'Larkfield Plumbing Contractors Ltd',
    industry: 'Plumbing',
    location: 'Ireland',
    website: 'https://larkfield.ie',
    score: 41,
    contact: {
      name: 'Sarah McGarry',
      role: 'Managing Partner',
      email: undefined,
      phone: '+353 86 123 4567',
    },
    stage: 'opportunity_brief_ready',
    concept: createEmptyConcept(),
    notes: 'RGI listed. 29 years in operation. Strong commercial fit but phone-only.',
    createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    tags: ['plumbing', 'commercial', 'rgi-listed'],
  },
];

// ---------------------------------------------------------------------------
// CRM Store
// ---------------------------------------------------------------------------

export const useCrmStore = create<CrmStore>((set, get) => ({
  leads: MOCK_LEADS,
  selectedLeadId: null,

  // ---- Lead actions ----

  addLead: (lead) =>
    set((state) => ({
      leads: [...state.leads, lead],
    })),

  updateLead: (id, patch) =>
    set((state) => ({
      leads: state.leads.map((l) =>
        l.id === id ? { ...l, ...patch, updatedAt: new Date().toISOString() } : l
      ),
    })),

  selectLead: (id) => set({ selectedLeadId: id }),

  // ---- Concept actions ----

  updateConcept: (leadId, patch) =>
    set((state) => ({
      leads: state.leads.map((l) =>
        l.id === leadId
          ? {
              ...l,
              concept: { ...l.concept, ...patch, lastChangedAt: new Date().toISOString() },
              updatedAt: new Date().toISOString(),
            }
          : l
      ),
    })),

  setConceptStatus: (leadId, status, approvedBy) =>
    set((state) => ({
      leads: state.leads.map((l) =>
        l.id === leadId
          ? {
              ...l,
              concept: {
                ...l.concept,
                status,
                lastChangedAt: new Date().toISOString(),
                ...(status === 'approved' && approvedBy
                  ? { approvedBy, approvedAt: new Date().toISOString() }
                  : {}),
                ...(status === 'rework_needed'
                  ? { approvedBy: undefined, approvedAt: undefined }
                  : {}),
              },
              updatedAt: new Date().toISOString(),
            }
          : l
      ),
    })),

  // ---- Stage actions ----

  advanceStage: (leadId) =>
    set((state) => {
      const lead = state.leads.find((l) => l.id === leadId);
      if (!lead) return state;

      const order: LeadStage[] = [
        'lead_found', 'qualified', 'researched', 'opportunity_brief_ready',
        'concept_brief_ready', 'concept_in_build', 'concept_in_review',
        'concept_approved', 'outreach_drafted', 'awaiting_human_approval',
        'sent', 'monitor', 'parked', 'suppressed',
      ];
      const idx = order.indexOf(lead.stage);
      if (idx === -1 || idx >= order.length - 1) return state;

      return {
        leads: state.leads.map((l) =>
          l.id === leadId
            ? { ...l, previousStage: l.stage, stage: order[idx + 1], updatedAt: new Date().toISOString() }
            : l
        ),
      };
    }),

  regressStage: (leadId) =>
    set((state) => {
      const lead = state.leads.find((l) => l.id === leadId);
      if (!lead || !lead.previousStage) return state;

      return {
        leads: state.leads.map((l) =>
          l.id === leadId
            ? { ...l, stage: l.previousStage!, updatedAt: new Date().toISOString() }
            : l
        ),
      };
    }),

  setStage: (leadId, stage) =>
    set((state) => ({
      leads: state.leads.map((l) =>
        l.id === leadId
          ? { ...l, previousStage: l.stage, stage, updatedAt: new Date().toISOString() }
          : l
      ),
    })),

  // ---- Queries ----

  getLead: (id) => get().leads.find((l) => l.id === id),

  getLeadByThreadId: (threadId) => {
    // Derive lead from email gates — a gate's threadId links to the session/thread
    // For now, iterate through the signal-loom store's email gates
    // This requires access to the email gates from the main store
    // We use a best-effort match on threadId prefix
    const { leads } = get();
    // Leads that have outbound threadIds matching this threadId
    // In practice, email gates store the threadId directly
    return leads.find((l) => l.id === threadId || l.id.includes(threadId));
  },

  getSendGate: (leadId, emailGate) => {
    const lead = get().leads.find((l) => l.id === leadId);
    if (!lead) {
      return {
        ok: false,
        reason: 'Lead not found',
        checks: {
          conceptExists: false, conceptApproved: false, conceptHasPreview: false,
          outreachDrafted: false, humanApproved: false, mailboxReady: false,
        },
      };
    }
    const gateSummary = emailGate
      ? {
          gateExists: true,
          gateStatus: emailGate.gateStatus,
          humanApproved: emailGate.gateStatus === 'human_approved',
        }
      : { gateExists: false, gateStatus: 'none', humanApproved: false };
    return computeSendGate(lead, gateSummary);
  },

  getConceptBadge: (lead) => ({
    label: getConceptBadgeLabel(lead.concept),
    color: getConceptBadgeColor(lead.concept),
  }),
}));

// ---------------------------------------------------------------------------
// Derived selectors (for use in components)
// ---------------------------------------------------------------------------

/** All leads sorted by score descending */
export function useLeadsByScore() {
  return useCrmStore((s) => [...s.leads].sort((a, b) => b.score - a.score));
}

/** All leads in a given stage */
export function useLeadsByStage(stage: LeadStage) {
  return useCrmStore((s) => s.leads.filter((l) => l.stage === stage));
}

/** Leads that are concept-ready (concept exists and is approved) */
export function useConceptReadyLeads() {
  return useCrmStore((s) =>
    s.leads.filter((l) => conceptIsApproved(l.concept) && conceptHasOutput(l.concept))
  );
}

/** Leads that are sendable (concept approved + human approved + draft + output) */
export function useSendableLeads(emailGates: EmailGateStoreItem[]) {
  return useCrmStore((s) =>
    s.leads.filter((lead) => {
      const gate = emailGates.find((g) => g.threadId === lead.id);
      const sg = computeSendGate(lead, gate ? { gateExists: true, gateStatus: gate.gateStatus, humanApproved: gate.gateStatus === 'human_approved' } : null);
      return sg.ok;
    })
  );
}

/** All concept stages for a given lead — summary for dossier display */
export function useLeadConceptSummary(leadId: string) {
  return useCrmStore((s) => {
    const lead = s.leads.find((l) => l.id === leadId);
    if (!lead) return null;
    const c = lead.concept;
    return {
      status: c.status,
      label: getConceptBadgeLabel(c),
      color: getConceptBadgeColor(c),
      hasOutput: conceptHasOutput(c),
      isApproved: conceptIsApproved(c),
      previewUrl: c.previewUrl,
      screenshotCount: c.screenshots?.length ?? 0,
      qaPassed: c.qaFindings?.overallPass ?? null,
      qaFindings: c.qaFindings?.findings ?? [],
      approvedBy: c.approvedBy,
      approvedAt: c.approvedAt,
      tier: c.tier,
      lastChanged: c.lastChangedAt,
    };
  });
}
