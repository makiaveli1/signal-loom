# Signal Loom — Sprint 2.5a Nero Rules
## Pane Fallback Rules + Sidebar Routing Logic

---

## Source of truth

These rules govern pane behavior when:
- a pane is closed
- a pane's target thread changes
- a pane no longer exists after a preset switch
- sidebar thread clicks need a target

These rules are **Nero's canonical specification** for the behaviors described in brief §4.3 and §4.4.

---

## Pane Close Fallback Rules

### Rule 1 — What can be closed

| Pane role | Closeable? | Constraint |
|---|---|---|
| `primary` | ❌ Never | Must always have at least one working pane |
| `secondary` | ✅ Yes | Closes cleanly, focus reassigns |
| `monitor` | ✅ Yes | Collapses/removed, no orphan state |

### Rule 2 — Active pane close → deterministic reassignment via activePaneId only

`activePaneId` is the **sole source of truth** for which pane is active. No pane's `active` field is recomputed inline during close — only `activePaneId` changes. Pane `active` flags are derived from `activePaneId` in the store getter and at render time.

```typescript
closePane: (paneId) =>
  set(state => {
    const panes = state.workspace.panes;
    const pane = panes.find(p => p.id === paneId);
    if (!pane) return state;

    // Block primary close
    if (pane.role === 'primary') return state;

    // Block if last non-monitor
    const nonMonitor = panes.filter(p => p.role !== 'monitor');
    if (pane.role !== 'monitor' && nonMonitor.length <= 1) return state;

    const remaining = panes.filter(p => p.id !== paneId);

    // Determine new active pane — primary > secondary > monitor > first remaining
    const fallbackId =
      remaining.find(p => p.role === 'primary')?.id ??
      remaining.find(p => p.role === 'secondary')?.id ??
      remaining.find(p => p.role === 'monitor')?.id ??
      remaining[0].id;

    return {
      workspace: {
        ...state.workspace,
        // Derive preset from remaining pane roles (no inline active recompute)
        preset: derivePresetFromPanes(remaining),
        panes: remaining, // active flags unchanged — derived at render from activePaneId
        activePaneId: state.workspace.activePaneId === paneId ? fallbackId : state.workspace.activePaneId,
      }
    };
  })
```

Helper to derive preset from remaining panes (used by close and preset-switch):

```typescript
function derivePresetFromPanes(panes: Pane[]): WorkspacePreset {
  const hasMonitor = panes.some(p => p.role === 'monitor');
  const nonMonitor = panes.filter(p => p.role !== 'monitor');
  if (nonMonitor.length === 1 && !hasMonitor) return 'focus';
  if (nonMonitor.length === 2) return hasMonitor ? 'duo_monitor' : 'duo';
  if (nonMonitor.length === 1 && hasMonitor) return 'operator';
  return 'duo';
}
```

### Rule 3 — Inactive pane close → no active change

When an **inactive** pane is closed, `activePaneId` is unchanged — unless the closed pane was the last holder of a thread that `selectedThreadId` pointed to.

### Rule 4 — Closing last non-monitor pane is **blocked**

```typescript
const nonMonitorPanes = panes.filter(p => p.role !== 'monitor');
if (nonMonitorPanes.length <= 1) {
  // close is a no-op — do not remove the last working pane
  return;
}
```

### Rule 5 — Thread state after close

When a pane is closed and another pane had the same `threadId` → that other pane **retains its assignment** (no orphaned thread merge).

When a pane is closed and its `threadId` was not assigned elsewhere → that thread becomes "unassigned in pane space" but remains in the sidebar. Clicking it re-assigns via `selectThread`.

---

## Sidebar Thread Click Routing Rules

### Rule 1 — Canonical routing priority

When a sidebar thread is clicked, routing follows this decision tree:

```
1. Is the thread already in a pane?
   → YES: Activate that pane (setActivePaneById)
   → NO:  Go to step 2

2. Is there an inactive non-primary pane?
   → YES: Assign thread to that pane, activate it
   → NO:  Go to step 3

3. Assign to primary pane (swap its thread to the clicked thread's thread)
```

### Rule 2 — Monitor pane routing

The monitor pane is **never** a default sidebar click target. Monitor receives a thread only via:
- Explicit user action (e.g., "open in monitor" control)
- If the clicked thread is **already** in the monitor pane → Rule 1 step 1 applies (it activates the monitor)

This means: sidebar clicks never expand a collapsed monitor or assign a new thread to it by default.

### Rule 3 — `selectThread` store action is the canonical entry point

All sidebar thread clicks must call `selectThread(id)`. The store action implements the routing logic above. **No component should implement its own routing** — routing belongs in the store.

### Rule 4 — After preset switch

After `setPreset()`, the `activePaneId` is always set to the primary pane. `selectThread` re-evaluates from scratch against the new pane configuration.

### Rule 5 — After pane close

`selectThread` finds panes by `threadId` at call time. If the closed pane's thread is still referenced in another pane, it activates that pane. If not, it falls through to Rule 1 step 2.

---

## Active Pane Definition

The **active pane** is the one with `pane.active === true` (equivalently `pane.id === workspace.activePaneId`).

Only one pane can be active at a time. Active means:
- It receives new messages
- It owns the composer input
- It displays the delegation timeline

---

## Edge Cases

| Scenario | Expected behavior |
|---|---|
| Click thread already in active pane | No-op (same pane stays active) |
| Click thread in inactive pane | That pane activates |
| Click thread not in any pane, one pane free | Thread assigned to free pane |
| Click thread not in any pane, all panes full | Thread swaps into primary pane |
| Click thread, monitor has it, sidebar click | Monitor activates (Rule 1 step 1 — thread already in monitor) |
| Last secondary pane close attempt | Close blocked, button should be disabled |
| Close primary pane attempt | Close blocked at store level |

---

## Implementation Notes for Hephaestus

### Pane close implementation

Current code in `nero-workspace.tsx` `onClose` handler has the close logic inline in the component. **Move this to the store** as `closePane(paneId)`. The store implementation follows the pattern in Rule 2 above — `activePaneId` is the sole active truth, no inline `active` recomputation.

**Important:** The existing `removeMonitorPane` store action is correct in structure. Apply the same pattern for non-monitor pane close.

### Pane `active` flag

Panes render their `active` field from the store. Store `activePaneId` only. Do not set `active: true/false` inline when updating `activePaneId` — derive it at render time:

```typescript
// In rendering components:
const isActive = pane.id === workspace.activePaneId;
```

### Sidebar routing implementation

The store's `selectThread` action is the **only** routing entry point. Verify it handles:
- ✅ thread already in a pane → activates that pane (via `paneWithThread` check)
- ✅ thread not in any pane → assigns to `activePaneId` (default fallback)

**Bug to fix:** In duo mode, clicking a thread that lives in the inactive pane should activate that pane. The current `paneWithThread` check in `selectThread` handles this. Verify this path works after any store refactor.

### Monitor pane routing

Monitor is **never** an implicit sidebar target. `selectThread` must not route to monitor unless the clicked thread's `threadId` matches the monitor pane's `threadId`. The `paneWithThread` check already enforces this — monitor is only reached if it already holds the thread.

---

_Last updated: 2026-03-29_
