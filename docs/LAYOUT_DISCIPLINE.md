# Signal Loom — Layout Discipline

_Captured 2026-04-03. governs `signal-loom/` (the live dev workspace)._

---

## The Problem This Solves

The real-session-list layout regression occurred because the flexbox height chain was broken
at the shell level. Without explicit viewport anchoring and `min-h-0` propagation, the
MissionShell content would either:

- blow up past the viewport (blank slab below), OR
- collapse to zero when sessions were loading

The fix is a three-anchor rule enforced at three levels.

---

## Rule 1 — Viewport Anchor (root)

```css
/* globals.css */
html {
  height: 100%;
  overflow: hidden;
}
body {
  height: 100%;
  overflow: hidden;
}
```

`100dvh` is used on the MissionShell div as the primary anchor. The CSS root anchors
ensure that `100dvh` resolves correctly and that nothing in the tree can accidentally push
the page into a scrollable state at the viewport level.

**Do not** remove or override `overflow: hidden` on `html` or `body` in globals.css.

---

## Rule 2 — Shell Row Rule

The MissionShell renders a three-row flex column:

```tsx
<div style={{ height: '100dvh', overflow: 'hidden' }}> {/* root anchor */}
  <div className="flex-shrink-0">                  {/* TOPBAR — fixed height */}
    <TopBar />
  </div>
  <div className="flex flex-1 min-h-0" style={{ height: '100%' }}>  {/* MAIN ROW */}
    <ThreadDock />      {/* flex-col, h-full, min-h-0, overflow-hidden */}
    <NeroWorkspace />    {/* flex-1, min-h-0 */}
    <LiveAgentRail />    {/* flex-col, h-full, min-h-0, overflow-hidden */}
  </div>
  <div className="flex-shrink-0">                  {/* RUNTIME STRIP — fixed height */}
    <RuntimeStrip />
  </div>
</div>
```

**Three rules for this row:**
- The main row **must** have `height: 100%` inside the `100dvh` shell
- The main row **must** have `flex flex-1 min-h-0`
- Header and footer wrappers **must** have `flex-shrink-0` (never shrink)

**Do not** give the main row a fixed pixel height — it must flex.

---

## Rule 3 — `min-h-0` Propagation Rule (critical)

In a flex column, a child with `flex: 1` (or `flex-1`) will NOT shrink below its content
size unless it also has `min-h-0`. This is the single most violated flex rule.

Every flex-column container that should fill available space **must** have:

```tsx
className="flex flex-col min-h-0 flex-1 overflow-hidden"
```

This applies to:
- `MissionShell` main row → already has it
- `ThreadDock` → has `className="flex flex-col h-full border-r"` but the **inner scroll container** needs `min-h-0 flex-1 overflow-hidden`
- `LiveAgentRail` → has inner wrapper with `className="flex flex-col min-h-0 flex-1 overflow-hidden"`
- `NeroWorkspace` → has `className="flex flex-1 min-h-0"` (correct)
- Any pane wrappers inside `NeroWorkspace` → already have `min-h-0`

**Do not** omit `min-h-0` from any flex-column that should fill rather than overflow.

---

## Rule 4 — Internal Scroll Ownership Rule

Scroll responsibility is **explicitly assigned per region:**

| Region | Who scrolls |
|---|---|
| ThreadDock (session list) | `ScrollArea` inside — ThreadDock itself is `h-full` |
| LiveAgentRail (agent list) | `ScrollArea` inside — LiveAgentRail itself is `h-full` |
| ThreadPane (message list) | `ScrollArea` inside MessageList |
| NeroWorkspace center | No scroll — panes are fixed height inside the row |
| RuntimeStrip | No scroll |
| TopBar | No scroll |

A parent container with `h-full` does **not** scroll itself. Its **child** ScrollArea scrolls.
This keeps the height chain intact: `100dvh → 100% → 100% → ScrollArea fills parent`.

