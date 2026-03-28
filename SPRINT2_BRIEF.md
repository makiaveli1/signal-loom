# Signal Loom — Sprint 2 Build Brief
## For Hephaestus (Forge) — Build Session

---

## Context

**Signal Loom Sprint 2 — "genuinely useful multithreaded operator cockpit."**

Read these first:
- `/home/likwid/.openclaw/workspace/signal-loom/SPRINT1_BRIEF.md` (Sprint 1 scope)
- `/home/likwid/.openclaw/workspace/signal-loom/VISUAL_DIRECTION_PACK.md` (Midnight Broadcast)
- `/home/likwid/.openclaw/workspace/signal-loom/SPRINT1_5_BRIEF.md` (Sprint 1.5 fixes)

**Project root:** `/home/likwid/.openclaw/workspace/signal-loom/`

Tech stack unchanged: Next.js + TypeScript + Tailwind CSS + shadcn/ui + Framer Motion + Zustand

---

## Nero's Operator Event Language (AUTHORITY — use these exact phrasings)

These are the approved human-readable phrases for the delegation timeline. Do not rephrase.

| Event type | Operator phrasing |
|---|---|
| `received` | "You sent a message" |
| `delegated` | "Nero assigned to {agent}" |
| `agent_active` | "{agent} is working on it" |
| `agent_returned` | "{agent} returned" |
| `approval_requested` | "Approval requested — {title}" |
| `decision_made` | "You decided: {outcome} on {title}" |

Timeline rules:
- Never show raw logs or internal event names
- Keep to one line per event
- Use the exact phrasing above, inserting real values for {agent}, {title}, {outcome}
- Filter control: show all / by agent — that's it, nothing more complex

---

## Thread Context Summary (Center Pane Enrichment)

For sparse/light threads, show a contextual summary block below the thread header:

| Thread status | Context line |
|---|---|
| `waiting_on_nero` | "Nero is thinking through this" |
| `waiting_on_specialist` | "{agent} is working on it" |
| `waiting_on_user` | "Needs your call" |
| `blocked` | "Blocked — {brief reason}" |
| `active` | Show delegation timeline only if recent events exist |

This summary block belongs in the thread header area or just below it. Not a dashboard widget — just a single line of context.

---

## Sprint 2 Scope

### Must Build

#### 1. Split-View Architecture (Phase A)
- Zustand: add `SplitViewState` `{ enabled, primaryThreadId, secondaryThreadId, activePane }`
- Main layout: when `enabled=true`, center pane becomes a CSS flex split (left/right panes, equal width, 1px divider)
- Each pane: independent thread content (messages, header, composer)
- Active pane: brighter background, subtle left border accent
- Inactive pane: slightly dimmed (opacity ~0.75), no border accent
- Keyboard: `Tab` or `Ctrl+\`` to switch active pane
- Thread dock: selecting a new thread while split is active opens it in the secondary pane
- Close split: clicking the "X" on secondary pane or pressing `Escape`

#### 2. Delegation Timeline (Phase B)
- New types: `DelegationEvent` (see below)
- New component: `components/chat/delegation-timeline.tsx`
- Placement: inside the thread workspace, below the thread header, above messages
- Appearance: vertical line with event nodes, each node = icon + time + one-line phrase
- Mock data: 6 events for thread-1, 3 for thread-8
- Filter: show all / by Hephaestus / by Argus / by Ariadne / by Orion / by Hermes
- Link events to source messages where `linkedMessageId` is set (clicking highlights the message)
- Style: compact, readable, not a log wall — max 5 visible events, "show more" if more exist

```ts
type DelegationEvent = {
  id: string
  threadId: string
  type: 'received' | 'delegated' | 'agent_active' | 'agent_returned' | 'approval_requested' | 'decision_made'
  actor: string
  targetAgentId?: string
  title: string
  detail?: string
  createdAt: string  // ISO
  linkedMessageId?: string
}
```

#### 3. Composer Action Path (Phase C)
- Extend Zustand: add `composerState: { isSending, error, lastSentAt }`
- On send: set `isSending=true`, wait 600ms (mock latency), append user message to thread, clear composer, set `lastSentAt`
- On error (mock 10% chance): set `error` message, keep text in composer, clear error after 3s
- Message appears instantly with a subtle "sending..." transient state, then confirms
- Do NOT integrate with live OpenClaw RPC — this is a state-layer proof

