# Pretext Deferred Enhancement Plan

**Status:** Deferred — not needed until list/tab density becomes a measurable problem.

---

## What is Pretext?

Pretext is an internal text templating/abbreviation layer used to compress long labels
(e.g., session titles, agent names, delegation descriptions) into shorter, pre-computed
display forms without losing semantic meaning.

---

## Where Pretext Would Help

### 1. Internal work-tab virtualization
When many child sessions are open simultaneously, the thread dock and pane title bars
need to render many labels. Pretext would pre-compute abbreviated labels server-side
or at store-derivation time, reducing per-render string manipulation.

**Trigger:** More than ~5 concurrent child sessions visible in the UI.

### 2. Long child-session label truncation
Session titles (especially subagent session keys) can be very long and are currently
truncated inline with `truncate` CSS. Pretext would provide semantic truncation
(e.g., `forge:subagent:abc123...` → `Forge / sub #1`).

**Trigger:** Any subagent session with a raw session key as its title.

### 3. Dock density scaling
The thread dock currently shows full session titles. With many concurrent sessions,
density increases. Pretext would allow a compact dock mode where labels are
pre-abbreviated to a fixed character budget per row.

**Trigger:** More than ~8 threads in the dock simultaneously.

---

## How to Re-enable Pretext

1. Add a `pretext(label: string, maxLen: number): string` utility to `lib/utils.ts`
2. Replace inline `truncate` CSS with `pretext(title, 24)` in `thread-list-item.tsx`
   and `pretext(title, 20)` in the pane title bar
3. Add a `LabelPretextProvider` context in the store that pre-computes abbreviated
   forms for all known session keys on session load

---

## Decision Criteria

Re-enable pretext when:
- [ ] Thread dock renders > 8 concurrent items
- [ ] Pane title bars frequently show truncated session keys > 50% of max width
- [ ] Profiling shows label string operations as a measurable render bottleneck

Until then, CSS `text-overflow: ellipsis` and `truncate` classes are sufficient.
