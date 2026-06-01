# Signal Loom visual system spec — Flat Broadcast

Status: Studio spec for implementation
Owner lane: Ariadne / Studio
Applies to: `app/globals.css`, shell chrome, rails, chat transcript, cards, controls, settings/command/approval panels, mobile drawers

---

## 1. Direction

Flat Broadcast is the next Signal Loom visual language: a flatter command-room broadcast console with sharp information hierarchy, calmer surfaces, thin signal rulings, and restrained live-state energy.

Signal Loom should still feel like Signal Loom:

- local Hermes/Nero cockpit, not generic SaaS
- dark operator room as the default
- teal signal energy for live/connected state
- brass for decisions, review, and human gates
- ember/red for Nero/action/danger
- council lanes remain visually distinct
- dense information is allowed, but the reading surface must stay calm

What changes:

- less glass, glow, shadow, and stacked-card depth
- fewer competing rounded boxes inside boxes
- more planar regions separated by 1px rulings, tint fields, and spacing
- type hierarchy carries more of the hierarchy than decoration
- motion only confirms state changes or live streaming; it does not decorate idle UI

Design thesis: "broadcast console, not spaceship casino."

---

## 2. Current evidence from repository and screenshots

Observed assets:

- Desktop screenshot: `docs/screenshots/signal-loom-desktop.png`
- Mobile lanes screenshot: `docs/screenshots/signal-loom-mobile-lanes.png`
- Existing token layer: `app/globals.css`
- Existing theme registry: `lib/theme.ts`
- Existing layout constraints: `docs/LAYOUT_DISCIPLINE.md`

Current strengths to preserve:

- Identity is already distinct: carbon field, teal signal, brass decision cues, council-lane colors.
- Theme infrastructure is strong: semantic `--sl-*` aliases exist and theme switching is persisted.
- The three-region cockpit layout works: Loom rail, Nero workspace, Live Lanes rail.
- Mobile drawer model is understandable and keeps rails available without forcing a cramped three-column view.
- Focus-visible styling and reduced-motion media query already exist.

Current issues this spec addresses:

| Issue | Evidence | Severity | Why it matters | Better direction | Verify |
|---|---|---:|---|---|---|
| Too much depth vocabulary | Message cards, agent cards, grouped sessions, empty states, active states use gradients, glow, inset highlights, shadows, rounded containers. | Significant | The eye has to parse ornament before content; long work sessions feel heavier. | Use planar surfaces with one border, one active edge, and minimal shadow only for overlays. | Screenshot diff: idle desktop should have fewer visible glow/shadow zones; active state remains obvious. |
| Box-within-box density | Desktop has many nested pills/cards/rules in the top utility area, transcript, receipts, and rails. | Significant | Dense UI is acceptable, but nested rounded containers make hierarchy ambiguous. | Reserve rounded cards for true records; use flat rows/rules for grouped metadata and controls. | At 1440×900, user can identify primary conversation, rails, and composer in under 5 seconds. |
| Type scale is too uniformly small | Many labels use 10–12px uppercase/mono with wide tracking. | Significant | Scanning suffers; low-vision users and tired operators lose anchors. | Establish a stricter type ladder with fewer micro labels and larger section titles/body. | At 125% zoom and 390px width, no critical label becomes unreadable/truncated without a fallback title/aria-label. |
| Motion energy can become decorative | `signal-pulse`, logo breathing, streaming scan, edge-current, word reveal, badge breathe, card entrance all exist. | Moderate | Multiple idle animations pull attention away from writing/reading. | Motion budget: one live indicator per region; no continuous animation for idle states. | `prefers-reduced-motion: reduce` removes all non-essential motion; idle screen has no more than 3 moving elements. |
| Theme tokens exist but hardcoded rgba remains common | Components use many inline `rgba(255,255,255,...)`, shadows, and per-component gradients. | Moderate | Themes drift; Papyrus/Sentry require custom fixes. | Route component styles through semantic surface/border/text/state tokens. | Switching all five themes keeps equivalent hierarchy and AA contrast. |
| Mobile lanes are readable but touch-dense | Mobile cards are compact, with status and metadata in 10px text. | Moderate | Touch and scan quality can degrade on real phones. | Minimum interactive target 44px; lane cards use clearer title/status/body/footer zones. | 390×844 manual QA: all controls easy to tap, no horizontal overflow, visible focus. |

