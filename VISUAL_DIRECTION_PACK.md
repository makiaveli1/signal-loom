# Signal Loom — Visual Direction Pack (Revised)
## For Nero / Hephaestus / Ariadne
### Purpose
Replace the earlier overly serious visual direction with a more expressive, more desirable, and more ownable style system.

This pack defines **three original visual directions** for Signal Loom, recommends one as the final direction, and translates that decision into concrete UI styling rules.

---

# 1. Design objective

Signal Loom should not feel like:
- a generic SaaS dashboard
- a BI tool
- a cybersecurity terminal cliché
- a novelty toy
- a 3D gimmick
- a corporate productivity app with no soul

It should feel like:
- a place Gbemi wants to spend time in
- a local operator cockpit with personality
- a system that feels alive when Nero and the specialist agents are working
- a polished, original product rather than a clone of another UI pattern

## Functional balance
The UI must support:
- long reading/chat sessions
- multiple threads
- split-screen work
- live agent visibility
- approvals and decisions
- runtime health

So the design must be expressive **without** making the reading surfaces noisy.

### Core visual rule
**Make the chrome expressive. Keep the reading surfaces calm.**

That means:
- navigation, cards, chips, active states, live rails, and headers can carry personality
- chat, timelines, long summaries, approvals, and runtime details must stay legible and low-friction

---

# 2. Research-led design conclusions

The research points toward a few clear truths:

1. **Bold visual personality is back**
   Modern interfaces are leaning toward stronger visual identity, bigger typography, immersive composition, and less generic polish.

2. **Split view matters in real work**
   Products that support multiple simultaneous conversations/views reduce context switching and make multi-threaded work feel natural.

3. **Neobrutalism is memorable but risky as a full system**
   It is striking and ownable, but too much of it can become harsh and fatiguing for dense, long-duration interfaces.

4. **Editorial and experimental web references are useful**
   The best inspiration for a UI that feels premium and distinctive often comes from editorial, fashion, storytelling, and interaction-design work — not from enterprise dashboards.

These research findings should shape the direction, but the final product should still be original.

---

# 3. Shortlisted visual directions

## Direction A — Afterglow Atelier
### Concept
A warm-dark creative control room with editorial composition and luminous live-state accents.

### Mood
- luxurious
- late-night
- cinematic
- intelligent
- artistic but controlled

### Best qualities
- premium and memorable
- Nero chat can feel warm and magnetic
- live agent work can feel elegant and alive
- easy to sustain visually over long sessions

### Risks
- can drift too far toward “luxury brand website”
- needs discipline to remain operational, not decorative

### Palette
- Ink Black
- Smoked Aubergine
- Warm Bone
- Burnt Coral
- Electric Cyan
- Muted Brass

### Typography
- expressive editorial grotesk for headings
- calm UI sans for body and controls
- mono only for traces, runtime details, timestamps, model tags

### Best use inside Signal Loom
- Nero chat
- thread cards
- approval banners
- elegant dual-thread mode

---

## Direction B — Midnight Broadcast
### Concept
A late-night signal desk for a one-person operator: part broadcast console, part magazine layout, part live control room.

### Mood
- alive
- stylish
- fast
- slightly rebellious
- operational without feeling sterile

### Best qualities
- perfect fit for live delegation and multi-threaded work
- split-screen feels native, like multiple live feeds
- thread and trace metaphors naturally support “signals”
- can be highly distinctive without copying cyberpunk clichés

### Risks
- can become fake “broadcast UI” if over-themed
- needs restraint in motion and accent use

### Palette
- Carbon Black
- Petrol Navy
- Warm Ivory
- Signal Red-Orange
- Phosphor Teal
- Soft Ultraviolet

### Typography
- characterful grotesk for headings
- high-legibility UI sans for body
- technical mono for trace/routing/runtime details

### Best use inside Signal Loom
- live agent rail
- runtime strip
- delegation timeline
- split-screen modes
- thread chips
- top shell / control framing

---

## Direction C — Soft Voltage
### Concept
A tactile, premium, slightly playful mission-control UI that feels more like an instrument than a dashboard.

### Mood
- approachable
- sticky
- bright but still dark-mode native
- tactile
- modern and enjoyable

### Best qualities
- easiest to live in every day
- most naturally ergonomic for long sessions
- strong thread and split-view usability
- friendlier than the more theatrical options

