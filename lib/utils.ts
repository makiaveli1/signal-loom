import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Formats a date to a relative time string: "2m", "1h", "3d", "just now" */
export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString)
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

/** Formats a date to a short time string: "14:32" */
export function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })
}
