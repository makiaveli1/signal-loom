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

/**
 * CRM — Lead data (migrated from workspace LEADS/ markdown files, 2026-04-01)
 *
 * Outreach rule: phone-only leads (CPK, Larkfield) cannot receive email outreach.
 * They are tracked here for concept pipeline but email gates do not apply.
 * Phone/SMS outreach is a deferred capability (pending Round 2).
 */
const MOCK_LEADS: Lead[] = [
  {
    id: 'brian-mcgarry-plumber',
    name: 'Brian McGarry',
    businessName: 'Brian McGarry Plumber',
    industry: 'Plumbing',
    location: 'Dublin 12, Ireland',
    website: undefined,
    score: 44,
    contact: {
      name: 'Brian McGarry',
      role: 'Owner',
      email: 'brianmcgarry90@gmail.com',
      phone: '087 618 2500',
      phoneSecondary: '01-4424089',
    },
    stage: 'concept_in_review',
    concept: {
      status: 'internal_review',
      conceptType: 'homepage_mock',
      tier: 1,
      previewUrl: 'http://127.0.0.1:4312/',
      screenshots: [
        'LEADS/brian-mcgarry-plumber/artifacts/brian-home-mobile.png',
        'LEADS/brian-mcgarry-plumber/artifacts/brian-home-desktop.png',
      ],
      buildPath: '/home/likwid/.openclaw/workspace/LEADS/brian-mcgarry-plumber',
      notes:
        'Tier 1 static homepage concept built as a mobile-first tap-to-call page. ' +
        'Hero = name + direct mobile. 5 sections only. ' +
        'Sticky mobile CTA included. No contact form. ' +
        'RGI claim intentionally left unmade pending confirmation. ' +
        'Ready for Ariadne visual QA.',
      lastChangedAt: new Date().toISOString(),
    },
    notes:
      'Genuine sole trader since 2014. Responsive in initial contact. ' +
      'Personal Gmail usable. Strong local SEO case. ' +
      'GBP does not exist — must be claimed/created. ' +
      'Content gaps: RGI status unconfirmed, 0 testimonials, no photography. ' +
      'Launch blockers: RGI confirmation + 3 testimonials + service list. ' +
      'CONCEPT_BRIEF.md exists — full spec ready for Forge.',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    outbound: {
      pitchEmail: undefined,
      sendStatus: undefined,
    },
    tags: ['plumber', 'dublin', 'local-seo', 'no-website', 'sole-trader', 'real'],
  },
  {
    id: 'cpk-heating-plumbing',
    name: 'Brian McGarry',
    businessName: 'CPK Heating & Plumbing',
    industry: 'HVAC / Plumbing',
    location: 'Dublin 12, Ireland',
    website: 'https://cpkheatingandplumbing.ie',
    score: 42,
    contact: {
      name: 'Brian McGarry',
      role: 'Commercial Director',
      email: undefined,
      phone: '087 232 6258',
      phoneSecondary: '01 455 9506',
    },
    stage: 'qualified',
    concept: createEmptyConcept(),
    notes:
      '⚠️ CONCERN: UK entity (CPK PLUMBING & HEATING LTD) dissolved Oct 2024. ' +
      'Irish entity active (CRO). Website: 2/10 design quality, AI boilerplate, 404s on /about and /contact. ' +
      'Phone-only contact. RGI claimed on website. ' +
      'Email absent — outreach route unclear. ' +
      'Parked pending email contact route or phone/SMS capability.',
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    tags: ['hvac', 'plumbing', 'concern-flag', 'phone-only', 'no-email', 'real'],
  },
  {
    id: 'larkfield-plumbing-contractors',
    name: 'Sarah McGarry',
    businessName: 'Larkfield Plumbing Contractors Ltd',
    industry: 'Plumbing',
    location: 'Dublin 6W / Kimmage, Ireland',
    website: undefined,
    score: 41,
    contact: {
      name: 'Sarah McGarry',
      role: 'Managing Partner',
      email: undefined,
      phone: '086 248 6922',
    },
    stage: 'opportunity_brief_ready',
    concept: createEmptyConcept(),
    notes:
      'Irish Ltd (CRO #249634) since 1996 — 29 years. Status: NORMAL. ' +
      'RGI listed. No website. Phone-only contact. ' +
      'Strong commercial fit — established Ltd with RGI and 29-year track record. ' +
      'Email absent — outreach route unclear. ' +
      'Parked pending email contact route or phone/SMS capability.',
    createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    tags: ['plumbing', 'commercial', 'rgi-listed', 'phone-only', 'no-email', 'irish-ltd', 'real'],
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