### Risks
- can become too safe
- may not feel distinctive enough unless art-directed strongly

### Palette
- Night Blue-Black
- Fog Gray
- Mint Teal
- Hot Apricot
- Pale Lilac
- Warm Cream

### Typography
- friendly modern sans for UI
- restrained display sans for emphasis
- mono only where clearly needed

### Best use inside Signal Loom
- thread dock
- chat UI
- agent cards
- approvals
- split-screen ergonomics

---

# 4. Final recommendation

## Recommended direction
# **Midnight Broadcast**

This is the best fit for what Signal Loom actually is.

### Why Midnight Broadcast wins
Signal Loom is:
- a Nero-centered operator surface
- a multi-threaded chat/control tool
- a live delegation monitor
- a decision and approval layer
- a runtime-aware cockpit

Midnight Broadcast matches those behaviors naturally.

It supports:
- the feeling of multiple live workstreams at once
- visible agent activity without turning into a log wall
- a strong identity without needing cyberpunk cosplay
- split-screen as a first-class feature
- a UI that feels like a place you operate from

### Why not the other two
**Afterglow Atelier** is beautiful, but a little less structurally perfect for the “live signal” nature of the product.

**Soft Voltage** is highly usable, but not quite as ownable or distinctive for this specific product.

### Positioning statement
**Signal Loom should feel like a late-night signal desk for a brilliant operator.**

---

# 5. Midnight Broadcast — full style system

## 5.1 Color system

### Foundation
- **Carbon Black** — primary app background
- **Petrol Navy** — elevated shell areas
- **Graphite Mist** — secondary surfaces
- **Warm Ivory** — primary text on dark surfaces
- **Soft Ash** — secondary text

### Active / signal colors
- **Phosphor Teal** — live activity, active agent, live-page/browser-enabled signal
- **Signal Red-Orange** — interruption, urgency, new event, active delegation pulse
- **Soft Ultraviolet** — branching, thread divergence, secondary “creative signal”
- **Brass Amber** — approvals, decisions, operator attention

### Safety / state colors
- **Soft Jade** — healthy / stable
- **Muted Rust** — blocked / risk / degraded
- **Fog Blue** — passive informational state

### Color usage rule
- do not let every active thing glow at once
- use one dominant signal color per local context
- preserve hierarchy with contrast, not just color

---

## 5.2 Surface system

### Main background
- deep dark matte surface
- extremely subtle texture/noise
- no flat lifeless black

### Panels
- slightly lighter than background
- low-gloss, soft sheen
- large radius
- internal borders instead of hard strokes where possible

### Elevated cards
- stronger shadow separation
- subtle edge-light or signal glow only when active
- no excessive blur everywhere

### Reading surfaces
- darker but calmer than shell chrome
- low visual vibration
- minimal decorative effects

---

## 5.3 Typography system

## Roles
### Display / headline font
Use a characterful grotesk or editorial sans.
Purpose:
- section headers
- view titles
- thread titles
- large metrics or current-objective emphasis

### UI body font
Use a highly readable modern sans.
Purpose:
- chat text
- controls
- long-form summaries
- labels
- panel content

### Technical mono
Use sparingly.
Purpose:
- timestamps
- runtime state
- trace metadata
- model labels
- agent IDs only where needed

## Typography behavior rules
- oversized headings are allowed in summary surfaces
- not every panel needs a big title
- message reading comfort matters more than style
- mono should never dominate the experience

---

# 6. Motion language

Motion should feel like:
- signal transmission
- lane activation
- feed switching
- broadcast interruption
- panel tuning

Not like:
- game UI
- bouncing cards
- floating holograms
- constant ambient movement

## Motion rules
### Thread selection
- smooth lateral emphasis
- slight underline/beam effect
- no heavy bounce

### Agent activation
- soft pulse on edge
- subtle “carrier signal” movement
- elapsed-time motion should be restrained

### Split-screen changes
- feel like changing feeds, not rearranging spreadsheets
- pane transitions should be obvious and quick

### Approval interrupt
- appear with a decisive slide or drop-in
- feel important, not annoying

### Reduced motion
- keep all information visible with motion disabled
- use color/shape/state chips as fallback

---

# 7. Screen-by-screen visual treatment

## 7.1 Mission Control
### Desired feel
A live, elegant control board.

