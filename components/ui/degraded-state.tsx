'use client';

import { cn } from '@/lib/utils';

type DegradedStateTone = 'neutral' | 'warn' | 'danger' | 'ok';

export function DegradedState({
  eyebrow,
  title,
  detail,
  tone = 'neutral',
  action,
  secondaryAction,
  className,
}: {
  eyebrow?: string;
  title: string;
  detail: string;
  tone?: DegradedStateTone;
  action?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  className?: string;
}) {
  return (
    <div className={cn('degraded-state-card', `tone-${tone}`, className)}>
      <span className="degraded-state-mark" aria-hidden="true">
        {tone === 'danger' ? '!' : tone === 'warn' ? '?' : tone === 'ok' ? '✓' : '⌁'}
      </span>
      {eyebrow && <p className="degraded-state-eyebrow">{eyebrow}</p>}
      <h2 className="degraded-state-title">{title}</h2>
      <p className="degraded-state-detail">{detail}</p>
      {(action || secondaryAction) && (
        <div className="degraded-state-actions">
          {action && (
            <button type="button" onClick={action.onClick} className="degraded-state-action primary">
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button type="button" onClick={secondaryAction.onClick} className="degraded-state-action secondary">
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
