'use client';

import { cn } from '@/lib/utils';
import type { Message } from '@/lib/types';

function timeString(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' });
}

interface MessageCardProps {
  message: Message;
}

export function MessageCard({ message }: MessageCardProps) {
  if (message.role === 'action-summary') {
    return <ActionSummaryCard message={message} />;
  }

  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-3 rounded-lg",
        message.role === 'user'
          ? "bg-elevated/70 ml-8"
          : message.role === 'nero'
          ? "bg-reading/80 mr-8 border"
          : "bg-graphite/50 mr-8"
      )}
      style={
        message.role === 'nero'
          ? { borderColor: 'rgba(232,96,58,0.35)', borderLeftColor: 'var(--mb-red)' }
          : {}
      }
    >
      {/* Role icon */}
      <div className="flex-shrink-0 mt-0.5">
        {message.role === 'user' && (
          <span className="text-ivory-dim text-sm font-semibold">You</span>
        )}
        {message.role === 'nero' && (
          <div className="flex items-center gap-1.5">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: 'var(--mb-red)', color: 'var(--mb-ivory)' }}
            >
              N
            </div>
          </div>
        )}
        {message.role === 'system' && (
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center"
            style={{ background: 'var(--mb-fog)', opacity: 0.6 }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <circle cx="5" cy="5" r="4" stroke="var(--mb-ivory)" strokeWidth="1.2" />
              <circle cx="5" cy="5" r="1.5" fill="var(--mb-ivory)" />
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm leading-relaxed",
            message.role === 'nero' ? "text-ivory" : "text-ivory-dim"
          )}
        >
          {message.content}
        </p>
        <span className="text-xs font-mono text-ash-muted mt-1 block">
          {timeString(message.timestamp)}
        </span>
      </div>
    </div>
  );
}

function ActionSummaryCard({ message }: { message: Message }) {
  return (
    <div
      className="flex gap-3 px-4 py-3 rounded-lg mx-8 my-2 border"
      style={{
        background: 'rgba(139,126,200,0.06)',
        borderColor: 'rgba(139,126,200,0.2)',
      }}
    >
      <div className="flex-shrink-0 mt-0.5">
        <div
          className="w-5 h-5 rounded flex items-center justify-center"
          style={{ background: 'var(--mb-violet-dim)' }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1.5 5L4 7.5L8.5 2.5" stroke="var(--mb-violet)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-signal-violet mb-1 uppercase tracking-wider">
          Action Summary
        </p>
        <p className="text-sm text-ivory-dim leading-relaxed">
          {message.content}
        </p>
        <span className="text-xs font-mono text-ash-muted mt-1 block">
          {timeString(message.timestamp)}
        </span>
      </div>
    </div>
  );
}
