import { cache } from 'react';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { DailyDigest } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');

/**
 * Lightweight runtime guard for parsed digest JSON. Checks the date string,
 * that `categories` is an array, and that each category has a string
 * `category` id and an array `items`. Does not deep-validate individual Repo
 * shapes (that's the fetch pipeline's job) — this is a defense against
 * truncated/malformed files reaching the render path undetected.
 */
export function isValidDigest(x: unknown): x is DailyDigest {
  if (!x || typeof x !== 'object') return false;
  const d = x as Record<string, unknown>;
  if (typeof d.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return false;
  if (!Array.isArray(d.categories)) return false;
  return d.categories.every((c) => {
    if (!c || typeof c !== 'object') return false;
    const cat = c as Record<string, unknown>;
    return typeof cat.category === 'string' && Array.isArray(cat.items);
  });
}

async function readDigestFile(date: string): Promise<DailyDigest | null> {
  const filePath = path.join(DATA_DIR, `${date}.json`);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const parsed: unknown = JSON.parse(content);
    if (!isValidDigest(parsed)) {
      console.error(`[lib/data] invalid digest shape in ${filePath} — skipping`);
      return null;
    }
    return parsed;
  } catch (err) {
    console.error(`[lib/data] failed to read/parse ${filePath}:`, err);
    return null;
  }
}

async function readAllDates(): Promise<string[]> {
  try {
    const files = await fs.readdir(DATA_DIR);
    return files
      .filter((f) => f.endsWith('.json') && /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .map((f) => f.replace('.json', ''))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

/**
 * React.cache()-wrapped data readers. Dedupes filesystem reads for the same
 * key within a single render pass (e.g. a page and a nested layout both
 * calling getLatestDigest()). Exported names/signatures are unchanged from
 * the pre-cache implementation.
 */
export const getAllDates = cache(readAllDates);

export const getDigestByDate = cache(readDigestFile);

export const getLatestDigest = cache(async (): Promise<DailyDigest | null> => {
  const dates = await getAllDates();
  if (dates.length === 0) return null;
  return getDigestByDate(dates[0]);
});

export const getPreviousDigest = cache(
  async (currentDate: string): Promise<DailyDigest | null> => {
    const dates = await getAllDates();
    const idx = dates.indexOf(currentDate);
    if (idx === -1 || idx >= dates.length - 1) return null;
    return getDigestByDate(dates[idx + 1]);
  },
);

export function formatDateKST(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
