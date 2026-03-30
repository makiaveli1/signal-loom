# Signal Loom — Sprint 3 Nero Rules
## Event Language, Truthfulness, and Fallback Display

---

## Source of truth

These rules govern what Signal Loom shows when real runtime data is:
- **Available** — show it accurately
- **Partially available** — show the best truthful summary
- **Unavailable** — show a clear label, not invented precision

---

## Event Language Rules

### Core principle
Every event label must be a **human-readable workflow trace**, not a debug log line.

| Runtime data | Show | Do NOT show |
|---|---|---|
| Known agent name | Agent name | Raw event type code |
| Known action | Human phrase: "Hephaestus returned" | "agent_returned" |
| Unknown event | "Activity from [agent]" | Raw event type |
| No delegation event | "No recent activity" | Empty timeline |

### Event phrasing (canonical forms)

```typescript
const EVENT_PHRASES: Record<string, { present: string; past: string }> = {
  received:        { present: 'Nero received a message',   past: 'Nero received a message' },
  delegated:       { present: 'Assigning to {agent}',      past: 'Assigned to {agent}' },
  agent_active:    { present: '{agent} is working',         past: '{agent} started' },
  agent_returned:  { present: '{agent} returned',           past: '{agent} returned' },
  approval_requested: { present: 'Approval requested',      past: 'Approval requested' },
  decision_made:   { present: 'Decision made',              past: 'Decision made' },
};
```

### Fallback for unknown event types
```
"Activity from {agent}"
```
Never show: raw event codes, internal type names, or unexplained abbreviations.

---

## Agent Status Rules

| Gateway agent state | UI label | Color |
|---|---|---|
| `active` | "Active" | teal |
| `waiting_on_nero` | "Waiting on Nero" | red |
| `waiting_on_specialist` | "Waiting on specialist" | brass |
| `waiting_on_user` | "Needs you" | violet |
| `blocked` | "Blocked" | rust |
| `done` / `idle` | "Done" | ash |
| Unknown | "Status unavailable" | ash |

---

## Approval Display Rules

### Fallback when no real approvals available
Show: "No pending approvals"
Do NOT show: empty cards, placeholder cards, or cards implying authority that isn't wired.

### When real approval is available
- Show: thread context
- Show: agent who requested
- Show: action description
- Show: approve/deny buttons IF those are wired to `exec.approval.resolve`
- If buttons are NOT wired: show label "View in app" only — do not imply click-to-approve

### Never show
- Approval counts that are guessed
- "Pending" for an approval that has been resolved
- Precision in timing that isn't actually known

---

## Session/Thread Display Rules

### When session list is loading
Show: "Loading sessions..." with a subtle spinner

### When session list is empty
Show: "No active sessions — start a conversation with Nero to begin"

### When session list fails to load
Show: "Sessions unavailable — check gateway connection"
Keep mock fallback visible as secondary context, clearly labeled "preview"

### Thread title
- Prefer real session title from gateway
- Fallback: "Session {shortId}"
- Never: "Untitled" without explanation

### Thread metadata
- Show agent name if known
- Show "active N messages" if count is available
- Show relative time of last message
- If time unavailable: "recent activity" — not "last seen X ago" with guessed time

---

## Message Display Rules

### When a message is pending (sent but no response yet)
Show: message in thread with "Sending..." indicator
Do NOT: show a fake response or loading skeleton that implies a real reply

### When a message fails to send
Show: message with error state ("Failed to send — tap to retry")
Do NOT: silently remove the message or replace with a success state

### When response arrives
Show: real response content
If content is empty or malformed: show "[No response]" with a note

### Composer placeholder
```
Message Nero...
```
No agent name in placeholder — the active pane tells the user who they're talking to.

---

## Runtime Health Rules

| State | Display |
|---|---|
| Gateway reachable | "Gateway: healthy" |
| Gateway unreachable | "Gateway: unreachable — check connection" |
| Queue healthy | "Queue: healthy" |
| Queue unknown | "Queue: unknown" |
| Heartbeat fresh (<2 min) | "Heartbeat: fresh" |
| Heartbeat stale (>2 min) | "Heartbeat: stale" |
| Canvas disabled | "canvas off" (always — no change) |
| Browser lane active | "Browser 2/4 lanes" — real count |

---

## What "truthful degradation" looks like

The UI should always feel **intentional and calm**, never like something broke.

```
Loading state:     Spinner + "Loading sessions..."
Empty state:       Friendly message + next action hint
Stale state:       "Last updated X ago" + reconnect option
Error state:       "Unavailable" + what to check
Partial state:     Best available + "may be incomplete" note
```

---

## Adapter architecture principles

1. **One canonical adapter** — `lib/openclaw/adapter/index.ts`
2. **Normalize at the boundary** — gateway raw types → app types, never leak gateway types into UI
3. **Mock behind a feature flag** — `NEXT_PUBLIC_USE_MOCK_DATA=true` for local dev without gateway
4. **Never trust a stale adapter response** — every adapter function should indicate freshness
5. **Type the app types strictly** — don't use `any` for runtime data

---

_Last updated: 2026-03-30_
