# Signal Loom — Track B: Visual Identity Concept Pass

**Date:** 2026-04-01
**Author:** Nero (synthesized from live UI review + Ariadne design analysis)
**Basis:** Screenshots at 1440px, 1024px, approvals panel, agent roster, delegation timeline

---

## Where Signal Loom Is Now

The accepted baseline is solid. Three-column mission-control layout, midnight dark palette, teal/ember/brass accent system, thread dock, delegation timeline, agent roster, approvals panel. It works. It is credible.

Where it falls short on identity:
- **Thread dock:** Status text competes with title weight — the "active" green dot signals well but the status line lacks punch. Unread badges are small and can disappear against the noise.
- **Delegation timeline:** Clean git-log aesthetic but visually flat. Action summaries vs. delegation events vs. agent returns all look similar — hierarchy is semantic, not visual.
- **Agent roster:** The initial-based avatars with per-agent accent colors are the strongest personality element in the UI. The "Active" vs. "Idle" opacity fade is functional but blunt.
- **Approvals panel:** Trustworthy. The confidence signals and "Higher scrutiny" reasoning are the best thing in the UI. But the cards are dense and the "Waiting on you" amber badge gets lost against the dark background.
- **Status chips:** Functional but generic. No micro-animation. No sense of aliveness beyond the gateway dot.
- **Bottom status bar:** Visually thin — "Browser 2/4 lanes" feels unfinished compared to the rest of the system.

The product works. It needs to feel like it was *designed*, not assembled.

---

## Three Concept Directions

---

### Concept 1: Precision Instrument

**Mood / personality**
Aerospace mission control. Not sci-fi — real. Think: the calm precision of a Bloomberg terminal crossed with the visual confidence of a SpaceX mission dashboard. Every element earns its position. Information density is high but never chaotic. Operators feel in command, not overwhelmed.

**What changes visually**
- **Top bar:** System health indicators become compact instrument clusters — small labeled gauges (Gateway ● | Queue ● | Heartbeat ●) rather than loose text labels. Gateway status uses a proper colored indicator dot, not a text label.
- **Thread dock:** Threads get slightly taller rows (adds 4-6px). Status becomes a proper colored chip (not inline text). Unread badge gets a subtle glow ring. Active threads get a left-side colored border accent. "Waiting on you" threads get a warm amber left border — immediately scannable without reading.
- **Delegation timeline:** Events get a visual type treatment — a small icon or left-accent per event type (delegated = arrow, returned = check, approval = star, decision = gavel). The vertical connecting line becomes dotted for the past, solid for recent.
- **Agent roster:** Active agents get a subtle pulsing border glow in their accent color. Idle agents remain dimmed but the section header says "Away" not "Idle" — warmer. Agent initials get a more refined badge treatment (slightly larger, accent-tinted background).
- **Status chips:** Get a subtle shadow lift and micro-rounded corners. Active chips breathe — a very slow opacity pulse (5% delta, 3s cycle) so the screen never feels dead.
- **Bottom bar:** Replaced with a compact "system band" — thin (24px), dark, with only the most critical indicators. No decorative text.

**What changes interactively**
- Hover on thread row: subtle background lift
- Hover on agent card: show last-active timestamp tooltip
- Approval cards: "waiting on you" state has a gentle pulse on the amber badge
- Focus/Duo/Duo+Monitor presets: pane headers fade in with a 150ms stagger

**Why it fits Signal Loom**
The product's core value proposition is operator control of a multi-agent system. Precision Instrument makes the operator feel like they're sitting at a real command surface, not a dashboard. It elevates the perceived competence of the system without adding visual noise. The breathing micro-animations solve "screen feels dead at rest" without being distracting.

**What to prototype first**
Thread dock first — status chips + left-border "waiting on you" accent. This is the highest-traffic surface and the fastest to validate. Screenshot a before/after and show to Likwid.

**Risk / caution**
- The danger is over-engineering — adding too many micro-animations that add cognitive load instead of reducing it. Breathing chips must be truly subtle (5% delta, slow cycle). If it looks like a Christmas tree, it's wrong.
- Instrument clusters for health indicators require rethinking the top bar layout — not a rewrite, but not a trivial CSS tweak either.
- Prototype before committing to the full visual system.

---

### Concept 2: Calm Operations

**Mood / personality**
Stillness as a design statement. Inspired by Japanese industrial design and the restraint of tools like Linear, Raycast, and Dopple. The UI does less, but what it does, it does perfectly. No visual noise. No competing signals. Every element earns its place through necessity, not habit.

**What changes visually**
- **Color reduction:** Strip the palette to near-black background, one primary accent (teal/cyan), and one alert color (amber). Remove brass, ember, and purple from structural elements — keep them only where data requires it. The overall palette becomes quieter and more sophisticated.
- **Typography:** Slightly increase body font weight (from 400 to 450), tighten letter-spacing on headers. More contrast between title weight and body weight.
- **Thread dock:** Rows compress further. Remove the status dot entirely — use color-coded left border only. Status is readable on hover or at a glance via color. Title becomes the primary signal, not the status text. Unread badge: small, pill-shaped, high contrast.
- **Delegation timeline:** Becomes quieter. Events are separated by generous whitespace (16px instead of 8px). Action summaries are visually differentiated by a subtle top border rather than a background color. The timeline feels like a well-formatted document, not a log stream.
- **Agent roster:** Active/idle differentiation via opacity only (already done, lean into it harder — active at 100%, idle at 45%). Remove the "section header" grouping — list all agents in one flowing list, sorted by last active. No accordion.
- **Approvals panel:** Approval cards simplify — remove the confidence score pill, move "Higher scrutiny" rationale into a collapsible "Why this needs review" section. The card shows: who, what, urgency at a glance. That's it.
- **Status indicators:** All colored dots/chips get a subtle inner shadow for depth. No glow, no pulse — just quiet presence.

