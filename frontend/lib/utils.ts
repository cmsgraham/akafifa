import { type ClassValue, clsx } from 'clsx';

/**
 * Merge class names conditionally.
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/**
 * Format a UTC date to the user's local timezone.
 */
export function formatLocalDate(utcDate: string | Date): string {
  const date = new Date(utcDate);
  return date.toLocaleString();
}

/**
 * Calculate time remaining until a deadline.
 */
export function timeUntil(deadline: string | Date): string {
  const now = new Date();
  const target = new Date(deadline);
  const diff = target.getTime() - now.getTime();

  if (diff <= 0) return 'Locked';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  return `${hours}h ${minutes}m`;
}

/**
 * Truncate text to a max length.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}
