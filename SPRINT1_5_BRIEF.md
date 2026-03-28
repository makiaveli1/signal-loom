# Signal Loom — Sprint 1.5 Critique-and-Fix Brief
## For Hephaestus — Build Session

---

## Context

Sprint 1 built the foundation. Sprint 1.5 is a clarity + delight pass.
The goal: turn "promising prototype" into "something you'd actually want to operate from."

**Read this first:** `/home/likwid/.openclaw/workspace/signal-loom/SPRINT1_BRIEF.md` (Sprint 1 scope for reference)
**Visual direction:** `/home/likwid/.openclaw/workspace/signal-loom/VISUAL_DIRECTION_PACK.md` (Midnight Broadcast — unchanged)

**Project root:** `/home/likwid/.openclaw/workspace/signal-loom/`

---

## Current Codebase Assessment

I've already read the key files. Here's what I found:

### Hydration bug confirmed
`lib/mock/data.ts` — mock threads use `new Date(Date.now() - N * 60 * 1000)` for `lastActive`. These are computed at module load time, meaning the server renders one set of relative timestamps and the client hydrates with different ones (time has moved). `timeAgo()` in `thread-list-item.tsx` also calls `Date.now()` directly, compounding the mismatch. **Fix: suppress hydration on time elements or use a stable timestamp.**

### Status labels are coded
`thread-list-item.tsx`:
- `wait·nero` → **"waiting on Nero"**
- `wait·spec` → **"waiting on specialist"**
- `wait·you` → **"waiting on you"**
- `blocked` and `done` can stay, just style them clearly

### Runtime strip is cryptic
`runtime-strip.tsx` — abbreviations that need expanding:
- `GW` → `Gateway`
- `Q` → `Queue`
- `HB` → `Heartbeat`
- `2 / 4 lanes` → `2 browser lanes active` (clarify the dot display meaning)

### Agent cards need hierarchy cleanup
`agent-card.tsx` — the role split (`split('—')[0]` / `split('—')[1]`) works but secondary text competes with task preview. The task preview itself ("Awaiting Gorimi to review...") looks like real data but it's just mock — acceptable for Sprint 1 but flag this.

### Thread row metadata rhythm is flat
`thread-list-item.tsx` — title/meta are crammed into small space. Active thread gets a left accent bar but the row itself doesn't feel "tuned in."

---

## Workstreams (in priority order)

### Workstream A — Technical / Correctness (DO FIRST)
**Owner: Hephaestus — no review gate, just fix it**

1. **Hydration fix** — `thread-list-item.tsx` `timeAgo()`: use `suppressHydrationWarning` on the time element, OR defer time rendering to client-only with `useEffect`, OR suppress the hydration warning on those specific spans. The root cause is `Date.now()` in both mock data (module evaluation time) and the render function. Simplest fix: add `suppressHydrationWarning` to the `<time>` element and use `use client` + `useEffect` for dynamic time updates.

2. Check all other client/server inconsistencies — layout flicker, state initialization mismatch.

### Workstream B — Clarity (Status Language)
**Owner: Hephaestus — Ariadne reviews after**

`thread-list-item.tsx` STATUS_LABELS map — replace:
```ts
// FROM:
waiting_on_nero: 'wait·nero',
waiting_on_specialist: 'wait·spec',
waiting_on_user: 'wait·you',

// TO:
waiting_on_nero: 'waiting on Nero',
waiting_on_specialist: 'waiting on specialist',
waiting_on_user: 'waiting on you',
```

`runtime-strip.tsx` — replace abbreviations:
- `GW` → `Gateway`
- `Q` → `Queue`
- `HB` → `Heartbeat`
- Add a tooltip on browser lane dots: "Active browser lanes (max 4)"
- The dots themselves are fine — just label them better

### Workstream C — Scanability
**Owner: Ariadne reviews, Hephaestus implements**

**Thread rows (`thread-list-item.tsx`):**
- Stronger active selection — add a subtle background tint + left bar when selected, not just border
- Better status chip — make the status label a small chip with rounded corners, not raw text
- More space between title and meta row
- Title should be slightly larger when the thread is active/selected

**Agent cards (`agent-card.tsx`):**
- Line 1: name + status (this is already good — keep it)
- Line 2: task preview (2-line clamp, this is already good — keep it)
- Line 3: role subtitle — make this lighter/more muted so it doesn't compete
- Browser badge: keep it visible but compress it

**Runtime strip (`runtime-strip.tsx`):**
- Group items more clearly
- The issue description text truncates awkwardly — give it a max-width and proper truncation

**Center workspace (`nero-workspace.tsx`):**
- Check how it looks when message count is low/empty — sparse state should feel intentional, not broken
- Thread header with linked agent chips is already good — keep it

### Workstream D — Delight
**Owner: Ariadne reviews, Hephaestus implements**

Keep reading surfaces calm. Put life into:
- **Thread selection**: richer transition when clicking a thread — slight scale + background shift, not just border color
- **Agent active pulse**: the `signal-pulse` animation is already in globals.css — make sure active agents use it, not just the status dot
- **Approvals panel open/close**: Framer Motion slide-in is already there — tune the spring physics to feel more decisive (faster, tighter spring)
- **Composer**: make it feel like the heart of the interface — slightly more prominent styling, better send button
- **Hover states**: add subtle scale (1.01-1.02) on interactive cards, not just background color shift
- **Approval urgency**: high urgency cards should have a very subtle left border accent in red-orange

---

## Review Gates

- **Workstream A**: No gate — just fix it
- **After Workstream B**: Flag Ariadne for clarity review — short memo: clearer now? top 3 remaining problems?
- **After Workstream C**: Flag Ariadne for scanability review
- **After Workstream D**: Ariadne final sign-off — approve / approve with minor debt / reject

---

## Explicitly NOT Changing

- Tech stack (Next.js + TS + Tailwind + shadcn/ui + Framer Motion + Zustand)
- Layout structure (5-region shell)
- Agent roster or roles
- Color palette or typography system
- No backend, no real-time, no dual-thread, no branching

---

## Deliverables at End

1. Hydration bug fixed (screenshot or build output confirming no hydration mismatch)
2. Status language updated
3. Thread rows improved
4. Runtime strip decluttered
5. Agent cards cleaner
6. Delight improvements landed
7. Final Ariadne sign-off memo
8. Committed to repo

Send final report to Nero when done.
