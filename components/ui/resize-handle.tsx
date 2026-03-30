'use client';

import { useRef, useCallback, useEffect } from 'react';
import { useSignalLoomStore } from '@/lib/store';
import { cn } from '@/lib/utils';

interface ResizeHandleProps {
  paneAId: string;
  paneBId: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
  className?: string;
}

export function ResizeHandle({ paneAId, paneBId, containerRef, className }: ResizeHandleProps) {
  const { resize, resizePanes, applyResize, endResize } = useSignalLoomStore();
  const isDragging = resize.dragging && resize.paneAId === paneAId && resize.paneBId === paneBId;
  const handleRef = useRef<HTMLDivElement>(null);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      // Store initial width ratios from current workspace state
      const ws = useSignalLoomStore.getState().workspace;
      const paneA = ws.panes.find((p) => p.id === paneAId);
      const paneB = ws.panes.find((p) => p.id === paneBId);
      resizePanes(
        true,
        paneAId,
        paneBId,
        e.clientX,
        paneA?.widthRatio ?? 0.5,
        paneB?.widthRatio ?? 0.5
      );
    },
    [paneAId, paneBId, containerRef, resizePanes]
  );

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!resize.dragging || resize.startX === undefined || !containerRef.current) return;
      const deltaX = e.clientX - resize.startX;
      const rect = containerRef.current.getBoundingClientRect();
      applyResize(deltaX, rect.width);
    },
    [resize, paneAId, paneBId, containerRef, applyResize]
  );

  const onMouseUp = useCallback(() => {
    endResize();
  }, [endResize]);

  // Double-click: reset to nearest 50/50
  const onDoubleClick = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    applyResize((rect.width * 0.5) - (rect.width * (resize.startWidthA ?? 0.5)), rect.width);
    endResize();
  }, [containerRef, applyResize, endResize, resize]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, onMouseMove, onMouseUp]);

  return (
    <div
      ref={handleRef}
      className={cn(
        'relative flex-shrink-0 cursor-col-resize group transition-all duration-150',
        isDragging ? 'w-1 bg-[var(--mb-teal)]/40' : 'w-px hover:w-1 hover:bg-[rgba(255,255,255,0.12)]',
        className
      )}
      style={{ background: isDragging ? 'var(--mb-teal)' : 'rgba(255,255,255,0.05)' }}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
    >
      {/* Visual grab indicator */}
      <div
        className={cn(
          'absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 transition-opacity duration-150',
          'opacity-0 group-hover:opacity-100',
          isDragging && 'opacity-100'
        )}
        style={{ background: 'var(--mb-teal)', opacity: 0.4 }}
      />
    </div>
  );
}
