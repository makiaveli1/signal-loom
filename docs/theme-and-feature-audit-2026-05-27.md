# Signal Loom theme + feature audit — 2026-05-27

## Research notes

Best theming systems converge on the same pattern:

- **Tailwind v4** treats design tokens as CSS theme variables via `@theme`; tokens are CSS-first and sharable.
- **Radix Themes** separates raw color scales from roles: accent, gray, surfaces, borders, solid colors, contrast text.
- **Material Design 3** uses color roles as the connective tissue between brand color and UI hierarchy/state.
- **Chakra UI / Panda CSS** push semantic tokens with conditions/themes instead of hard-coded component colors.
- **Open Props** proves that framework-agnostic CSS custom properties are the durable primitive for consistent UI systems.

Practical rule for Signal Loom: keep raw palette tokens for identity, but route component styling through semantic roles (`--sl-*`) so every theme controls background, text, accent, decision/warning, danger, success, borders, focus rings, shadows, and atmosphere together.

## Implemented theme-system improvements

- Centralized theme registry in `lib/theme.ts` with theme IDs, labels, short labels, tone, intent, description, and preview colors.
- Removed duplicated allowed-theme list from `app/layout.tsx`; the server reads the persisted theme cookie and stamps `data-signal-theme` on `<html>` to prevent drift and avoid Next dev script warnings.
- Added `Sentry Contrast`, a high-legibility/accessibility theme.
- Added semantic component-facing tokens in `app/globals.css`:
  - `--sl-bg`, `--sl-shell`, `--sl-panel`, `--sl-stage`
  - `--sl-text`, `--sl-text-muted`, `--sl-text-subtle`, `--sl-text-faint`
  - `--sl-accent`, `--sl-decision`, `--sl-danger`, `--sl-success`, `--sl-warning`
  - `--sl-border-soft`, `--sl-border-strong`, `--sl-focus-ring`, shadows, control fills, shell gradients
- Theme selector now shows the selected theme intent and supports radio-keyboard behavior: arrow keys, Home, End, Enter, Space.
- Browser `color-scheme` now follows the selected theme so native controls are not haunted.

## What the Review button is for

The top-bar **Review** button opens the `ApprovalsPanel`.

It aggregates human-gated work from three places:

1. **Delegation approvals** from the OpenClaw/Hermes approval adapter.
2. **Historical note:** earlier builds also showed email/CRM review queues; those have now been removed from the Hermes-focused product surface.

The button is conceptually useful: it is the safety inbox for things Nero/Hermes should not do silently.

But the current implementation is noisy because much of its data is mock/demo local state. That makes the badge feel like unexplained clutter when you are using Signal Loom as a general cockpit.

## Keep / improve / remove recommendations

### Keep, but rename/clarify

- **Review button**: keep it, but rename to **Approvals** or **Safety Queue**. “Review” is too vague; it reads like code review, notifications, or inbox review.
- Add a subtitle/count breakdown in the button or tooltip, e.g. `2 actions · 1 derived · 1 gateway`.
- Hide the badge when all pending items are mock/demo data, or label demo data explicitly.

### Improve next

1. **Theme editor-lite**
   - Not full customization yet. Add a small “theme inspector” in Settings showing active semantic tokens and contrast mode.
   - Useful for debugging why a component looks wrong in one theme.

2. **Command Center and Settings consolidation**
   - Command and Settings overlap as “meta controls.” Keep both for now, but Settings should become configuration; Command should be action shortcuts only.

3. **Approval source honesty**
   - Split real approvals from demo/mock approval data.
   - If no real approval source is connected, show an empty state that says so instead of pretending work is pending.

4. **Mode simplification**
   - Current workspace view modes (`Chair`, `Dual`, `Dual + watch`, `Ops`) are promising but likely overkill unless multi-pane work is genuinely daily.
   - Keep `Chair` and `Ops`; consider hiding advanced pane modes behind a `More views` menu.

5. **Rail wording**
   - `Loom` and `Lanes` are characterful but not instantly clear to a new user.
   - Add small captions/tooltips: `Loom = conversations`, `Lanes = specialist agents`.

### Candidate removals / demotions

- **Mock operational pressure in production-feeling UI**: keep synthetic review items out of the default live state or label them as demo data.
- **Always-visible theme switcher**: once themes are stable, demote to Settings or a compact menu. It is currently useful during design, but permanent cockpit chrome should prioritize work over decoration.
- **Duplicate mobile Command/Settings access**: top bar plus utility bar can feel redundant. On mobile, keep the utility bar access; on desktop, top bar is enough.
- **Decorative microcopy in dense chrome**: keep labels brutally functional. Signal Loom already has enough personality in the visual system.
