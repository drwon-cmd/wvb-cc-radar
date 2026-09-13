import fs from 'node:fs/promises';
import path from 'node:path';
import type { DailyDigest } from './types';

export function isDigestDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Lightweight envelope check; historical snapshots may omit newer Repo fields. */
export function isValidDigest(value: unknown): value is DailyDigest {
  if (!value || typeof value !== 'object') return false;
  const digest = value as Record<string, unknown>;
  return typeof digest.date === 'string' && isDigestDate(digest.date)
    && Array.isArray(digest.categories) && digest.categories.every(category => {
      if (!category || typeof category !== 'object') return false;
      const entry = category as Record<string, unknown>;
      return typeof entry.category === 'string' && Array.isArray(entry.items);
    });
}

/** File access is independent of React caching so failures can be tested in isolation. */
export function createDigestStore(directory: string) {
  async function readAllDates(): Promise<string[]> {
    try {
      const files = await fs.readdir(directory, { withFileTypes: true });
      return files.filter(file => file.isFile() && file.name.endsWith('.json'))
        .map(file => file.name.slice(0, -5)).filter(isDigestDate).sort().reverse();
    } catch {
      return [];
    }
  }

  async function readDigestFile(date: string): Promise<DailyDigest | null> {
    if (!isDigestDate(date)) return null;
    const filePath = path.join(directory, `${date}.json`);
    try {
      const parsed: unknown = JSON.parse(await fs.readFile(filePath, 'utf8'));
      if (!isValidDigest(parsed) || parsed.date !== date) {
        console.error(`[lib/data] invalid digest in ${filePath} - skipping`);
        return null;
      }
      return parsed;
    } catch (error) {
      console.error(`[lib/data] failed to read/parse ${filePath}:`, error);
      return null;
    }
  }

  return { readAllDates, readDigestFile };
}

export async function firstReadableDigest(
  dates: readonly string[],
  read: (date: string) => Promise<DailyDigest | null>,
): Promise<DailyDigest | null> {
  for (const date of dates) {
    const digest = await read(date);
    if (digest) return digest;
  }
  return null;
}
