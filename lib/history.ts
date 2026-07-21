import { cache } from 'react';
import { getAllDates, getDigestByDate } from './data';
import type { DailyDigest } from './types';

export interface StarHistoryPoint {
  date: string;
  stars: number;
}

/**
 * Server-only helper for sparklines. Reads the last `days` daily digest
 * files (oldest -> newest) and extracts `stargazers_count` per requested
 * `full_name` per day. A repo missing from a given day's digest (fell out
 * of its category's top_n, or the file is invalid/missing) is simply
 * skipped for that day rather than padded with a zero/null point.
 *
 * Single pass over at most `days` files: each file is read once via the
 * already-cached `getDigestByDate`, and each file's categories/items are
 * iterated once.
 */
async function computeStarHistory(
  fullNames: string[],
  days = 14,
): Promise<Record<string, StarHistoryPoint[]>> {
  const wanted = new Set(fullNames);
  const result: Record<string, StarHistoryPoint[]> = {};
  for (const name of fullNames) result[name] = [];
  if (wanted.size === 0) return result;

  const allDates = await getAllDates(); // newest -> oldest
  const dates = allDates.slice(0, days).reverse(); // oldest -> newest for a chronological series

  for (const date of dates) {
    const digest = await getDigestByDate(date);
    if (!digest) continue; // gap day (missing/invalid file) — skip, don't pad

    for (const cat of digest.categories) {
      for (const repo of cat.items) {
        if (!wanted.has(repo.full_name)) continue;
        const series = result[repo.full_name];
        // A repo can appear in multiple categories on the same day; only
        // record the first sighting per day to keep the series one-point-per-day.
        if (series.length > 0 && series[series.length - 1].date === date) continue;
        series.push({ date, stars: repo.stargazers_count });
      }
    }
  }

  return result;
}

export const getStarHistory = cache(computeStarHistory);

/**
 * Convenience wrapper: build the star history for every repo currently
 * shown in a digest (optionally capped per category to avoid pulling
 * history for long tails that never render).
 */
export async function getStarHistoryForDigest(
  digest: DailyDigest,
  opts: { limitPerCategory?: number } = {},
): Promise<Record<string, StarHistoryPoint[]>> {
  const limit = opts.limitPerCategory ?? Infinity;
  const fullNames = new Set<string>();
  for (const cat of digest.categories) {
    cat.items.slice(0, limit).forEach((r) => fullNames.add(r.full_name));
  }
  return getStarHistory([...fullNames]);
}
