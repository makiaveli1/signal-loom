# Signal Loom Boxed Console V2 Plan

> **Status:** Historical implementation plan. The original guardrail was “do not push without explicit approval”; Gbemi later explicitly requested repo cleanup and GitHub push on 2026-06-01.

**Goal:** Turn the current Flat Broadcast baseline into a sharper, more distinctive Signal Loom interface: boxier geometry, signature signal-routing motion, richer theme capabilities, and a theme picker that feels like a real cockpit view selector.

**Architecture:** Keep the existing Next.js App Router, Zustand store, `data-signal-theme` bootstrap, and Hermes runtime contracts. Extend the visual system through semantic CSS tokens first, then have shell/chat/rail/approval components consume those tokens. Theme identity must become more than palette: density, radius, material, motion, texture, and preview metadata become first-class.

**Tech Stack:** Next.js 16, React/TypeScript, Tailwind v4, CSS variables, CSS keyframes/transitions, existing `motion/react` where already used. Avoid new animation dependencies unless a later slice proves CSS/native motion is not enough.

---

## Current Baseline

The first redesign pass is useful but not final. It established flat surfaces, local Hermes identity, generated decorative assets, and normal/degraded runtime verification. The user has now rejected the current level of polish as not distinctive enough.

The specific critique is accepted:

- “Flat” should also mean less rounded and more boxy.
- Animations should be cooler, more unique, and tied to Signal Loom’s own concept.
- Generated assets are allowed if they serve the design.
- The theme engine should change more than colors.
- The theme picker needs more polish so themes are easier to see and select.

## Design Direction: Boxed Signal Console

Signal Loom should feel like a local operator switchboard: flat, ruled, precise, slightly industrial, with signal-thread motion running through hard-edged panels.

Core visual principles:

1. **Boxy by default**
   - Controls use small radii, not pills.
   - Cards and panels use crisp rectangles with subtle clipped/corner details.
   - Roundness is reserved for true indicators: dots, avatars, small status lamps.

2. **Motion carries meaning**
   - Movement should suggest routing, packet arrival, panel calibration, and live signal flow.
   - Avoid generic bounce, pulse-only feedback, or decorative shimmer spam.
   - Reduced motion must render the final static state immediately.

3. **Themes are operating modes**
   - A theme is not only a color palette.
   - Each theme controls geometry, density, material, motion level, and texture intent.
   - Accessibility/high-contrast behavior stays first-class.

4. **Images are contextual, not wallpaper**
   - Generated assets may support theme plates, empty states, sigils, or subtle texture fields.
   - Active transcript text must remain DOM text on verified readable surfaces.
   - No generated image should be required to understand runtime state.

## V2 Theme Contract

Extend `lib/theme.ts` so each theme can expose:

- `radius`: `sharp | standard | soft`
- `density`: `compact | balanced | spacious`
- `material`: `matte | paper | obsidian | high-contrast`
- `motion`: `signal | calm | minimal | none`
- `texture`: stable key for CSS/asset treatment
- `preview`: richer than three dots: canvas, surface, accent, decision, danger

CSS should consume these via document data attributes and semantic tokens:

- `data-signal-radius`
- `data-signal-density`
- `data-signal-material`
- `data-signal-motion`
- `data-signal-texture`

Recommended token additions:

- `--sl-radius-control`
- `--sl-radius-card`
- `--sl-radius-panel`
- `--sl-radius-indicator`
- `--sl-density-x`
- `--sl-density-y`
- `--sl-border-weight`
- `--sl-corner-cut`
- `--sl-motion-scale`
- `--sl-texture-opacity`
- `--sl-panel-treatment`

## Signature Motion Vocabulary

Implement motion as reusable CSS classes/tokens first:

1. **Signal route draw**
   - Thin line draws across active panels or selected cards.
   - Use transform/opacity or SVG stroke dash where available.
   - Good for selected themes, rail toggles, active message arrival.

2. **Packet arrival**
   - Incoming message card gets a quick edge trace before settling.
   - No bounce. The border/rule carries the motion.

3. **Cut-line reveal**
   - Drawers/menus open with a hard-edged mask/clip or transform reveal.
   - Use carefully; avoid layout animation traps.

