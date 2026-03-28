# Signal Loom — Sprint 1 Build Brief
## For Hephaestus (Forge) — Build Session

---

## Context

**Signal Loom** is the bespoke mission control UI for Nero and the OpenClaw agent roster.
This is Sprint 1 — a high-value shell and workflow proof, NOT a full product build.

**Visual Direction:** Midnight Broadcast — warm-dark signal desk with live system energy and calm reading surfaces. Chrome expressive, reading surfaces calm.

**Reference Docs (read these first):**
- `../VENTURES/signal-loom/visual-direction-pack.md` — full token system, color palette, typography, motion language
- This brief defines Sprint 1 scope, acceptance criteria, and mock data requirements

**Project Root:** `/home/likwid/.openclaw/workspace/signal-loom/`

---

## Tech Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui (primitives)
- Framer Motion (used lightly)
- Zustand or Jotai (ephemeral UI state)
- Mock adapter layer for Sprint 1 runtime data

---

## Sprint 1 Scope (exactly these — no additions)

### Must Build
1. **Mission Control Shell** — top bar + left thread dock + center Nero workspace + right live agent rail + bottom runtime health strip
2. **Thread Dock** — 8 mock threads with full status system (active/waiting_on_nero/waiting_on_specialist/waiting_on_user/blocked/done), pinned section, unread + approval badges
3. **Nero Chat Surface** — message list (user/Nero/system/action-summary), thread header, composer
4. **Live Agent Rail** — 5 specialist cards (Hephaestus/Argus/Ariadne/Orion/Hermes), each with name, role, state, task preview, browser-enabled badge
5. **Runtime Health Strip** — gateway health, queue health, heartbeat freshness, browser lanes, canvas disabled, issue count
6. **Approvals Panel** — 3 mock items (high/medium/low urgency), visible count, source thread jump

### Must Implement
- Full Midnight Broadcast token system (backgrounds, surfaces, text, states, accents, radii, spacing, shadows, timing)
- Three typography roles (display/headline, body/UI, mono/technical)
- Motion baseline (thread select, approval open, agent pulse, panel hover, reduced-motion fallback)
- Mock data layer (8 threads, 5 agents, 3 approvals, 1 runtime state with one non-critical issue)

### Must Respect
- **Chrome expressive, reading surfaces calm** — never sacrifice reading comfort for decoration
- Agent accent colors: Nero=red-orange+brass, Hephaestus=ember orange, Argus=brass amber, Ariadne=soft violet, Orion=phosphor teal, Hermes=coral gold
- Nero must feel emotionally central — not just physically large

---

## Explicitly Out of Scope

Dual-thread mode, thread branching, full delegation timeline, roster page, runtime deep-dive, session trace drawer, artifact preview, search complexity beyond lightweight, per-agent detail pages, config editing, Tauri/Electron packaging, desktop wrappers, analytics, multi-user.

---

## File Structure

```
app/
  layout.tsx
  page.tsx
  globals.css
components/
  shell/
    mission-shell.tsx
    top-bar.tsx
    runtime-strip.tsx
  threads/
    thread-dock.tsx
    thread-list-item.tsx
    thread-header.tsx
  chat/
    nero-workspace.tsx
    message-list.tsx
    message-card.tsx
    action-summary-block.tsx
    composer.tsx
  agents/
    live-agent-rail.tsx
    agent-card.tsx
  approvals/
    approvals-panel.tsx
    approval-card.tsx
lib/
  tokens/
  mock/
  types/
  utils/
```

---

## Mock Data Spec

### 8 Threads
- 3 active
- 2 waiting (1 on Nero, 1 on specialist)
- 1 blocked
- 1 done
- 1 pinned

Each thread: `{ id, title, status, lastActive, unreadCount, hasApproval, linkedAgents }`

### 5 Agent States
- Hephaestus: active
- Argus: idle or reviewing
- Ariadne: active
- Orion: waiting
- Hermes: done

Each agent: `{ id, name, role, status, taskPreview, browserEnabled }`

### 3 Approvals
- 1 high urgency
- 1 medium
- 1 low

Each: `{ id, title, urgency, raisedBy, recommendation, linkedThreadId }`

### Runtime State
Healthy with one visible non-critical issue indicator.

---

## Build Phases

**Phase A — Foundation:** Scaffold Next.js app, define layout, define tokens, define data shapes, stand up mock data.

**Phase B — Primary Surfaces:** Thread dock, Nero workspace, live agent rail, runtime strip.

**Phase C — Approvals:** Approvals entry, panel, cards, source-thread jump.

**Phase D — Quality Pass:** Density tuning, motion tuning, accessibility cleanup.

---

## Ariadne Review Gates

After each of Phases A, B, and C, ping Ariadne for visual review before proceeding. Ariadne can veto any styling that breaks the Midnight Broadcast direction or reading comfort.

Gate 1: tokens + shell
Gate 2: working surfaces (thread dock + Nero workspace + live rail)
Gate 3: pre-acceptance (long-session comfort, visual coherence)

---

## Success Definition

Sprint 1 succeeds if Gbemi can open the app and feel:
- Nero is visually and functionally central
- The UI is attractive enough to return to
- Thread switching is clean
- Live agent activity is visible without being noisy
- Approvals are surfaced clearly
- Runtime truth is visible without clutter
- Ariadne signs off

---

## Deliverables at Sprint End

1. Working local app shell (runnable with `npm run dev`)
2. Styled thread dock
3. Styled Nero chat surface
4. Styled live agent rail
5. Styled runtime strip
6. Styled approvals panel
7. Token foundation
8. Mock data source
9. Short implementation note
10. Known gaps list

Report back to Nero with the repo location and a brief summary of what was built.
