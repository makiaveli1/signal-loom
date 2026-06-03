# Signal Loom Operator QoL Roadmap Implementation Plan

> For Hermes: Use subagent-driven-development skill to implement this plan task-by-task. Keep current dirty chatbox polish intact unless a task explicitly touches those files. Do not push without user approval.

Goal: Elevate Signal Loom from a polished chat cockpit into a trustworthy local Hermes operator workspace with clearer runtime truth, session triage, handoffs, receipts, verification, mobile operations, and safety labels.

Architecture: Add pure derivation helpers first, then wire small UI panels and controls into the existing Zustand store and shell. Prefer client-side read-only features and explicit copy/export actions before adding new mutating API routes. Any route that mutates settings, approvals, updates, chat, or local config remains local-only, labelled, and verification-gated.

Tech Stack: Next.js App Router, TypeScript, React client components, Zustand store, existing Hermes/OpenClaw adapter routes, CSS tokens in app/globals.css, Node test runner, Playwright smoke.

---

## Phase 0: Baseline and Safety

### Task 0.1: Preserve live state evidence

Objective: Re-check branch, dirty files, package scripts, listener binding, and current browser state before edits.

Files: none.

Steps:
1. Run `git status --short --branch`.
2. Run `git diff --stat`.
3. Run `node -e "const p=require('./package.json'); console.log(JSON.stringify(p.scripts,null,2))"`.
4. Verify dev binds `0.0.0.0:3098` using `ss -ltnp | grep ':3098'` and bounded `curl`.

Expected: current tree is dirty from chatbox polish and new QoL edits; no push.

### Task 0.2: Add dashboard focus collapse

Objective: Let the dashboard/context area above the chat collapse fully so the message list can use the pane.

Files:
- Modify: `components/chat/thread-pane.tsx`
- Modify: `components/threads/thread-header.tsx`
- Modify: `app/globals.css`

Steps:
1. Add persisted `signal-loom:chat-dashboard-collapsed` state in `ThreadPane`.
2. Add `Focus chat` button in `ThreadHeader`.
3. When collapsed, hide preset switcher, header, receipts/info panel, context enrichment, and approval banner.
4. Render an absolute `Dashboard` restore button that consumes no layout height.
5. Verify with typecheck and browser smoke.

---

## Phase 1: Trust and Friction Killers

### Task 1.1: Add shared connection truth model

Objective: Convert runtime/detection data into one UI-ready truth summary.

Files:
- Create: `lib/operator-qol.ts`
- Test: `lib/operator-qol.test.ts`
- Modify: `lib/status-truth.ts` only if existing helpers need reuse.

Steps:
1. Add `buildConnectionTruthSummary(detection, runtime)` returning state, sendAllowed, checks, nextActions, warnings.
2. Add tests for ready, needs token, API unreachable, state DB missing, gateway degraded.
3. Use redacted values only.
4. Run `npm test -- lib/operator-qol.test.ts` through repo test script pattern if supported, then full `npm test`.

### Task 1.2: Upgrade connection truth panel

Objective: Make the top status chip explain exactly what works, what blocks sending, and what to do next.

Files:
- Modify: `components/shell/top-bar.tsx`
- Modify: `components/shell/runtime-strip.tsx`
- Modify: `components/shell/hermes-settings-panel.tsx` if deep-link copy is needed.

Steps:
1. Replace vague count-only status with primary state label.
2. Show grouped checks: Local install, API auth, State DB, Live stream, Gateway.
3. Add copyable next-step rows for recoverable failures.
4. Keep token/config redaction.
5. Verify desktop/mobile accessible names.

### Task 1.3: Add handoff/report generation helper

Objective: Generate markdown and JSON handoffs from current thread, messages, approvals, delegation events, and runtime summary.

Files:
- Create: `lib/report-export.ts`
- Test: `lib/report-export.test.ts`

