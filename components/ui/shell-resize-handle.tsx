'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type ShellResizeHandleProps = {
  ariaLabel: string;
  side?: 'left' | 'right';
  className?: string;
  onDrag: (deltaX: number) => void;
  onReset?: () => void;
};

export function ShellResizeHandle({
  ariaLabel,
  side = 'left',
  className,
  onDrag,
  onReset,
}: ShellResizeHandleProps) {
  const [dragging, setDragging] = useState(false);
  const startXRef = useRef(0);

  const onMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    startXRef.current = event.clientX;
    setDragging(true);
  }, []);

  const onMouseMove = useCallback((event: MouseEvent) => {
    if (!dragging) return;
    const rawDelta = event.clientX - startXRef.current;
    onDrag(side === 'left' ? rawDelta : -rawDelta);
    startXRef.current = event.clientX;
  }, [dragging, onDrag, side]);

  const onMouseUp = useCallback(() => {
    if (!dragging) return;
    setDragging(false);
  }, [dragging]);

  useEffect(() => {
    if (!dragging) return;
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [dragging, onMouseMove, onMouseUp]);

  return (
    <div
      role="separator"
      aria-label={ariaLabel}
      aria-orientation="vertical"
      tabIndex={0}
      onMouseDown={onMouseDown}
      onDoubleClick={onReset}
      className={cn(
        'shell-resize-handle group relative flex h-full w-2 flex-shrink-0 cursor-col-resize items-center justify-center transition-colors duration-150',
        dragging && 'is-dragging',
        className
      )}
      title={`${ariaLabel}. Drag to resize${onReset ? ', double-click to reset' : ''}.`}
    >
      <span className="shell-resize-grip" aria-hidden="true" />
    </div>
  );
}