---

## 3. System principles

1. Flat first, depth only for overlays.
   - Main shell, rails, cards, messages, and controls are planar.
   - Shadows are reserved for floating drawers, modals, popovers, command/settings/approval panels, and drag affordances.

2. Borders are structure, not decoration.
   - Prefer one 1px border/rule per boundary.
   - Do not stack border + glow + shadow + gradient for the same hierarchy job.

3. Content leads, atmosphere supports.
   - Keep the Signal Loom palette and broadcast texture, but no surface should compete with active text, composer, or approval states.

4. Status must be redundant.
   - Never communicate active/waiting/blocked/done by color alone.
   - Pair color with label, icon/dot, tone, and where needed a left rule or badge text.

5. One live thing per region.
   - Left rail, center transcript, right rail, and runtime strip may each have at most one live animated affordance in default motion mode.

6. Theme parity is mandatory.
   - Midnight, Ember, Oracle, Dawn, and Sentry must all express the same hierarchy using semantic tokens, not per-theme hacks.

7. The app is a cockpit, not a marketing page.
   - Density is acceptable.
   - Ambiguity is not.
   - Decorative copy and theatrical animation lose to task clarity.

---

## 4. Surface model

Define five surface roles and keep them consistent app-wide.

| Role | Token | Use | Flat Broadcast rule |
|---|---|---|---|
| Base | `--sl-bg` | viewport, deepest stage | no border, no shadow; may use subtle shell gradient only once globally |
| Shell | `--sl-shell` | top bar, side rails, runtime strip | planar, separated by `--sl-border-soft` rules |
| Panel | `--sl-panel` | lane cards, thread rows, message cards, settings sections | one border, no ambient shadow |
| Raised panel | `--sl-panel-raised` | selected row/card, active transcript region, high-priority cards | border stronger or active edge; shadow only if floating |
| Overlay | new recommended `--sl-overlay` | command center, settings panel, approvals panel, mobile drawers, tooltips/popovers | may use shadow/backdrop blur; must sit visibly above shell |

Implementation guidance:

```css
:root {
  --sl-overlay: color-mix(in srgb, var(--sl-panel-raised) 94%, black 6%);
  --sl-rule-hairline: color-mix(in srgb, var(--sl-text) 7%, transparent);
  --sl-rule-visible: color-mix(in srgb, var(--sl-text) 13%, transparent);
  --sl-active-edge: color-mix(in srgb, var(--sl-accent) 66%, transparent);
  --sl-decision-edge: color-mix(in srgb, var(--sl-decision) 66%, transparent);
  --sl-danger-edge: color-mix(in srgb, var(--sl-danger) 70%, transparent);
}
```

Surface rules:

- Standard card: `background: var(--sl-panel); border: 1px solid var(--sl-rule-hairline); box-shadow: none;`
- Selected card: same surface plus `border-color: var(--sl-rule-visible)` and a 2–3px active edge.
- Active/live card: active edge + status label; no full-card glow unless it is the currently streaming transcript item.
- Floating overlay: `background: var(--sl-overlay); box-shadow: var(--sl-shadow-panel);`
- Avoid `backdrop-filter` on ordinary cards; reserve blur for overlays only.

---

## 5. Borders, radii, and separators

Use a smaller, consistent radius scale:

| Token | Value | Use |
|---|---:|---|
| `--mb-radius-sm` | 6px | tags, count chips, focus rounding |
| `--mb-radius-md` | 8px | buttons, inputs, tabs |
| `--mb-radius-lg` | 12px | records/cards in rails and transcript |
| `--mb-radius-xl` | 16px max | overlays/drawers only |

