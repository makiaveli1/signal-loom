export type DesktopCapabilityStatus = 'available' | 'planned' | 'blocked';
export type DesktopPermission = 'notification' | 'dialog' | 'shell-open' | 'deep-link' | 'updater' | 'fs-read';

export type DesktopCapability = {
  id: string;
  label: string;
  status: DesktopCapabilityStatus;
  permission: DesktopPermission;
  risk: 'read-only' | 'local-open' | 'local-write' | 'external-visible';
  browserFallback: string;
  tauriScope: string;
  guardrail: string;
};

export const DESKTOP_CAPABILITIES: DesktopCapability[] = [
  {
    id: 'tray-notifications',
    label: 'Tray and native notifications',
    status: 'planned',
    permission: 'notification',
    risk: 'external-visible',
    browserFallback: 'Use the in-app runtime strip and approval badge counts.',
    tauriScope: 'Allow notification emit only from explicit runtime/approval events.',
    guardrail: 'No message content in notifications until a privacy setting opts in.',
  },
  {
    id: 'open-config-folder',
    label: 'Open config/state folders',
    status: 'planned',
    permission: 'shell-open',
    risk: 'local-open',
    browserFallback: 'Copy paths from Settings > Connect.',
    tauriScope: 'Open only known Hermes home/config/cache/log paths resolved by the server.',
    guardrail: 'Never accept arbitrary user-provided shell paths from the browser.',
  },
  {
    id: 'deep-links',
    label: 'signal-loom:// deep links',
    status: 'planned',
    permission: 'deep-link',
    risk: 'local-open',
    browserFallback: 'Copy resume commands and session IDs from thread details.',
    tauriScope: 'Route only to app views such as session, approval, settings, or verification.',
    guardrail: 'Deep links must never execute commands or mutate Hermes config directly.',
  },
  {
    id: 'approval-gated-updates',
    label: 'Approval-gated updater',
    status: 'available',
    permission: 'updater',
    risk: 'local-write',
    browserFallback: 'Settings > Update requires typed confirmation before any local update route runs.',
    tauriScope: 'Updater calls stay behind exact typed confirmation plus local-only API route.',
    guardrail: 'Show version/output and require restart guidance after update; no silent auto-update.',
  },
  {
    id: 'safe-log-export',
    label: 'Safe log / verification export',
    status: 'planned',
    permission: 'fs-read',
    risk: 'read-only',
    browserFallback: 'Copy verification summaries and handoff markdown from the browser.',
    tauriScope: 'Read/export only curated diagnostics with token redaction.',
    guardrail: 'Apply redaction before writing or sharing exports.',
  },
];

export type DesktopCapabilitySummary = {
  available: number;
  planned: number;
  blocked: number;
  risky: number;
  canExposeNativeControls: boolean;
};

export function summarizeDesktopCapabilities(capabilities: DesktopCapability[] = DESKTOP_CAPABILITIES): DesktopCapabilitySummary {
  return capabilities.reduce<DesktopCapabilitySummary>((summary, capability) => {
    summary[capability.status] += 1;
    if (capability.risk !== 'read-only') summary.risky += 1;
    return summary;
  }, { available: 0, planned: 0, blocked: 0, risky: 0, canExposeNativeControls: false });
}

export function shouldExposeNativeControls({ isTauri, explicitDesktopMode }: { isTauri: boolean; explicitDesktopMode: boolean }): boolean {
  return Boolean(isTauri && explicitDesktopMode);
}
