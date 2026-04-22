import fs from 'node:fs/promises';
import path from 'node:path';
import type { DailyDigest } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');

export async function getLatestDigest(): Promise<DailyDigest | null> {
  try {
    const files = await fs.readdir(DATA_DIR);
    const jsonFiles = files
      .filter((f) => f.endsWith('.json') && /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .sort()
      .reverse();
    if (jsonFiles.length === 0) return null;
    return getDigestByDate(jsonFiles[0].replace('.json', ''));
  } catch {
    return null;
  }
}

export async function getDigestByDate(date: string): Promise<DailyDigest | null> {
  try {
    const filePath = path.join(DATA_DIR, `${date}.json`);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as DailyDigest;
  } catch {
    return null;
  }
}

export async function getPreviousDigest(currentDate: string): Promise<DailyDigest | null> {
  const dates = await getAllDates();
  const idx = dates.indexOf(currentDate);
  if (idx === -1 || idx >= dates.length - 1) return null;
  return getDigestByDate(dates[idx + 1]);
}

export async function getAllDates(): Promise<string[]> {
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