Steps:
1. Define `buildThreadHandoffReport()` and `buildReceiptsReport()`.
2. Include thread status, session ID, message counts, child lanes, approvals, receipt summaries, verification status placeholder, next action.
3. Add tests for missing transcript, pending approval, child lane, and redaction-like content.

### Task 1.4: Add handoff generator UI

Objective: Give the operator one-click Copy Handoff / Fill Composer / Export Markdown.

Files:
- Create: `components/chat/handoff-generator.tsx`
- Modify: `components/chat/thread-pane.tsx`
- Modify: `components/shell/hermes-command-center.tsx`

Steps:
1. Render compact handoff controls in the receipts/session area or thread header action area.
2. Add copy-to-clipboard with explicit copied state.
3. Add Blob `.md` download.
4. Add a command-center action that prepares the handoff prompt instead of sending.

### Task 1.5: Improve receipt summaries

Objective: Make collapsed receipts explain command/tool/status/duration/error and support export.

Files:
- Create: `lib/tool-receipts.ts`
- Test: `lib/tool-receipts.test.ts`
- Modify: `components/chat/message-card.tsx`
- Modify: `components/chat/thread-pane.tsx`

Steps:
1. Extract receipt parsing out of `message-card.tsx` into pure helper.
2. Build thread-level receipt aggregate.
3. Add Copy summary and Export selected/all controls.
4. Verify operational text remains linkified and no layout overflow.

---

## Phase 2: Operator Workflow

### Task 2.1: Session intelligence and triage

Objective: Make session lists sortable/searchable by operator need.

Files:
- Create: `lib/session-intelligence.ts`
- Test: `lib/session-intelligence.test.ts`
- Modify: `components/threads/thread-dock.tsx`
- Modify: `components/threads/thread-list-item.tsx`
- Modify: `components/threads/thread-header.tsx`

Steps:
1. Derive categories: needs-you, running, waiting-agent, blocked, recent, done, hidden.
2. Add search over title/session ID/preview/tags/status.
3. Add filter chips and compact labels.
4. Keep selected/conversation bundle behavior stable.

### Task 2.2: Context chips

Objective: Show the active working set at a glance.

Files:
- Create: `components/ui/context-chip.tsx`
- Create: `lib/context-chips.ts`
- Modify: `components/threads/thread-header.tsx`
- Modify: `components/chat/composer.tsx`

Steps:
1. Derive chips for status, dirty/local context, pending approval, child lanes, transcript freshness, fallback/local-only state.
2. Render 3-5 priority chips above/near composer and header.
3. Keep verbose details behind disclosure.

### Task 2.3: Composer modes

Objective: Convert composer from generic textarea into mode-aware cockpit input.

Files:
- Modify: `lib/types/index.ts`
- Modify: `lib/store.ts`
- Modify: `components/chat/composer.tsx`

Steps:
1. Add `ComposerMode = chat | plan | execute | review | debug | research | handoff`.
2. Add store state/action and local persistence.
3. Change placeholder, chips, and scaffold text per mode.
4. Do not auto-send.

### Task 2.4: Command palette 2.0

Objective: Make command center searchable and action-oriented without hidden side effects.

Files:
- Modify: `components/shell/hermes-command-center.tsx`
- Modify: `lib/store.ts` if panel toggles need central actions.

Steps:
1. Add search input and grouped command model.
2. Commands may open panels, switch layout, fill composer, copy/export, or show settings.
3. Label action class: safe, fills prompt, opens panel, requires approval.
4. Preserve focus trap and Escape close.

### Task 2.5: Verification panel

Objective: Make build/browser/runtime confidence a first-class visible panel.

Files:
- Create: `components/shell/verification-panel.tsx`
- Modify: `components/shell/mission-shell.tsx`
- Modify: `components/shell/top-bar.tsx`
- Modify: `components/shell/runtime-strip.tsx`

Steps:
1. Show local checks: connection truth, runtime health, sessions fetch, live SSE, approvals sync boundary, last browser smoke placeholder.
2. Add copy verification summary.
3. Avoid running shell commands from browser in this phase.