Rules:

- Default card radius: 12px (`rounded-lg` / `var(--mb-radius-lg)`), not 16–20px.
- Composer radius may stay larger, but should read as input furniture, not a glass capsule.
- Use horizontal rules for metadata separation instead of nested mini cards.
- Borders should use semantic rule tokens, not hardcoded `rgba(255,255,255,...)`.
- Selected/active left edge is preferred over full-card colored border.
- Avoid double borders: if a parent region has a border, children should use internal rules or spacing unless they are true records.

---

## 6. Typography scale

Signal Loom needs a stricter type ladder. Keep the operator/council voice, but reduce overuse of tiny uppercase mono.

Recommended scale:

| Role | Size | Line-height | Weight | Tracking | Use |
|---|---:|---:|---:|---:|---|
| App title | 16px | 20px | 700 | 0 | `Signal Loom`, key brand anchors |
| Pane title | 14px | 18px | 700 | 0.08em max if uppercase | `Loom`, `Live Lanes`, active thread title |
| Section label | 11px | 14px | 700 | 0.16em | sparse uppercase labels only |
| Body | 13px | 19px | 400–500 | 0 | messages, previews, settings copy |
| Dense body | 12px | 17px | 400–500 | 0 | metadata rows, secondary rail text |
| Metadata | 11px | 15px | 500 | 0–0.04em | timestamps, counts, state labels |
| Micro | 10px | 13px | 600 | 0.08em max | only badges/chips where context is nearby |
| Code/IDs | 12px | 17px | 500 | 0 | session IDs, commands, receipts |

Rules:

- Do not use 10px uppercase for core navigation labels or lane names on mobile.
- Body text must default to at least 13px in the center conversation area.
- Rail previews can be 12px, but titles/status labels must be 12–13px minimum.
- Use mono for operational data, not every small label.
- Uppercase tracking should be functional and sparse; avoid combining 10px + mono + 0.18em tracking for important content.
- Keep line height at least 1.45 for paragraph/message text; 1.5 is preferred for readable transcript content.

---

## 7. Spacing system

Use a compact 4px grid with named rhythm.

| Token | Value | Use |
|---|---:|---|
| `--space-1` | 4px | icon/text gap, chip internals |
| `--space-2` | 8px | tight row gap, card sub-elements |
| `--space-3` | 12px | card padding compact, rail row gap |
| `--space-4` | 16px | default card padding, pane gutters |
| `--space-5` | 20px | transcript vertical rhythm |
| `--space-6` | 24px | major section/panel separation |

App-wide rhythm:

- Top bar height: keep compact, but preserve 44px minimum for controls.
- Rail card padding: 12px desktop, 14–16px mobile if interactive.
- Transcript message vertical gap: 12–16px; avoid large decorative gaps between operational blocks.
- Pane gutters: 16px desktop, 12px mobile.
- Runtime strip: dense, single-line, no card-within-strip decoration unless alerting.

---

## 8. Component language

### 8.1 Top bar

Purpose: app identity, runtime trust, high-level actions.

Flat Broadcast treatment:

- Shell surface with bottom rule only.
- Runtime pills should be compact text+dot controls, not raised capsules with strong outlines.
- `Review/Approvals` can keep brass treatment because it is human-gated work.
- Command/Settings buttons should be same neutral control style; active/open state uses border-visible + fill, not glow.

### 8.2 Layout utility bar / view mode strip

Purpose: temporary layout/theme controls.

Treatment:

- Use a flat control shelf: a subtle tinted band with top/bottom rules.
- Avoid stacking multiple pill rows with strong borders.
- Theme swatches may remain during design, but long-term should demote to Settings or compact menu.
- View mode should use segmented-control semantics with visible selected state and keyboard focus.

### 8.3 Loom rail and thread rows

