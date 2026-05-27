'use client';

import { useEffect, useMemo, useState } from 'react';
import { layoutWithLines, prepareWithSegments } from '@chenglou/pretext';
import { cn } from '@/lib/utils';

interface PretextSmartTitleProps {
  text: string;
  className?: string;
  maxWidth?: number;
  maxLines?: number;
  font?: string;
  lineHeight?: number;
}

/**
 * Uses Pretext's layout engine for dense operator labels where CSS truncation
 * tends to cut the useful words. If Pretext cannot measure in the current
 * browser/runtime, it gracefully falls back to regular text.
 */
export function PretextSmartTitle({
  text,
  className,
  maxWidth = 340,
  maxLines = 2,
  font = '500 12px Inter, ui-sans-serif, system-ui, sans-serif',
  lineHeight = 16,
}: PretextSmartTitleProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  const lines = useMemo(() => {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!clean) return [];
    try {
      const prepared = prepareWithSegments(clean, font, { whiteSpace: 'normal', wordBreak: 'normal' });
      const result = layoutWithLines(prepared, maxWidth, lineHeight);
      return result.lines.slice(0, maxLines).map((line) => line.text.trim()).filter(Boolean);
    } catch {
      return [clean];
    }
  }, [font, lineHeight, maxLines, maxWidth, text]);

  const fallbackText = text.replace(/\s+/g, ' ').trim() || text;

  if (!mounted || lines.length <= 1) {
    return <span className={cn('truncate', className)} title={text} aria-label={text}>{mounted ? (lines[0] ?? fallbackText) : fallbackText}</span>;
  }

  return (
    <span className={cn('flex min-w-0 flex-col leading-snug', className)} title={text}>
      {lines.map((line, index) => (
        <span key={`${line}-${index}`} className="truncate">
          {line}{index === lines.length - 1 && lines.length >= maxLines && text.length > lines.join(' ').length ? '…' : ''}
        </span>
      ))}
    </span>
  );
}
