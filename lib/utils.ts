import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function formatDelta(d: number | undefined): string {
  if (d === undefined) return '';
  if (d === 0) return '±0';
  return d > 0 ? `+${d}` : `${d}`;
}

export function relativeDays(iso: string): string {
  try {
    const then = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now.getTime() - then.getTime()) / 86400000);
    if (diff === 0) return 'today';
    if (diff === 1) return '1d ago';
    if (diff < 7) return `${diff}d ago`;
    if (diff < 30) return `${Math.floor(diff / 7)}w ago`;
    return `${Math.floor(diff / 30)}mo ago`;
  } catch {
    return '';
  }
}

/**
 * ISO 8601 week number for a given date string (YYYY-MM-DD in UTC).
 * Used on /top to mirror bkamp.ai's "2026년 4월 셋째 주" date specificity.
 */
export function isoWeek(dateStr: string): { year: number; week: number } {
  const d = new Date(dateStr + 'T00:00:00Z');
  // ISO week: Thursday-of-week trick.
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: target.getUTCFullYear(), week };
}

/**
 * Format a short date-range ending on `dateStr` going back `windowDays`:
 *   windowDays=7, dateStr=2026-04-20 → "Apr 14–20"
 * Returns empty string when window is 0 (no baseline yet).
 */
export function dateRangeLabel(dateStr: string, windowDays: number): string {
  if (!windowDays || windowDays < 1) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const end = new Date(dateStr + 'T00:00:00Z');
  const start = new Date(end.getTime() - windowDays * 86400000);
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const sm = months[start.getUTCMonth()];
  const em = months[end.getUTCMonth()];
  const sd = start.getUTCDate();
  const ed = end.getUTCDate();
  return sameMonth ? `${sm} ${sd}–${ed}` : `${sm} ${sd} – ${em} ${ed}`;
}