Purpose: quick session selection and grouping.

Treatment:

- Rail itself is a flat shell column.
- Thread rows are rows first, cards only when selected/grouped.
- Selected thread: `--sl-panel-raised` + 2px teal/brass edge + clear active badge.
- Hidden/tucked controls should be discoverable but quiet; avoid small unlabeled controls that only expose meaning on hover.
- Counts use metadata chips with 10–11px text, but not as primary labels.

### 8.4 Nero workspace / transcript

Purpose: primary reading/writing area.

Treatment:

- Center stage should be the calmest surface.
- Message cards become flatter records: one surface, one border, minimal role edge.
- Nero/assistant: left ember/brass edge or small role chip; avoid full red/orange glow.
- User: right teal edge or subtle alignment, not a separate heavy bubble style.
- Tool/system receipts: dashed or low-contrast rule, folded by default; avoid making receipts visually louder than answers.
- Continuous chat/receipts panels should read as operational metadata bands, not promotional cards.

### 8.5 Composer

Purpose: highest-frequency input.

Treatment:

- Stronger affordance than passive cards: border-visible, background `--sl-panel-raised`, clear send button.
- Focus state: 2px focus ring outside or outline offset; do not rely on color-only border shift.
- Send-ready motion can be a one-shot micro interaction; no looping button glow.
- Placeholder/help text should meet contrast and not be smaller than 12px.

### 8.6 Live lanes / agent cards

Purpose: scan specialist availability and task state.

Treatment:

- Lane cards keep identity color, but use left active edge + icon chip instead of full-card gradient/glow.
- Idle cards should be visibly quieter than active/waiting cards.
- Status text is always present: `Idle`, `Active`, `Waiting`, `Blocked`, `Done`.
- The lane role (`FORGE LANE`, `STUDIO LANE`) can use metadata styling, but not below 11px on mobile.
- Footer metadata should use one top rule; keep text aligned to avoid ragged scan.

### 8.7 Command, Settings, Approvals panels

Purpose: overlays and human-gated decisions.

Treatment:

- These are the main places where shadow/depth is allowed.
- Use overlay surface, visible heading, close affordance, and trapped/managed focus if modal-like.
- Approvals get brass decision treatment; destructive/danger decisions use danger edge plus explicit text.
- Empty states must be honest: no fake/mock urgency unless labeled demo data.

---

## 9. Image and icon roles

Signal Loom is an app shell; imagery should be functional, rare, and identity-preserving.

Allowed roles:

1. App mark / signal glyph
   - Small, persistent identity anchor.
   - May animate once on load or breathe only when live state changes.

2. Agent/lane icons
   - Initial or simple glyph in lane accent color.
   - Must have accessible text nearby; decorative glyph itself can be `aria-hidden`.

3. State icons
   - Connected, waiting, warning, blocked, success.
   - Always paired with labels; do not use color alone.

4. Empty-state illustration
   - Optional, flat line/diagram style only.
   - Must not dominate primary workspace.

5. Screenshots/media attachments inside chat
   - Use a clear media frame with caption/alt handling.
   - Do not inherit decorative card gradients.

Not allowed by default:

- Decorative stock imagery.
- Hero-style illustrations in the app shell.
- Animated background images.
- Image textures that reduce text contrast.

---

## 10. Theme behavior

Existing themes remain:

- Midnight Broadcast: default dark command room.
- Operator Ember: warm dark triage mode.
- Oracle Teal: cool long-reading mode.
- Papyrus Dawn: light reading mode.
- Sentry Contrast: high-legibility/accessibility mode.

Theme rules:

- Components consume `--sl-*` semantic tokens first.
- Raw `--mb-*` tokens are palette primitives, not everyday component styling hooks.
- Every component must work in Papyrus Dawn and Sentry Contrast without custom per-component exceptions.
- Native `color-scheme` must follow selected theme.
- Theme switching must not create hydration mismatch or layout shift.
- Active theme controls must be keyboard-operable radio/segmented controls with visible selected state.