---

## Phase 3: Experience Polish and Safety

### Task 3.1: Approval inbox trust labels

Objective: Make gateway vs derived vs mock/local decisions impossible to confuse.

Files:
- Create: `components/ui/local-safety-label.tsx`
- Modify: `components/approvals/approval-card.tsx`
- Modify: `components/approvals/approvals-panel.tsx`

Steps:
1. Add labels: Gateway synced, Local only, Derived, Dev mock, Unsynced decision.
2. Add Revise action visibility.
3. Add filters: pending, gateway, local/derived, high risk, decided.
4. Keep local-only resolve language persistent after decision.

### Task 3.2: Mobile operator bar

Objective: Give mobile users one-thumb access to Loom, Lanes, Command, Approvals, Verify, Settings.

Files:
- Create: `components/shell/mobile-operator-bar.tsx`
- Modify: `components/shell/mission-shell.tsx`
- Modify: `app/globals.css`

Steps:
1. Add bottom fixed bar under compact breakpoint.
2. Wire to existing panel/drawer toggles.
3. Preserve 44px touch targets and zero horizontal overflow.

### Task 3.3: Layout presets upgrade

Objective: Make presets explain their use and control both workspace panes and shell chrome.

Files:
- Modify: `components/chat/pane-preset-switcher.tsx`
- Modify: `lib/types/index.ts`
- Modify: `lib/store.ts`
- Modify: `components/shell/mission-shell.tsx` if shell rails become preset-aware.

Steps:
1. Add descriptive labels: Focus, Compare, Review, Verify, Ops.
2. Persist choice.
3. On compact screens, resolve to Focus + mobile bar.

### Task 3.4: Lane presence

Objective: Turn lanes from static cards into live presence indicators.

Files:
- Create: `lib/lane-presence.ts`
- Test: `lib/lane-presence.test.ts`
- Modify: `components/agents/live-agent-rail.tsx`
- Modify: `components/agents/agent-card.tsx`
- Modify: `components/threads/thread-header.tsx`

Steps:
1. Derive running, created/no breadcrumb, recently active, completed, stale.
2. Add latest task, age, and jump/follow action.
3. Fix `loadAgents()` erasing derived session agents if needed.

### Task 3.5: Empty/degraded states

Objective: Broken runtime states should be useful, not cryptic.

Files:
- Create: `components/ui/degraded-state.tsx`
- Modify: `components/chat/nero-workspace.tsx`
- Modify: `components/threads/thread-dock.tsx`
- Modify: `components/chat/composer.tsx`
- Modify: `components/shell/runtime-strip.tsx`

Steps:
1. Add state-specific copy for missing binary, needs token, API unreachable, state DB missing, no sessions, no approvals.
2. Add direct recovery actions that open settings or copy setup commands.
3. Never imply chat can send when the gate blocks it.

### Task 3.6: Local safety hardening UI

Objective: Show local exposure and mutation boundaries before dangerous operations.

Files:
- Modify: `components/shell/hermes-settings-panel.tsx`
- Modify: `app/api/hermes/settings/route.ts`
- Modify tests under `app/api/openclaw/runtime-contract-routes.test.ts` or new route tests.

Steps:
1. Add read-only local safety card: bind address, token source, config write ability, approval sync boundary, update ability.
2. Add tests for redaction and invalid mutation input.
3. Do not add browser-triggered install commands.

---

## Final Verification Gates

Run after each code phase:

```bash
git diff --check
npm run lint
npm run typecheck
npm test
npm run build
```

Browser smoke after UI phases:
- desktop 1440x900
- mobile 390x844
- console/page errors none
- no Next error overlay/hydration failure
- no horizontal overflow
- no duplicate IDs
- no unnamed visible controls
- dashboard collapse hides top context and restores cleanly
- mobile operator bar controls are reachable and named
- connection truth/verification/handoff/approval panels open and close with keyboard/mouse

No push without explicit approval.