4. **Theme calibration wipe**
   - Theme board cards show a small scan/calibration motion on hover/focus/selected.
   - App theme switching should feel intentional but never flash the whole page.

5. **Idle signal field**
   - Existing generated atmosphere can remain peripheral.
   - New generated textures may be added later for theme previews, but not before the theme engine can use them.

## Geometry Scope

Target files:

- `app/globals.css`
- `components/shell/mission-shell.tsx`
- `components/shell/top-bar.tsx`
- `components/shell/runtime-strip.tsx`
- `components/chat/message-card.tsx`
- `components/chat/message-list.tsx`
- `components/chat/thread-pane.tsx`
- `components/chat/composer.tsx`
- `components/threads/thread-dock.tsx`
- `components/threads/thread-header.tsx`
- `components/agents/live-agent-rail.tsx`
- `components/approvals/approval-card.tsx`
- `components/approvals/approvals-panel.tsx`
- `components/chat/pane-preset-switcher.tsx`

Rules:

- Replace most `rounded-full` UI pills with tokenized boxed controls.
- Keep status dots/circular signal marks round.
- Use `rounded-[var(--sl-radius-control)]`, `rounded-[var(--sl-radius-card)]`, and `rounded-[var(--sl-radius-panel)]` instead of ad hoc radii.
- Prefer borders, side rules, corner marks, and inset dividers over glow.

## Theme Board UX

Replace the current tiny swatch strip with a richer theme board inside the View menu.

Each theme card should include:

- mini cockpit preview made from real CSS blocks;
- theme label and short label;
- tone, density, motion badges;
- short intent text;
- selected-state hard border and corner mark;
- hover/focus calibration line.

Desktop behavior:

- grid of rectangular theme cards;
- keyboard radio behavior preserved;
- footer explains selected theme intent and includes reset layout.

Mobile behavior:

- horizontally scrollable or stacked rectangular cards;
- avoid relying only on a native select;
- keep accessible labels and roving keyboard semantics where practical.

## Implementation Slices

### Slice A — Design ledger and token hardening

- Add this plan.
- Patch old flat-broadcast plan to mark the first pass as baseline, not final.
- Add theme attribute application in `lib/theme.ts`.
- Add geometry/density/motion/material tokens in `app/globals.css`.

### Slice B — Theme board

- Extend `SignalTheme` metadata.
- Replace swatch pills with theme cards in `LayoutUtilityBar`.
- Preserve keyboard navigation and persistence.
- Verify reload persistence.

### Slice C — Boxy surface pass

- Convert shell controls, message cards, composer, approvals, rails, and layout menus to the new radius tokens.
- Remove rounded-pill energy where it weakens the flat console style.
- Keep touch targets large enough on mobile.

### Slice D — Signature motion pass

- Add reusable motion classes for route draw, packet arrival, cut-line reveal, and calibration wipe.
- Wire them into active message cards, theme cards, menus/drawers, and rail toggles.
- Respect `prefers-reduced-motion` and theme motion profile.

### Slice E — Asset expansion only if needed

- If the theme board needs stronger previews, generate small theme preview/texture plates.
- Keep payload budget small.
- Document prompts and asset use in `docs/generated-image-inventory.md`.

## Verification Gates

After source changes:

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- `git diff --check`

Browser QA:

- desktop 1440x900 normal motion;
- mobile 390x844 normal motion;
- compact 820x900;
- reduced-motion viewport;
- theme switching for all themes;
- theme persistence after reload;
- console/page errors;
- horizontal overflow delta 0;
- duplicate IDs;
- unnamed visible controls;
- mobile rail open/close/open;
- approvals/theme/settings opening behavior.

Runtime QA:

- Normal `3098` health remains healthy if Hermes runtime is available.
- If runtime/degraded API code changes again, repeat temp-copy degraded smoke using the proven hardlinked `node_modules` workaround.

## Non-goals for this slice

- No push.
- No external publishing.
- No broad runtime/API redesign unless directly broken by UI work.
- No animation dependency unless CSS/native proves insufficient.
- No generated text/logos/people in imagery.