Contrast targets:

- Body text: WCAG AA 4.5:1 minimum against its surface.
- Large/display text: 3:1 minimum, but prefer 4.5:1 in this dense app.
- UI boundaries/focus: 3:1 minimum for non-text contrast.
- Sentry Contrast should exceed AA wherever practical and remove low-opacity text treatments.

Recommended semantic additions:

```css
:root {
  --sl-text-inverse: var(--sl-accent-contrast);
  --sl-surface-selected: color-mix(in srgb, var(--sl-panel-raised) 86%, var(--sl-accent) 7%);
  --sl-surface-warning: color-mix(in srgb, var(--sl-panel) 88%, var(--sl-warning) 8%);
  --sl-surface-danger: color-mix(in srgb, var(--sl-panel) 88%, var(--sl-danger) 8%);
  --sl-surface-success: color-mix(in srgb, var(--sl-panel) 88%, var(--sl-success) 8%);
}
```

---

## 11. Motion restraint

Current CSS already states: "Selective, meaningful motion only. No decoration. No noise." Flat Broadcast makes that enforceable.

Allowed motion:

- New message arrival: fade/translate <= 8px, <= 280ms.
- Expand/collapse: grid row or opacity transition <= 300ms.
- Streaming cursor: one cursor pulse in active message.
- Active live dot: one pulse per major region.
- Drawer/panel entry: transform + opacity <= 220ms.
- Send button press: one-shot press animation only after state changes.

Restricted motion:

- No continuous scan shimmer on full message cards except while actively streaming.
- No idle breathing on every agent card; only active/waiting states.
- No simultaneous logo breathe + badges breathe + lane pulse + streaming scan unless these are directly tied to different active system states.
- No transform hover lift on dense rail cards unless it materially clarifies clickability; prefer background/border changes.

Reduced motion:

- Existing `prefers-reduced-motion: reduce` rule should remain.
- In reduced motion, streaming still needs a non-motion indicator: label `Streaming`, active edge, or static dot.
- Avoid 0.01ms transitions that still trigger perceptual flash; where practical, use component-level no-animation classes for key surfaces.

Motion budget checklist:

- Idle shell: 0–2 moving elements total.
- Active streaming shell: 1 streaming cursor/scan + 1 runtime/live pulse allowed.
- Mobile drawer open: background content should not animate continuously behind overlay.

---

## 12. Accessibility constraints

WCAG AA is the floor.

Mandatory checks:

- Keyboard access for all controls, including theme swatches, view presets, collapse/tuck buttons, drawers, command/settings/approval panels.
- Visible focus indicator on every interactive element: at least 2px, 3:1 contrast, not hidden behind sticky bars.
- Minimum touch target: 44×44px for primary mobile controls; 32×32px allowed only for secondary dense desktop controls with nearby labels.
- Text contrast: 4.5:1 for normal text; 3:1 for UI component boundaries and large text.
- Color is never the only state indicator.
- Unique page title and landmarks remain intact.
- Drawer/panel focus behavior: focus moves into overlay when opened and returns to trigger when closed if overlay acts modal.
- No horizontal overflow at 320px width.
- Text reflows at 200% browser zoom and with increased text spacing.
- Truncated text requires title, aria-label, or adjacent full context where it affects decisions.
- Error/blocked states include recovery guidance, not just red/badges.

Specific Signal Loom risks to guard:

- 10px low-contrast metadata in mobile rails.
- Unlabeled or cryptic controls such as `Tuck`, chevrons, icon-only command buttons.
- Focus obscured by top bar/runtime strip/drawers.
- Motion-heavy live indicators for vestibular-sensitive users.
- Hardcoded low-opacity white borders failing in Dawn/Sentry themes.

---

## 13. Responsive behavior

Desktop >= 1200px:

- Three-column cockpit may show both rails and center workspace.
- Rails use 292–300px defaults, resizable within existing clamps.
- Center transcript receives the calmest visual treatment and strongest type hierarchy.

Tablet / compact <= 900px:

- Rails become drawers or collapsed tabs.
- Only one rail drawer open at a time.
- Backdrop must be a button or modal overlay with accessible label and focus behavior.
- Theme/view utility controls should collapse into compact groups; do not force full labels if they cause overflow.

Mobile <= 480px:

- Main header preserves app identity and one high-priority action only.
- Drawer cards use 14–16px padding and 44px+ touch rows.
- Hide decorative metadata before hiding status/action labels.
- Composer remains reachable without fighting the runtime strip.
- No horizontal overflow; rail drawer width should not exceed viewport minus a clear close/backdrop area.

---

## 14. Implementation guardrails for Forge

Do:

- Add semantic tokens first, then refactor components to use them.
- Replace hardcoded `rgba(255,255,255,...)` borders with semantic rule tokens.
- Flatten ordinary cards by removing ambient shadows/backdrop blur/compound gradients.
- Preserve one active edge or selected indicator per active record.
- Use CSS variables for agent accent edge/fill/label combinations.
- Keep `docs/LAYOUT_DISCIPLINE.md` rules intact; visual changes must not alter the height/scroll ownership chain.
- Validate all five themes, not only Midnight.

Do not:

- Remove Signal Loom's teal/brass/ember identity.
- Replace dense cockpit with generic shadcn SaaS cards.
- Use purple/blue AI-gradient defaults.
- Add large decorative imagery to core shell.
- Add new continuous animations without an explicit state purpose.
- Hide focus outlines.
- Solve hierarchy by making everything glow.

Suggested implementation sequence:

1. Add/normalize Flat Broadcast semantic tokens in `app/globals.css`.
2. Refactor common card/message/lane/thread styles to consume semantic tokens.
3. Flatten transcript/message cards and lane cards first; they carry most of the visual weight.
4. Flatten top utility/theme/view strips next.
5. Audit typography classes and reduce 10px uppercase usage.
6. Review mobile drawers for touch target and text size.
7. Run accessibility and browser QA.

---

## 15. Acceptance checklist

A Flat Broadcast implementation is acceptable when:

- The app still reads as Signal Loom within 5 seconds: carbon/teal/brass/ember operator cockpit.
- Ordinary cards have one border and no ambient shadow/glass blur.
- Overlays are the only surfaces with meaningful elevation shadow.
- Active/selected records are clear without full-card glow.
- Typography has visible hierarchy: pane titles, body text, metadata, and micro labels are distinct.
- Core mobile text is not dependent on 10px uppercase labels.
- Theme switching works across all five themes without contrast regressions.
- `prefers-reduced-motion` produces a calm static interface with equivalent state information.
- Keyboard focus is visible for every interactive control.
- No color-only state indicators remain.
- `document.documentElement.scrollWidth - document.documentElement.clientWidth === 0` at 390×844 and 320px width.
- No console errors, duplicate IDs, unnamed visible interactive controls, or hydration mismatch.
- Existing shell height/scroll rules from `docs/LAYOUT_DISCIPLINE.md` remain satisfied.

Recommended verification commands after implementation:

```bash
npm run typecheck
npm run lint
npm run build
git diff --check
```

Recommended browser QA routes/state:

- Desktop 1440×900, Midnight Broadcast and Sentry Contrast.
- Desktop 1280×720, both rails open and collapsed.
- Mobile 390×844, each rail drawer open, backdrop close tested.
- Papyrus Dawn with active conversation and Live Lanes visible.
- Reduced motion enabled in OS/browser emulation.

---

## 16. One-screen visual target

If the team needs a single sentence for design review:

Signal Loom Flat Broadcast should look like a professional live-operations desk: mostly flat carbon panels, crisp signal rulings, legible operator typography, restrained teal/brass/ember state cues, and motion that only appears when the system is genuinely doing something.
