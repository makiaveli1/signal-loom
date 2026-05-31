# Signal Loom product direction — desktop, Hermes, and release posture

## Current recommendation

Signal Loom should become a **Hermes-first desktop companion app**, not a generic web dashboard and not an email/commercial automation surface.

The product promise should be simple:

> Download Signal Loom, connect your local Hermes install, and get a clearer way to understand sessions, tools, helper agents, approvals, settings, and updates.

## Why desktop makes sense

Hermes is local and powerful. Signal Loom currently exposes local control-plane features: config reads/writes, update checks, runtime diagnostics, session database reads, chat proxying, and approval decisions. Shipping that as a browser-served local web app is workable for development, but a desktop shell fits the trust model better.

Desktop advantages:

- Users can download one app instead of running `npm install`.
- The app can own first-run onboarding, update prompts, logs, and local notifications.
- A Tauri shell can keep privileged operations in Rust commands with narrower capabilities instead of broad HTTP mutation routes.
- Auto-update can be handled like product UX, not repo maintenance.
- It feels like a real companion to Hermes instead of a dev server someone has to babysit.

Recommended stack: **Tauri 2 wrapping the existing Next/React UI**, with a small Rust command layer for local probes and later safe installer/update operations.

## What not to do yet

Do not make the browser route install Hermes automatically as the first release move.

Start with:

1. Detect Hermes.
2. Explain what is missing.
3. Show copy-paste setup commands.
4. Let users run Hermes setup themselves.
5. Only later add a guarded desktop installer flow with narrow capabilities and typed confirmation.

## Open source vs free download

Recommended posture: **source-available/open-core-ish later is possible, but start with a public, source-visible free desktop app if the repo is safe enough.**

Because Hermes itself is open source, fully closing a convenience UI around it can create avoidable bad will if the messaging sounds like Signal Loom owns Hermes. The fix is positioning, not self-sabotage:

- Be explicit: Hermes Agent is the open-source runtime by Nous Research.
- Signal Loom is an independent companion interface for making Hermes easier to operate.
- Keep the local integration respectful: link Hermes docs, install commands, repo, and license.
- Do not imply Hermes features are Signal Loom-only.

Best trust posture:

- **Open-source Signal Loom core** under a permissive license once safety hardening lands.
- Ship signed/free desktop builds for normal users.
- If monetization comes later, charge for convenience/services: auto-updater polish, managed setup, templates, enterprise packaging, training, support, or hosted docs—not for access to Hermes itself.

If the whole app stays closed, use careful language:

- “Free companion app for Hermes Agent.”
- “Built to make local Hermes easier to use.”
- “Hermes remains open-source and independent.”

Avoid:

- “Our agent runtime.”
- “Signal Loom includes Hermes” unless the distribution actually bundles it with license compliance.
- Any paywall around basic Hermes access.

## Release path

### Phase 1 — web app hygiene

- Remove non-Hermes features.
- Add Hermes detection and first-run connection UX.
- Replace maintainer-specific paths with user-home defaults.
- Add `.env.example` and safe localhost launch docs.
- Keep mutation routes trusted-local only.

### Phase 2 — desktop wrapper spike

- Add Tauri 2 with existing Next UI.
- Keep Rust commands minimal:
  - detect Hermes binary/version
  - detect config/env/state DB paths
  - check API reachability
  - open logs/config folder
- Use least-privilege Tauri capabilities.
- Do not expose generic shell execution to the frontend.

### Phase 3 — desktop release

- Add app signing/update channel.
- Add a first-run wizard.
- Add explicit Hermes install/setup guidance.
- Add guarded updater UX.
- Package for Windows first, then macOS/Linux as demand proves itself.

## Product UX north star

Default mode should be understandable in 30 seconds:

1. Is Hermes connected?
2. Where are my chats?
3. What can Hermes do?
4. What needs my approval?
5. How do I change model/tools/memory safely?

The current dense operator cockpit can remain as **Operator mode**. New users need **Basic mode** first.
