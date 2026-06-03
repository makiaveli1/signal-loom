import { cn } from '@/lib/utils';
import type { SafetyLabel } from '@/lib/operator-qol';

const toneClass: Record<SafetyLabel['tone'], string> = {
  ok: 'local-safety-ok',
  warn: 'local-safety-warn',
  danger: 'local-safety-danger',
  neutral: 'local-safety-neutral',
};

export function LocalSafetyLabel({ label }: { label: SafetyLabel }) {
  return (
    <span className={cn('local-safety-label', toneClass[label.tone])} title={label.detail}>
      {label.label}
    </span>
  );
}
