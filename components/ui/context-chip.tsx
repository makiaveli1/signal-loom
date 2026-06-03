import { cn } from '@/lib/utils';
import type { ContextChip as ContextChipModel } from '@/lib/operator-qol';

const toneClass: Record<ContextChipModel['tone'], string> = {
  ok: 'context-chip-ok',
  warn: 'context-chip-warn',
  danger: 'context-chip-danger',
  neutral: 'context-chip-neutral',
};

export function ContextChip({ chip }: { chip: ContextChipModel }) {
  return (
    <span className={cn('context-chip', toneClass[chip.tone])} title={chip.detail}>
      {chip.label}
    </span>
  );
}