**Do not** put `overflow-y: auto` on a container that is already using `height: 100%` to fill its parent.

---

## Rule 5 — Long-List Containment Rule

ThreadDock and LiveAgentRail both use an inner wrapper:

```tsx
<div className="flex flex-col min-h-0 flex-1 overflow-hidden">
  <ScrollArea className="flex-1">
    {/* list content */}
  </ScrollArea>
</div>
```

The wrapper:
- Takes `flex-1` to fill available space (flex column, so needs `min-h-0`)
- Has `overflow-hidden` so it clips the ScrollArea rather than collapsing
- ScrollArea has `height: 100%` (set in its `style` prop) so it fills the wrapper

This pattern is **the correct pattern** for any list region in the shell.

---

## Rule 6 — ScrollArea Fill-Parent Rule

The `ScrollArea` component (`components/ui/scroll-area.tsx`) is implemented as:

```tsx
<ScrollAreaPrimitive.Root style={{ height: '100%', ...style }}>
  <ScrollAreaPrimitive.Viewport style={{ height: '100%' }}>
    {children}
  </ScrollAreaPrimitive.Viewport>
</ScrollAreaPrimitive.Root>
```

Both Root and Viewport explicitly receive `height: 100%`. This ensures that when a
ScrollArea is placed inside a flex column, it fills the available height rather than
collapsing to content height.

**Do not** pass `className="h-auto"` or remove the inline `style={{ height: '100%' }}` from
ScrollArea or its Viewport — that would break the height chain.

---

## Rule 7 — ThreadDock / LiveAgentRail `h-full` Rule

ThreadDock and LiveAgentRail are `aside` elements with `className="flex flex-col h-full border-r"`.

`h-full` makes them fill the height of the main row (which has `height: 100%`).

Their inner content (the thread list / agent list) is wrapped in a ScrollArea that
handles overflow internally. The aside itself **never** scrolls — it is a fixed-height
column that happens to be the full shell height.

---

## Anti-Patterns to Avoid

### ❌ `height: 100vh` on MissionShell + `overflow: hidden` on body
This causes scrollbar jitter on mobile. Use `height: 100dvh` instead.

### ❌ `flex-1` without `min-h-0` on a flex-column child
The child will expand to content height instead of filling available space.
Symptom: blank space below the shell, or thread dock list not contained.

### ❌ `overflow-y: auto` on a height-100% parent
The parent already fills the space — putting scroll on it creates a nested scroll
context that breaks the height chain. Use ScrollArea with `height: 100%` on the
child instead.

### ❌ Removing `flex-shrink-0` from TopBar or RuntimeStrip wrappers
These are fixed-size regions. Without `flex-shrink-0`, they can be compressed
when the main row grows, breaking the row heights.

### ❌ Adding `overflow: hidden` to the main row
The main row needs to pass full height to its children. `overflow: hidden`
on a flex parent can clip positioned children unexpectedly.

---

## Adding New Shell Regions

When adding a new panel or region to MissionShell:

1. If it should be full-height → give it `className="flex flex-col h-full"`
2. If it contains a scrollable list → wrap the list in a ScrollArea, not the container
3. If it is inside a flex column → add `min-h-0 flex-1 overflow-hidden`
4. If it is a fixed-size header/footer → wrap in `flex-shrink-0`

---

## Verified Presets

All four pane presets are verified under real session density (3 sessions):

| Preset | ThreadDock | Center Pane | Runtime Strip | Status |
|---|---|---|---|---|
| Focus | scrolls internally | stable | anchored | ✅ |
| Duo | scrolls internally | split-stable | anchored | ✅ |
| Duo+Monitor | scrolls internally | split+monitor stable | anchored | ✅ |
| Operator | scrolls internally | stable | anchored | ✅ |

Verified at: 1440×900, 1280×720, browser zoom 100%, 110%, 125%.