#### 4. Approval-to-Thread Flow (Phase D)
- Approval card "Review" button: already jumps to source thread — confirm it works
- New: when viewing a thread that has a pending approval, show a small approval indicator in the thread header (already partially there — verify and strengthen)
- New: in the delegation timeline, `approval_requested` events are surfaced with a brass accent; `decision_made` events show the outcome
- Thread context: if current thread has a pending approval, show a subtle "1 approval pending" chip with a click that opens the approvals panel and highlights the item

#### 5. Center-Pane Contextual Enrichment (Phase E)
- Thread context summary block (see table above) shown below thread header when thread has low message volume (≤2 messages)
- For `waiting_on_user` threads: show the pending approval title prominently
- Empty state (no thread selected): keep the current centered empty state — it's fine

---

## Zustand Store Additions

```ts
// Add to SignalLoomStore:
splitView: SplitViewState  // { enabled, primaryThreadId, secondaryThreadId, activePane }
composerState: ComposerState  // { isSending, error, lastSentAt }
delegationEvents: DelegationEvent[]

// Actions:
setSplitView(enabled: boolean, secondaryThreadId?: string): void
setActivePane(pane: 'left' | 'right'): void
sendMessage(threadId: string, content: string): void  // handles async send
clearComposerError(): void
```

---

## Mock Data Additions

### Delegation events for thread-1:
```ts
[
  { id: 'ev-1-1', threadId: 'thread-1', type: 'received', actor: 'user', title: 'You sent a message', createdAt: <ISO>, linkedMessageId: 'msg-1-1' },
  { id: 'ev-1-2', threadId: 'thread-1', type: 'delegated', actor: 'nero', targetAgentId: 'hephaestus', title: 'Nero assigned to Hephaestus', createdAt: <ISO> },
  { id: 'ev-1-3', threadId: 'thread-1', type: 'agent_active', actor: 'hephaestus', title: 'Hephaestus is working on it', createdAt: <ISO> },
  { id: 'ev-1-4', threadId: 'thread-1', type: 'agent_returned', actor: 'hephaestus', title: 'Hephaestus returned', createdAt: <ISO> },
  { id: 'ev-1-5', threadId: 'thread-1', type: 'approval_requested', actor: 'hephaestus', title: 'Approval requested — Deploy Verdantia API fixes to staging', createdAt: <ISO> },
  { id: 'ev-1-6', threadId: 'thread-1', type: 'decision_made', actor: 'user', title: 'You decided: approved on Deploy Verdantia API fixes to staging', createdAt: <ISO> },
]
```

### Delegation events for thread-8:
```ts
[
  { id: 'ev-8-1', threadId: 'thread-8', type: 'received', actor: 'user', title: 'You sent a message', createdAt: <ISO>, linkedMessageId: 'msg-8-1' },
  { id: 'ev-8-2', threadId: 'thread-8', type: 'delegated', actor: 'nero', targetAgentId: 'hephaestus', title: 'Nero assigned to Hephaestus', createdAt: <ISO> },
  { id: 'ev-8-3', threadId: 'thread-8', type: 'delegated', actor: 'nero', targetAgentId: 'argus', title: 'Nero assigned to Argus', createdAt: <ISO> },
  { id: 'ev-8-4', threadId: 'thread-8', type: 'agent_active', actor: 'argus', title: 'Argus is working on it', createdAt: <ISO> },
  { id: 'ev-8-5', threadId: 'thread-8', type: 'agent_returned', actor: 'argus', title: 'Argus returned', createdAt: <ISO> },
]
```

---

## Build Phases

**Phase A:** Split-view layout + Zustand state
**Phase B:** Delegation timeline component + mock data
**Phase C:** Composer action wiring
**Phase D:** Approval-to-thread flow
**Phase E:** Center context enrichment + Ariadne review gates

**After Phase A:** Flag Ariadne for split-view gate review
**After Phase B:** Flag Ariadne for timeline readability review
**After Phase E:** Ariadne final sign-off → report to Nero

---

## Explicitly NOT Adding

No backend, no live OpenClaw integration, no dual-pane composer (both panes share the thread dock + live rail), no branching, no trace drawer, no settings pages.

---

## Deliverables

Report to Nero on completion:
1. Split-view working (how to use: select thread, press button to split)
2. Delegation timeline in thread-1 and thread-8
3. Composer sends messages into the thread state
4. Approval-to-thread links confirmed
5. Context enrichment for sparse threads
6. Build passes clean
7. Known gaps
