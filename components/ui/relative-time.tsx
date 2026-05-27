'use client';

import { useState, useEffect } from 'react';
import { formatRelativeTime } from '@/lib/utils';

interface RelativeTimeProps {
  isoString: string;
  className?: string;
}

/**
 * Displays a relative timestamp ("2m", "1h", "just now").
 * Server-renders a static time on first pass to avoid hydration mismatch.
 * After mount, updates live so "just now" eventually becomes "2m", etc.
 */
export function RelativeTime({ isoString, className }: RelativeTimeProps) {
  const [label, setLabel] = useState<string>(() => formatRelativeTime(isoString));

  useEffect(() => {
    // Tick every 30s to keep "just now" → "2m" → ... fresh
    const id = setInterval(() => {
      setLabel(formatRelativeTime(isoString));
    }, 30_000);

    return () => clearInterval(id);
  }, [isoString]);

  return (
    <time dateTime={isoString} className={className} suppressHydrationWarning>
      {label}
    </time>
  );
}
