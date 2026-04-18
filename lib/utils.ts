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
