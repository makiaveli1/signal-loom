# Signal Loom — Sprint 2.5 Build Brief
## For Hephaestus (Forge) — Build Session

---

## Context

Sprint 2.5 — "a flexible pane workspace I can actually operate from."

**Read these first:**
- `/home/likwid/.openclaw/workspace/signal-loom/SPRINT2_BRIEF.md`
- Existing codebase at `/home/likwid/.openclaw/workspace/signal-loom/`
- Key files to understand before starting:
  - `components/chat/nero-workspace.tsx` — current center workspace (renders ThreadPane ×1 or ×2)
  - `components/chat/thread-pane.tsx` — single thread workspace component
  - `components/agents/live-agent-rail.tsx` — current rail (no collapse)
  - `lib/store.ts` — current Zustand store
  - `lib/types/index.ts` — current type definitions

**Project root:** `/home/likwid/.openclaw/workspace/signal-loom/`

Tech stack: Next.js + TypeScript + Tailwind CSS + shadcn/ui + Framer Motion + Zustand

---

## Pane System Architecture

The current `SplitViewState` is flat (primaryThreadId + secondaryThreadId). Sprint 2.5 replaces it with a proper pane array model.

### New types (add to lib/types/index.ts)

```ts
type PaneRole = 'primary' | 'secondary' | 'monitor'

interface Pane {
  id: string          // 'pane-left' | 'pane-center' | 'pane-right'
  role: PaneRole
  threadId: string
  widthRatio: number  // 0.0–1.0, proportion of available center area width
  active: boolean
  collapsed: boolean  // for monitor panes, whether it's in collapsed view
}

type WorkspacePreset =
  | 'focus'       // 1 full pane
  | 'duo'         // 2 equal panes (50/50)
  | 'duo_monitor' // 2 panes + 1 compact monitor
  | 'operator'    // 1 full + 1 compact support

interface WorkspaceState {
  preset: WorkspacePreset
  panes: Pane[]
  activePaneId: string
  monitorCollapsed: boolean  // true = monitor pane is collapsed to a slim strip
}

interface ResizeState {
  dragging: boolean
  paneAId?: string
  paneBId?: string
  startX?: number
  startWidthA?: number
  startWidthB?: number
}
```

### Preset layouts

| Preset | Panes | Width ratios |
|---|---|---|
| `focus` | 1 primary | 1.0 |
| `duo` | 1 primary + 1 secondary | 0.5 / 0.5 |
| `duo_monitor` | 1 primary + 1 secondary + 1 monitor | 0.4 / 0.4 / 0.2 |
| `operator` | 1 primary + 1 monitor | 0.65 / 0.35 |

### Minimum widths
- Full pane (primary/secondary): 280px
- Monitor pane: 160px collapsed, 220px expanded

---

## Phase A — Pane Infrastructure Refactor

### 1. Replace SplitViewState in store

Replace `SplitViewState` with `WorkspaceState` in `lib/store.ts`. Migrate existing logic:
- `splitView.enabled = false` → `preset = 'focus'`, `panes = [primary]`
- `splitView.enabled = true` → `preset = 'duo'`, `panes = [primary, secondary]`

New store additions:
```ts
workspace: WorkspaceState
resize: ResizeState

// Actions
setPreset(preset: WorkspacePreset): void
addMonitorPane(threadId: string): void
removeMonitorPane(): void
setActivePane(paneId: string): void
resizePanes(dragging: boolean, paneAId: string, paneBId: string, startX: number): void
applyResize(deltaX: number, containerWidth: number): void
endResize(): void
toggleMonitorCollapsed(): void
assignThreadToPane(paneId: string, threadId: string): void
```

### 2. PanePresetSwitcher UI

Add a small preset switcher to the top bar or as a floating control near the center area:
- 4 preset buttons (icon + label): Focus / Duo / Duo+Monitor / Operator
- Show current preset as active
- Switching preset: animate panes in/out, preserve primary pane's thread, close panes that aren't needed

Implementation: `components/chat/pane-preset-switcher.tsx`

### 3. ResizeHandle component

New component: `components/ui/resize-handle.tsx`
- Vertical bar, 4px wide, hover widens to 6px, cursor: col-resize
- On mousedown: capture startX, startWidths, set `resize.dragging = true`
- On mousemove: `applyResize(deltaX, containerWidth)` — recalculate width ratios, clamp to min widths
- On mouseup: `endResize()`
- Double-click: reset to nearest preset ratio

### 4. Update NeroWorkspace