### Visual treatment
- Nero focus card larger and warmer than other regions
- live rail cooler and more kinetic
- thread dock subdued but tactile
- runtime strip feels like a lower-third status band
- approvals feel like controlled interruptions, not warnings spam

## 7.2 Thread View
### Desired feel
An intimate, high-function conversation space with active system awareness.

### Visual treatment
- Nero chat is visually calmer and warmer than the rest of the layout
- delegation timeline feels like a readable signal trace
- live agent rail should stay visually separate from the chat surface
- approval side sheet should feel decisive and elevated

## 7.3 Dual Thread View
### Desired feel
Like managing two simultaneous live feeds.

### Visual treatment
- one pane must always feel active
- inactive pane should dim very slightly, not become dead
- both panes need clear status/identity markers
- center divider can carry a subtle signal treatment

## 7.4 Roster View
### Desired feel
A cast board with real roles, not a generic team directory.

### Visual treatment
- each agent card gets distinct role energy
- role subtitle is always visible
- browser-enabled lanes use teal signal markers
- blocked/review/waiting states should be easy to scan

## 7.5 Runtime / Health
### Desired feel
Broadcast engineer panel, not BI analytics.

### Visual treatment
- compact
- serious but still integrated into the aesthetic
- avoid giant charts
- emphasize what needs attention now

## 7.6 Approvals
### Desired feel
Operator interruption with authority.

### Visual treatment
- brass/amber dominant
- stronger contrast
- compact rationale blocks
- obvious recommended action
- fast jump back to source thread

---

# 8. Agent-specific visual accents

These are accents, not full recolors.

## Nero
- warm red-orange + brass
- strongest sense of authority
- center of emotional gravity

## Hephaestus
- ember orange / copper
- robust, forged, energetic
- builder heat

## Argus
- brass amber / muted rust
- severe, sharp, observant
- review pressure

## Ariadne
- soft ultraviolet / refined cyan
- elegant, thread-like, clarity energy
- design intelligence without cliché “pink designer mode”

## Orion
- phosphor teal / ice-blue edge
- evidence, verification, cool signal
- quiet precision

## Hermes
- bright coral / gold pulse
- persuasive, nimble, alert
- commercial momentum

---

# 9. Component styling rules

## Thread chips
- look like tuned channels, not plain pills
- compact but rich
- carry status and linked-agent hints
- can use color plus thin animated accent when active

## Agent live cards
- large enough to feel alive
- active state gets subtle moving accent
- blocked state uses rust/amber severity
- done state settles visually

## Approval cards
- stronger border/accent than standard cards
- recommendation line should stand out
- urgency should be obvious without screaming

## Runtime strip
- narrow but information-dense
- looks like a live ticker / lower-third
- compact chips with strong hierarchy

## Command bar
- serious, fast, elegant
- not floating toy chrome
- more like a tuned console input

## Message cards
- calm
- minimal decorative chrome
- clear spacing and hierarchy
- action-summary blocks can be more structured and designed than plain messages

---

# 10. What to avoid

Do **not**:
- go full Matrix green-black
- make every surface glow
- use brutalist borders everywhere
- create fake scanlines or CRT overlays across the whole app
- overuse blur
- make long reading areas high-contrast and aggressive
- turn every agent into a wildly different color toy
- make the runtime strip feel like a stock trading terminal
- lean on obvious cyberpunk clichés

---

# 11. Implementation guidance for Nero / Hephaestus / Ariadne

## Build order for visual system
1. define token system:
   - colors
   - radii
   - spacing
   - shadows
   - motion timings
2. style shell + top bar + thread dock
3. style Nero chat surfaces
4. style live agent rail
5. style approvals and runtime strip
6. style dual-thread and split panes
7. tune motion and reduced-motion behavior
8. run contrast and density pass

## Design review rule
If a screen looks cool but is harder to read for 30 minutes straight, the screen is not done.

## Chrome/content rule
Whenever unsure:
- add personality to shell/chrome/states
- simplify long-form reading surfaces

---

# 12. Final recommendation summary

## Final visual direction
**Midnight Broadcast**

## Product promise
Signal Loom should feel like:
- a stylish late-night operator desk
- a place where Nero is central
- a system where live work is visible
- a product with strong identity and daily usability

## Simple design sentence
**“A warm-dark signal desk with live system energy and calm reading surfaces.”**

That is the direction to build.
