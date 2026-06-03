'use client';

import { DESKTOP_CAPABILITIES, summarizeDesktopCapabilities } from '@/lib/desktop-capabilities';
import { cn } from '@/lib/utils';

const STATUS_LABEL = {
  available: 'Available now',
  planned: 'Tauri planned',
  blocked: 'Blocked',
} as const;

const RISK_LABEL = {
  'read-only': 'Read-only',
  'local-open': 'Local open',
  'local-write': 'Local write',
  'external-visible': 'Visible outside app',
} as const;

export function DesktopBoundaryPanel({ compact = false }: { compact?: boolean }) {
  const summary = summarizeDesktopCapabilities();

  return (
    <section className={cn('desktop-boundary-panel rounded-3xl border border-white/10 bg-white/[0.025] p-4', compact && 'is-compact')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brass">Desktop wrapper plan</p>
          <h3 className="mt-1 text-base font-semibold text-ivory">Native powers stay narrow and permissioned</h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-ash">
            The browser UI may copy paths, prepare prompts, export handoffs, and show updater status. Real desktop actions belong behind a Tauri capability allowlist — no generic shell button, no arbitrary path execution.
          </p>
        </div>
        <div className="desktop-boundary-summary" aria-label="Desktop capability summary">
          <span>{summary.available} available</span>
          <span>{summary.planned} planned</span>
          <span>{summary.risky} guarded</span>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        {DESKTOP_CAPABILITIES.map((capability) => (
          <article key={capability.id} className={cn('desktop-capability-card', 'status-' + capability.status)}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <strong>{capability.label}</strong>
                <span>{STATUS_LABEL[capability.status]}</span>
                <span>{RISK_LABEL[capability.risk]}</span>
              </div>
              <p><b>Browser fallback:</b> {capability.browserFallback}</p>
              <p><b>Tauri scope:</b> {capability.tauriScope}</p>
              <p><b>Guardrail:</b> {capability.guardrail}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