Refactor to read from `workspace.panes` array instead of hardcoded split logic:
- Map `workspace.panes` → `ThreadPane` components
- Insert `ResizeHandle` between adjacent non-monitor panes
- Monitor pane renders `MonitorThreadPane` (new compact component) instead of full `ThreadPane`
- Keyboard `Tab` cycles `activePaneId` forward; `Shift+Tab` backward
- `Escape` while monitor pane is focused → close monitor pane

---

## Phase B — Monitor Pane

### MonitorThreadPane component

`components/chat/monitor-thread-pane.tsx` — compact passive view of a thread.

Content per pane role:

**Primary/Secondary pane:** full `ThreadPane` (existing component)

**Monitor pane:**
- Thread title (truncated, bold)
- Thread status chip
- Latest message preview (first 60 chars of most recent message)
- Approval indicator if pending
- Linked agents as small chips
- No composer (unless explicitly expanded by clicking "expand")
- Click anywhere → becomes active pane, expands to full size

Monitor pane collapsed state (when `monitorCollapsed = true`):
- 32px wide strip showing:
  - Thread color indicator bar
  - Thread title rotated 90°
  - Pending approval dot if applicable
- Hover to peek

### Pane role controls

In each pane header: a small dropdown or pill showing "Primary" / "Secondary" / "Monitor" role. Allow changing role (e.g., demote primary → monitor, promote monitor → secondary).

---

## Phase C — Motion Refinement

### Reduce
- `hover:scale-[1.01]` on thread list items — remove if overused
- `signal-pulse` on idle/done agent dots — static is fine for non-active states
- Transition duration: unify around `duration-150` (150ms) for utility transitions, `duration-200` for state changes, `duration-300` for layout changes

### Improve
- Pane resize: direct width manipulation via transform during drag, commit on release — no janky layout thrash
- Pane add/remove: `AnimatePresence` from Framer Motion — new pane fades+scales in (200ms), removed pane fades out (150ms)
- Preset switching: coordinated exit/enter of panes with staggered timing (50ms offset)
- Approval panel open: already spring — tune to `stiffness: 400, damping: 30`
- Thread selection: instant background change (no delay), border accent transitions in 100ms
- Monitor expand: smooth width transition (300ms ease-out) when clicking to expand

### Active agent pulse
Only `active` agents should pulse. `idle`, `waiting`, `done`, `blocked` are static. Keep pulse subtle — `opacity: 1 → 0.5 → 1` over 2.5s, not faster.

---

## Phase D — Smarter Right Rail + Approval Visibility

### Live rail: collapse idle/done agents

Update `LiveAgentRail`:
- Track which agents are `idle` or `done` → fold them into a collapsible "Idle (N)" section at the bottom
- `active` and `waiting` agents always visible
- `blocked` agents always visible (they need attention)
- Expand/collapse is smooth (Framer Motion height animation, 200ms)
- Collapsed state shows count badge: "Idle (2)"

### Approval indicators in thread rows

Update `ThreadListItem`:
- Add a small brass triangle `▲` indicator when `thread.hasApproval = true` (already partially there — make it more visible)
- Status chip should glow subtly when the thread has a pending approval

### Approval visibility in pane header

Update pane header (in `ThreadPane` or new `PaneHeader` component):
- Show pending approval count for that thread's pane: `▲ 1 pending`
- Click → opens approvals panel

---

## Phase E — Contextual Pane Headers

Each pane should have a clear identity header when split/duo mode is active.

In `ThreadPane`, when `isSplit=true`, show:
- Thread title
- Status chip
- Linked agent chips (compressed)
- Pane role label: "Primary" / "Secondary" / "Monitor" in small uppercase text
- Active indicator (pulsing teal dot) if this is the active pane

---

## Mock Data Additions

No new mock data needed for Sprint 2.5 — use existing threads. Ensure at least thread-7 (has approval) is usable as a monitor pane candidate.

---

## Explicitly NOT Adding

- True unlimited pane docking
- Desktop shell / Tauri
- Live OpenClaw RPC integration
- Branching threads
- Settings/admin

---

## Review Gates

- **After Phase A:** Ariadne reviews pane system refactor — can the resize mechanic handle edge cases? Are preset transitions smooth?
- **After Phase B:** Ariadne reviews monitor pane — does it feel compact and useful, or broken and confusing?
- **After Phase C:** Ariadne reviews motion refinement — smoother? less demo-y?
- **After Phase D:** Ariadne reviews live rail + approval visibility — smarter? faster to scan?
- **Final sign-off**

Report to Nero when complete with repo state, build status, what was built, how to use presets/resize, known gaps.
