'use client';

import { useState } from 'react';

export function Composer() {
  const [value, setValue] = useState('');

  return (
    <div
      className="px-4 py-3 border-t"
      style={{
        background: 'var(--mb-shell)',
        borderColor: 'rgba(255,255,255,0.05)',
      }}
    >
      {/* Composer input area */}
      <div
        className="flex items-end gap-2 px-3 py-2.5 rounded-lg border transition-all duration-150"
        style={{
          background: 'var(--mb-panel)',
          borderColor: value.trim()
            ? 'rgba(232,96,58,0.25)'
            : 'rgba(255,255,255,0.08)',
          boxShadow: value.trim()
            ? '0 0 0 1px rgba(232,96,58,0.10), inset 0 0 0 1px rgba(232,96,58,0.05)'
            : 'none',
        }}
      >
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Message Nero..."
          rows={1}
          className="flex-1 bg-transparent text-sm text-ivory placeholder:text-ash-muted resize-none outline-none leading-relaxed"
          style={{ minHeight: '22px', maxHeight: '120px' }}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = 'auto';
            el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
          }}
        />
        <button
          className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-all duration-150"
          style={{
            background: value.trim() ? 'var(--mb-red)' : 'var(--mb-graphite)',
            color: value.trim() ? 'var(--mb-ivory)' : 'var(--mb-ash-muted)',
            transform: value.trim() ? 'scale(1)' : 'scale(0.95)',
            opacity: value.trim() ? 1 : 0.6,
          }}
          disabled={!value.trim()}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-label="Send">
            <path d="M1 6L11 1L6 11L5 7L1 6Z" fill="currentColor" />
          </svg>
        </button>
      </div>

      {/* Footer hint */}
      <p className="text-xs text-ash-muted mt-1.5 px-1">
        Nero is monitoring · routing is live
      </p>
    </div>
  );
}
