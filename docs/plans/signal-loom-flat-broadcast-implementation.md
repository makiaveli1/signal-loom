# Signal Loom Flat Broadcast Implementation Plan

> **Status:** Historical implementation plan. The original guardrail was “do not push unless Gbemi explicitly asks”; Gbemi later explicitly requested repo cleanup and GitHub push on 2026-06-01.

**Goal:** Apply a flatter, image-aware Signal Loom design language across the app while preserving the local Hermes/operator cockpit identity.

**Architecture:** The redesign is token-first: global semantic tokens and CSS surface classes define the flat language, then shell, chat, rail, approval, and overlay components consume that contract. Generated images are integrated only into rest/empty/theme/sigil contexts, never as required operational information.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind v4, shadcn/ui primitives, CSS semantic tokens, Codex CLI built-in image generation for raster assets.

---

## Evidence checkpoint

- Handoff read: `/home/likwid/handoffs/signal-loom-2026-05-27-handoff.md`.
- Live repo rechecked on `2026-06-01` before edits.
- Workdir: `/home/likwid/projects/signal-loom`.
- Branch after checkpoint: `main...origin/main [ahead 1]`.
- Local checkpoint commit: `6ef3b87 chore: checkpoint Signal Loom identity and flat-system baseline`.
- Remote sync after checkpoint: `git fetch origin && git pull --rebase origin main` reported current branch up to date.
- Dev server baseline: `npm run dev` binds `0.0.0.0:3098`; `dev:loopback` is WSL-only.
- Static baseline before checkpoint passed: `npm run typecheck && npm run lint && npm test && git diff --check`.

## Safety rules

1. Do not push.
2. Do not send real chat completions through `/api/openclaw/chat/stream` for visual QA.
3. Keep generated images outside active transcript text areas.
4. Preserve identity detection/customizable agent behavior.
5. Keep `docs/LAYOUT_DISCIPLINE.md` height/overflow ownership intact.
6. Verify every claim with fresh commands after the final code change.

---

## Task 1: Keep the design spec as the source of truth

**Objective:** Use the existing Studio spec as the product/design contract.

**Files:**
- Existing: `docs/visual-system-flat-broadcast.md`
- Create: `docs/plans/signal-loom-flat-broadcast-implementation.md`

**Steps:**
1. Confirm the spec contains direction, token strategy, component language, image constraints, and acceptance checks.
2. Keep implementation notes in this plan rather than bloating component comments.
3. Verify docs are staged only with intentional changes.

**Verification:**
- `git diff -- docs/visual-system-flat-broadcast.md docs/plans/signal-loom-flat-broadcast-implementation.md`

---

## Task 2: Token and CSS surface pass

**Objective:** Make flat surfaces the default visual grammar.

**Files:**
- Modify: `app/globals.css`
- Review: `lib/theme.ts`

**Steps:**
1. Preserve current theme IDs and `data-signal-theme` behavior.
2. Use semantic tokens for flat surfaces, dividers, hover, accent, decision, danger, radius, and overlay shadow.
3. Remove ordinary-card glow/blur/shadow through late CSS overrides.
4. Keep meaningful overlay elevation for command/settings/approval panels.
5. Reduce continuous decorative motion where not tied to live state.

**Verification:**
- `npm run typecheck`
- `npm run lint`
- visual browser smoke at `1440x900` and `390x844`

---

## Task 3: Shell chrome and layout controls

**Objective:** Make the header, layout shelf, rails, and runtime strip read as a crisp ruled workbench rather than a stacked glow cockpit.

**Files:**
- Modify: `components/shell/top-bar.tsx`
- Modify: `components/shell/mission-shell.tsx`
- Modify: `components/shell/runtime-strip.tsx`
- Modify: `components/threads/thread-dock.tsx`
- Modify: `components/agents/live-agent-rail.tsx`

**Steps:**
1. Keep Signal Loom identity visible in the top bar.
2. Use flat text+dot status chips.
3. Keep rail toggles discoverable and labelled.
4. Keep mobile drawers overlay-based and mutually exclusive.
5. Avoid adding fixed widths that cause horizontal overflow.

**Verification:**
- Browser probe: no horizontal overflow at desktop/mobile.
- Browser probe: no unnamed visible controls.
- Browser probe: mobile Loom and Lanes drawers open/close normally.

---

## Task 4: Core transcript, composer, lanes, and approvals

**Objective:** Flatten the primary work surfaces while keeping operational state clear.

**Files:**
- Modify: `components/chat/message-card.tsx`
- Modify: `components/chat/message-list.tsx`
- Modify: `components/chat/composer.tsx`
- Modify: `components/chat/thread-pane.tsx`
- Modify: `components/chat/pane-preset-switcher.tsx`
- Modify: `components/approvals/approval-card.tsx`
- Modify: `components/approvals/approvals-panel.tsx`

**Steps:**
1. Message cards use one border and one role edge.
2. Composer uses a stronger flat raised input frame and visible focus state.
3. Work trace/receipt panels use rules and folded sections, not decorative glow.
4. Agent/lane cards keep text labels for state and use a left edge for activity.
5. Approval cards use decision/danger language with explicit source labels.

**Verification:**
- Typing into composer enables send when runtime state permits.
- Approvals panel opens/closes without console/page errors.
- Details/receipt controls remain keyboard and screen-reader named.

---

## Task 5: Generated image first batch

**Objective:** Add image richness without poisoning the workbench with generic decoration.

**Files:**
- Create: `public/generated/atmosphere/signal-field.webp`
- Create: `public/generated/empty-states/quiet-loom.webp`
- Create: `public/generated/agents/operator-sigil.webp`
- Create: `docs/generated-image-inventory.md`

**Steps:**
1. Generate raster images via Codex CLI built-in image generation.
2. Generate outside the repo first.
3. Inspect outputs and reject visible text, fake logos, generic robots, or bad contrast.
4. Convert/compress with available local tools.
5. Integrate only into rest/empty states or theme/identity previews.
6. Mark decorative images as `alt=""` / `aria-hidden` unless they carry semantic state duplicated by visible text.

**Verification:**
- `file public/generated/**/*.webp`
- `find public/generated -type f -printf '%p %s bytes\n'`
- Browser probe confirms images do not create layout shift or contrast loss.

---

## Task 6: Final verification lane

**Objective:** Produce current-tree evidence before claiming the redesign works.

**Commands:**
```bash
npm run typecheck
npm run lint
npm test
npm run build
git diff --check
```

**Browser QA:**
- Desktop `1440x900`.
- Mobile `390x844`.
- Compact breakpoint under `900px`.
- At least Midnight Broadcast, Papyrus Dawn, and Sentry Contrast.
- Console errors: 0.
- Page errors: 0.
- Horizontal overflow delta: 0.
- Duplicate IDs: 0.
- Visible unnamed controls: 0.
- Mobile drawer open/close/open works.
- Composer label and send enablement work.
- Generated image payload is within budget or explicitly called out.

---

## Kanban execution notes

Board: `signal-loom-flat-design`

Approved/unblocked work cards:
- `t_aad49368` — approval gate
- `t_eb5e4600` — safety checkpoint and baseline
- `t_9ce3a601` — visual system spec
- `t_c376db9b` — token/shell implementation
- `t_b8a7767a` — core surface implementation
- `t_eed020d9` — verification

Still gated until image generation succeeds or is intentionally deferred:
- `t_c0851f2e` — generated asset pack
- `t_df6e3616` — expanded external source pack, if needed again
