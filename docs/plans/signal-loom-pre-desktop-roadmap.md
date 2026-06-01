# Signal Loom Pre-Desktop Improvement Roadmap

Status: planning baseline after repo cleanup on 2026-06-01.

Goal: finish the web app into a stable local operator cockpit before wrapping it as a desktop app. Do not start desktop packaging until the local web contract, safety boundaries, and verification lanes are boring.

## Recommended direction

Use Tauri 2 for the desktop shell unless a later requirement proves Electron is necessary. Signal Loom is a local-first operator cockpit, so Tauri's smaller footprint, Rust-side capability model, and explicit permissions are a better fit than shipping a full Chromium runtime through Electron.

Desktop architecture target:

- Existing Next.js UI remains the frontend.
- Tauri owns the local desktop shell, native window, app lifecycle, file-system permissions, and optional tray/global shortcut behavior.
- Keep privileged Hermes operations behind narrow Rust commands or server-side Next routes; do not expose generic shell/process/file access to the frontend.
- Start single-window. Add multi-window only if settings, approvals, or live lanes prove they need separate always-on surfaces.

## Phase 1: Product stabilization before desktop

1. Runtime contract hardening
   - Normalize Hermes API env names and fallback order in docs and code.
   - Make degraded/offline states deterministic and test-covered.
   - Add route-level tests for health, sessions, live events, and history parameter failures.
   - Make error copy actionable without leaking private local paths, tokens, or API URLs.

2. Chat and session quality
   - Tighten transcript rendering for long tool outputs, code blocks, and interrupted runs.
   - Add search/filter across sessions and messages.
   - Add pinned/favorite sessions and simple workspace recents.
   - Improve mobile chat clipping and composer behavior before desktop freezes layout assumptions.

3. Approvals and safety UX
   - Separate approval types: command, external send, file write, config change, install/update.
   - Add provenance details: source session, command/request payload summary, risk label, expiry.
   - Make deny/approve outcomes visible in the timeline.
   - Add redaction and copy-to-clipboard controls for diagnostic payloads.

4. Theme and visual polish
   - Finish theme tokens so each operating mode controls density, radius, motion, and material, not only color.
   - Add reduced-motion verification and high-contrast verification to CI/browser QA docs.
   - Refresh README screenshots after finalizing the visual baseline.
   - Keep generated imagery decorative and documented in `docs/generated-image-inventory.md`.

## Phase 2: Engineering readiness

1. Test expansion
   - Add API route tests or integration tests for adapter edge cases.
   - Add Playwright smoke tests for desktop width, compact width, theme persistence, drawer controls, and settings modal.
   - Keep current CI gates: typecheck, lint, tests, build.

2. Configuration cleanup
   - Create a documented `.env.example` if the app needs a committed template.
   - Validate local config on startup and show one truth panel for detected values.
   - Avoid committing local `.env.local`, `.next`, `.qa-artifacts`, screenshots, or Hermes state.

3. Release hygiene
   - Add version/changelog discipline before packaged desktop releases.
   - Add GitHub release notes only once binaries exist.
   - Consider branch protection once direct `main` pushing stops being useful.

## Phase 3: Desktop conversion plan

1. Audit desktop prerequisites
   - Check Rust, Cargo, rustfmt, clippy, Node, npm, and Tauri CLI readiness from the real machine.
   - On Windows/WSL, validate which commands run in WSL and which must run through Windows PowerShell/MSVC.

2. Initialize Tauri
   - Use official Tauri 2 init/scaffold flow rather than hand-building `src-tauri`.
   - Prefer repo-local npm scripts, e.g. `tauri:dev`, `tauri:build`, and `tauri:check`.
   - Configure dev URL to the existing Next dev server and production asset path to the Next build output strategy chosen for desktop.

3. Define the security boundary
   - Keep a small default capability for the main window.
   - Add permissions only when a feature needs them.
   - Prefer app-local Rust commands over a reusable plugin until reuse is proven.
   - Do not expose broad shell, filesystem, updater, or process permissions by default.

4. Desktop-only features after the wrapper works
   - Tray status for Hermes API health.
   - Optional global shortcut to focus Signal Loom.
   - Native notifications for approval requests and completed long-running jobs.
   - Safe local log export bundle with redaction.
   - Window presets: compact command bar, full cockpit, approvals monitor.

## Immediate next build slice

Recommended next slice before desktop: fix mobile chat clipping and add Playwright smoke coverage. That catches the layout class of bugs most likely to become expensive after desktop window constraints enter the picture.

Acceptance checks for that slice:

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- Playwright/browser smoke at `390x844`, `820x900`, and `1440x900`
- No horizontal overflow, no duplicate IDs, no unnamed visible controls, no hydration overlay
- Theme persistence survives reload across at least one dark theme and one light theme
