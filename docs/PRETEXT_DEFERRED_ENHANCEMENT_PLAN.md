# Pretext Deferred Enhancement Plan

_Captured 2026-04-03. Status: DEFERRED — not for immediate implementation._

---

## Current Decision

**Do not integrate Pretext at this time.**

The confirmed layout regression is resolved without Pretext. Pretext is a
virtualization / text-measurement library — it solves a class of problems that
Signal Loom does not currently have. Integrating it now would be speculative
work that risks destabilizing a stable fix.

This document defines where Pretext would genuinely help, where it would not,
and the concrete thresholds that should trigger reconsideration.

---

## What Pretext IS

Pretext is a library for:

- **Virtualizing long lists** — only rendering visible items (or a window around them),
  drastically reducing DOM node count for lists with hundreds or thousands of items.
- **Exact text measurement** — computing the exact pixel height of text content
  before it is rendered, enabling dynamic height allocation without DOM reflow.
- **Height-estimate-free layout** — avoiding the common pattern of giving
  list items estimated heights and then correcting after render.

**Pretext is not a layout fix tool. It is not a styling tool. It does not
replace CSS flexbox or ScrollArea.**

---

## What Pretext Would Help With (later)

### 1. ThreadDock session list virtualization

**Problem it solves:**
At very high session counts (50+ sessions, possibly 100+), the DOM contains one
`ThreadListItem` per session regardless of whether it is visible. This causes:
- Slow scroll on the thread dock
- High memory usage from off-screen DOM nodes
- Possible interaction lag when switching sessions

**Why defer:**
Signal Loom currently has 3–5 active sessions for most users. The DOM node count
from 5 thread list items is negligible. There is no measurable performance problem today.

**Trigger for adoption:**
- Session list visible scroll jank on 20+ sessions
- ThreadDock render time > 100ms in Chrome DevTools
- Memory usage on thread dock tab > 200MB with real session count

---

### 2. MessageList virtualization

**Problem it solves:**
In a chat thread with hundreds of messages (long-running agent sessions), every
message is kept in the DOM. This causes:
- Slow scroll in long threads
- Large DOM node count per pane
- Potential jank when jumping to recent messages

**Why defer:**
Most agent sessions in Signal Loom are in-progress and have relatively few messages.
Long archive threads are not yet a primary use case.

**Trigger for adoption:**
- MessageList scroll FPS < 30 on 200+ message threads
- Message pane render time > 200ms in Chrome DevTools
- Proven jank during thread switching (not layout related)

---

### 3. Exact text overflow handling for long session names

**Problem it solves:**
`ThreadListItem` currently truncates session names with CSS (`truncate`, `text-overflow`).
This works visually but doesn't account for the actual text metrics. If a session name
is very long and the CSS truncation is approximate, the layout can shift.

Pretext would allow exact pixel-accurate truncation before rendering.

**Why defer:**
CSS `text-overflow: ellipsis` handles the current use cases adequately. The risk of
layout shift from long names is low with current CSS approaches.

**Trigger for adoption:**
- Session name truncation causing visible ThreadDock layout shifts
- Proven mismatch between CSS truncation and actual visual overflow
- ThreadListItem reflow causing pane resize events

---

### 4. Chat timeline virtualization

**Problem it solves:**
The delegation timeline (shown per message in ThreadPane) would benefit from
Pretext's exact measurement if it contains many delegation events or long chains.
This is the most speculative future use case.

**Why defer:**
The delegation timeline is not yet rendering long delegation chains in production.
No problem exists to solve.

**Trigger for adoption:**
- DelegationTimeline render jank with 20+ delegation events visible
- Timeline overflow causing MessageList layout instability

---

## What Pretext Should NOT Be Used For

Pretext is **NOT** appropriate for:

- Shell layout or pane containment → CSS flexbox handles this correctly
- Session selection UI → single-select dropdowns or lists don't need virtualization
- Fallback or error state rendering → these are single components, not lists
- General UI architecture decisions → it solves a specific performance problem
- Replacing ScrollArea → Pretext provides virtualization; ScrollArea provides
  cross-platform accessible scrolling with scrollbar styling
- Fixing the confirmed flexbox height chain → `min-h-0` and `height: 100dvh`
  are the correct tools for that problem

---

## Trigger Criteria for Adoption

Re-evaluate Pretext integration when **all three** of the following are true:

1. **Measurable performance problem** — Proved in Chrome DevTools, not inferred.
   Must show: FPS drop, long task (> 50ms), or high DOM node count.

2. **Identified bottleneck** — The slow path is specifically a long list render
   or text measurement, not layout, not network, not state management.

3. **Signal Loom is stable** — No open regressions, no pending major features
   that would themselves change the list rendering patterns.

---

## First Safe Experiment

The recommended first Pretext trial, when triggers are met:

**ThreadDock session list virtualization**

Rationale:
- Self-contained — does not affect center pane, message list, or rail
- Easy to measure — session count is the input, scroll FPS is the output
- Low risk — Pretext virtualization is behind the scenes; if it breaks,
  the fallback is normal CSS scroll (ScrollArea still handles the scroll UX)
- Clear success metric — scroll FPS stays above 60 as session count grows

**Second choice (if needed):**
MessageList virtualization — same pattern, slightly higher risk (messages have
more complex layout — delegation timelines, email gates, metadata).

---

## Integration Notes (for when the time comes)

If Pretext is adopted, follow this integration sequence:

1. **Add Pretext as a dependency** — `preact` + `@pretext/preact` or the standalone
   build depending on Signal Loom's current framework (Next.js / React 19)

2. **Isolate one component** — Start only with ThreadDock's `ThreadListItem` list.
   Do NOT refactor the whole app.

3. **Keep ScrollArea** — Pretext virtualization does not replace ScrollArea's
   accessible scroll UX. ScrollArea should remain the scroll container;
   Pretext should virtualize the **items inside** it.

4. **Measure before and after** — Chrome DevTools Performance tab, session count
   as variable. Document the before/after delta.

5. **Graceful degradation** — If Pretext fails to load (CDN issue, etc.),
   fall back to the full non-virtualized list. Do not hard-fail.

---

## What This Document Is NOT

- This is NOT a request to implement Pretext now
- This is NOT a design document for Pretext integration
- This is NOT a performance rewrite prescription
- This is NOT related to the confirmed layout regression

---

## Status

| Item | Status |
|---|---|
| Layout regression fix | ✅ RESOLVED |
| Layout discipline documented | ✅ Done |
| Pretext integration | ⏸️ DEFERRED |
| Pretext plan | ✅ This document |

Re-evaluate: when session count reaches 20+, or when DevTools profiling shows
a list-rendering bottleneck.
