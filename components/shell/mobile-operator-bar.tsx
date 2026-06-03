'use client';

import { useSignalLoomStore } from '@/lib/store';
import { cn } from '@/lib/utils';

export function MobileOperatorBar({
  signalsOpen,
  lanesOpen,
  onToggleSignals,
  onToggleLanes,
}: {
  signalsOpen: boolean;
  lanesOpen: boolean;
  onToggleSignals: () => void;
  onToggleLanes: () => void;
}) {
  const {
    approvals,
    approvalsPanelOpen,
    hermesCommandCenterOpen,
    hermesSettingsOpen,
    verificationPanelOpen,
    toggleApprovalsPanel,
    toggleHermesCommandCenter,
    toggleHermesSettings,
    toggleVerificationPanel,
    workspaceMode,
    setWorkspaceMode,
  } = useSignalLoomStore();
  const pending = approvals.filter((approval) => approval.status === undefined || approval.status === 'pending').length;
  const items = [
    { id: 'loom', label: 'Loom', active: signalsOpen, onClick: onToggleSignals, badge: null },
    { id: 'lanes', label: 'Lanes', active: lanesOpen, onClick: onToggleLanes, badge: null },
    { id: 'command', label: 'Command', active: hermesCommandCenterOpen, onClick: toggleHermesCommandCenter, badge: null },
    { id: 'approvals', label: 'Review', active: approvalsPanelOpen, onClick: toggleApprovalsPanel, badge: pending > 0 ? String(pending) : null },
    { id: 'verify', label: 'Verify', active: verificationPanelOpen, onClick: toggleVerificationPanel, badge: null },
    { id: 'settings', label: 'Setup', active: hermesSettingsOpen, onClick: toggleHermesSettings, badge: null },
    { id: 'mode', label: workspaceMode === 'basic' ? 'Basic' : 'Operator', active: workspaceMode === 'operator', onClick: () => setWorkspaceMode(workspaceMode === 'basic' ? 'operator' : 'basic'), badge: null },
  ];

  return (
    <nav className="mobile-operator-bar hidden max-[900px]:grid" aria-label="Mobile operator controls">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={item.onClick}
          className={cn('mobile-operator-button', item.active && 'is-active')}
          aria-pressed={item.active}
        >
          <span>{item.label}</span>
          {item.badge && <strong>{item.badge}</strong>}
        </button>
      ))}
    </nav>
  );
}