**What changes interactively**
- Collapsible "Why this needs review" on approval cards (collapsed by default)
- Thread dock rows highlight on hover with a 1px border rather than a background fill
- Delegation events expand on click to show full detail

**Why it fits Signal Loom**
The operator's job is to make decisions, not to read a busy screen. Calm Operations strips everything that isn't earning its place. It's the most implementable of the three — most changes are subtractions — and it's the safest to roll out incrementally. It makes Signal Loom feel like a premium professional tool, not a prototype.

**What to prototype first**
Approval cards — simplify the "needs_review" state first. If Likwid looks at the simplified card and it still feels trustworthy (all the right information is there), the direction is validated.

**Risk / caution**
- Removing the confidence score pill might reduce trust if operators relied on it for triage. Must validate that "urgency" + "rationale" is sufficient.
- The riskiest change is the agent roster — removing section grouping and sorting by last active could feel disorienting. Keep the grouping, just make it subtler.
- Calm Operations can be boring if taken too far — the product still needs to feel alive and capable.

---

### Concept 3: Living Field

**Mood / personality**
The multi-agent system as an ecosystem, not a machine. Inspired by bioluminescent organisms, node-graph editors, and topographic maps. The UI breathes, responds, and subtly reflects the state of the system without demanding attention. When something important happens, it registers — like a change in light.

**What changes visually**
- **Node-field background:** The thread dock gets a very subtle animated background — a faint dot grid or node network that gently shifts based on system state (more nodes for more active threads, fewer for idle). The effect is subliminal — if you notice it, it's too strong.
- **Thread rows:** Title gets a small status dot that has a slow radial pulse for active threads (breath-like, 4s cycle, subtle). Threads that are waiting on the user get an amber ring pulse instead.
- **Delegation timeline:** Events connected by curved lines instead of straight vertical lines — evokes a flowing network. Different event types get different node shapes (circle for delegation, diamond for return, star for approval). The timeline becomes a visual narrative of agent activity.
- **Agent cards:** Active agents have a subtle animated "field" around their avatar — a faint radial gradient that slowly pulses. Idle agents have no field. The effect is like a proximity sensor — you see who's active without reading a status label.
- **Approvals:** "Waiting on you" cards get a gentle left-border glow that pulses slowly. The glow is warm amber, barely visible. When approved/denied, the card does a soft fade-out transition (400ms).
- **Color system:** Warm whites and teals as base. More teal, less grey in backgrounds. A subtle warm tint to the dark background (not pure black). Accent: electric cyan for active states, warm amber for needs-attention states.

**What changes interactively**
- Thread dock: click and drag to reorder threads (persisted to session)
- Delegation events: hover to see a compact tooltip with agent + task
- Approval cards: swipe right to approve, swipe left to deny (mobile-influenced interaction on desktop — novel but learnable)

**Why it fits Signal Loom**
Signal Loom's core metaphor is already weaving — threads, agents, delegation. Living Field makes that metaphor tangible in the visual language. It differentiates Signal Loom from every other dark SaaS dashboard. It makes the system feel alive and responsive, which matches how OpenClaw actually works (agents working, returning, delegating in real time).

**What to prototype first**
Agent roster "active field" effect first. This is the most striking new element and the fastest to validate with a CSS prototype. Show a static mockup of the pulsing avatar field before building anything.

**Risk / caution**
- **Highest risk of the three.** Animated backgrounds and node-field effects can feel gimmicky or distracting if not executed perfectly. The line between "alive" and "annoying" is thin.
- Swipe-to-approve is a high-risk interaction change on the approval workflow — do not implement without extensive testing.
- "Living Field" works best if most of the UI stays still — the animations are accents, not the structure. If too many elements animate simultaneously, it becomes overwhelming.
- Recommended as: **direction to explore in Sprint 5, not to ship in Sprint 4.** Build a prototype, get Likwid's reaction, then decide whether to carry it forward.

---

## Recommended Direction

**Carry forward: Precision Instrument**

Rationale:
- Most implementable incrementally — the thread dock is a contained first slice
- Elevates the "operator at mission control" identity that Signal Loom already implies
- Addresses the three clearest gaps: status readability, "waiting on you" urgency, and dead-screen feel
- Breathing micro-animations are the lowest-risk way to make the screen feel alive
- The product identity becomes sharper without a rewrite

**Living Field** is the more distinctive direction and worth prototyping as a Sprint 5 exploration. If Precision Instrument lands well, Living Field becomes the full visual system upgrade for Sprint 6.

**Calm Operations** is the safest direction and the right call if Likwid wants to reduce cognitive load above all else. But for a product that's trying to be memorable and ownable, "safe" trades away the product's best opportunity to differentiate.

---

## Implementation Slice for Sprint 5 (Precision Instrument, Phase 1)

**Thread dock:**
1. Status text → colored chip with subtle shadow (not inline text)
2. Active threads: left-side colored border (teal for active, amber for waiting-on-you)
3. Unread badge: subtle outer glow ring
4. Rows: +4px height for breathing room

**Agent roster:**
1. Active agents: pulsing border glow in accent color
2. Idle section header: rename "Idle" → "Away"

**Top bar:**
1. Gateway/Queue/Heartbeat: compact labeled gauge cluster (text label + colored dot)

**Status chips:**
1. Add slow opacity breathing animation to active status chips (5% delta, 3s cycle, ease-in-out)

These 4 changes are independently shippable and can be merged incrementally.
