import { cache } from 'react';
import { getAllDates, getDigestByDate } from './data';
import type { CategoryId, CategoryResult, Repo } from './types';

/**
 * Steady-seller classification + self-baseline surge scoring.
 *
 * WHY THIS EXISTS
 * ---------------
 * Both the daily and weekly rankings used to sort by *absolute* star delta
 * (`delta_24h × 10 + stars × 0.001` and `delta_7d + stars × 0.0005`). Absolute
 * delta correlates with repo size: a 220k-star project gaining a routine
 * +600/day outranks a 3k-star project that tripled overnight. Measured on
 * 2026-08-16 over the prior 30 days of data/, `mattpocock/skills` held a
 * claude-code top-5 slot on 30 of 30 days on BOTH pages, and daily-top3 vs
 * weekly-top3 overlap was >= 2/3 in all 10 categories (3/3 in two of them).
 *
 * The fix has three parts:
 *   1. Split perennial leaders onto their own surface (/steady) so they stop
 *      occupying the momentum pages.                          <- this file
 *   2. Rank the remainder by growth relative to each repo's OWN recent
 *      baseline, so size stops being an advantage.            <- this file
 *   3. Widen the fetch candidate pool so young repos can enter at all.
 *      Ranking cannot surface a repo that was never collected.
 *                                                <- scripts/fetch.py risers
 */

/** Lookback window for the steady-seller classification. */
export const STEADY_WINDOW_DAYS = 60;

/**
 * A repo "held the top" on a day if it ranked this high WITHIN ITS CATEGORY.
 *
 * This is deliberately 5, not 10. Categories carry `top_n` of 10–15 (see
 * lib/categories.ts), so a top-10 test is nearly degenerate — it classifies
 * "appeared in the file at all" as steady. Measured on 2026-08-16:
 *   per-category top-10 -> 81/113 steady (72%), claude-code left with 6
 *   per-category top-5  -> 41/113 steady (36%), claude-code left with 10
 * Top-5 is also the honest reading of "perennially popular".
 */
export const STEADY_TOP_N = 5;

/** Days-in-top-N within the window required to be classed steady. */
export const STEADY_MIN_DAYS = 40;

/** Trailing window used as each repo's own growth baseline. */
export const BASELINE_DAYS = 28;

/** First seen this recently => still a newcomer to the tracked pool. */
export const RISER_MAX_AGE_DAYS = 21;

/**
 * Shrinkage constant for the surge ratio. Without it a repo going from 0 to 4
 * stars/day would post an infinite surge and outrank everything. With k=25 a
 * repo needs real volume: +4/day against a 0 baseline scores 1.16, while
 * +800/day against a 100/day baseline scores 6.6.
 */
export const SURGE_SHRINK_K = 25;

export interface RepoStats {
  /** Days within the window this repo appeared in the data at all. */
  presentDays: number;
  /** Oldest date in the window on which this repo appears. */
  firstSeen: string | null;
  /** Days since firstSeen, capped by the window. */
  ageDays: number;
  /** Mean stars/day over the prior BASELINE_DAYS, excluding the last day. */
  baselineDailyRate: number | null;
  /** Mean stars/week over the prior BASELINE_DAYS, excluding the last 7 days. */
  baselineWeeklyRate: number | null;
}

export interface StatsIndex {
  /** full_name -> repo-level history (category-independent). */
  repos: Map<string, RepoStats>;
  /**
   * `${category}|${full_name}` -> days held a top-STEADY_TOP_N slot.
   * Keyed per category because a repo can be a fixture in one bucket and a
   * newcomer in another — fetch.py does no cross-category dedup.
   */
  tenure: Map<string, number>;
  /** Number of daily snapshots actually available in the window. */
  windowLength: number;
}

const EMPTY_STATS: RepoStats = {
  presentDays: 0,
  firstSeen: null,
  ageDays: 0,
  baselineDailyRate: null,
  baselineWeeklyRate: null,
};

const tenureKey = (category: string, fullName: string) =>
  `${category}|${fullName}`;

/**
 * Single pass over the last STEADY_WINDOW_DAYS digests. Each file is read once
 * through the already-cached `getDigestByDate`, and the whole result is
 * React.cache()-wrapped so every page in a render shares one computation.
 */
async function computeStatsIndex(): Promise<StatsIndex> {
  const allDates = await getAllDates(); // newest -> oldest
  const chronological = [...allDates.slice(0, STEADY_WINDOW_DAYS)].reverse();

  /** full_name -> (date -> cumulative stars) */
  const starsByDate = new Map<string, Map<string, number>>();
  const tenure = new Map<string, number>();
  const presentDays = new Map<string, number>();
  const firstSeen = new Map<string, string>();

  let windowLength = 0;

  for (const date of chronological) {
    const digest = await getDigestByDate(date);
    if (!digest) continue; // gap day — skip rather than count it against a repo
    windowLength++;

    const seenToday = new Set<string>();

    for (const cat of digest.categories) {
      const ranked = [...cat.items].sort(
        (a, b) => b.stargazers_count - a.stargazers_count,
      );
      ranked.forEach((repo, i) => {
        const rank = i + 1;
        if (rank <= STEADY_TOP_N) {
          const key = tenureKey(cat.category, repo.full_name);
          tenure.set(key, (tenure.get(key) ?? 0) + 1);
        }

        seenToday.add(repo.full_name);

        let series = starsByDate.get(repo.full_name);
        if (!series) {
          series = new Map();
          starsByDate.set(repo.full_name, series);
        }
        // A repo can appear in several categories on one day; keep one value.
        if (!series.has(date)) series.set(date, repo.stargazers_count);
      });
    }

    for (const name of seenToday) {
      presentDays.set(name, (presentDays.get(name) ?? 0) + 1);
      if (!firstSeen.has(name)) firstSeen.set(name, date);
    }
  }

  // Offsets into `allDates` (index 0 = newest/today). The daily baseline ends
  // yesterday so today's spike doesn't contaminate the thing it's measured
  // against; the weekly baseline ends 7 days ago for the same reason.
  const dailyEnd = allDates[1];
  const dailyStart = allDates[1 + BASELINE_DAYS];
  const weeklyEnd = allDates[7];
  const weeklyStart = allDates[7 + BASELINE_DAYS];

  const repos = new Map<string, RepoStats>();
  for (const [name, series] of starsByDate) {
    const at = (d: string | undefined) => (d ? series.get(d) : undefined);

    const dEnd = at(dailyEnd);
    const dStart = at(dailyStart);
    const baselineDailyRate =
      dEnd !== undefined && dStart !== undefined
        ? Math.max(0, (dEnd - dStart) / BASELINE_DAYS)
        : null;

    const wEnd = at(weeklyEnd);
    const wStart = at(weeklyStart);
    const baselineWeeklyRate =
      wEnd !== undefined && wStart !== undefined
        ? Math.max(0, (wEnd - wStart) / (BASELINE_DAYS / 7))
        : null;

    const seen = firstSeen.get(name) ?? null;
    const ageDays = seen
      ? chronological.length - chronological.indexOf(seen)
      : 0;

    repos.set(name, {
      presentDays: presentDays.get(name) ?? 0,
      firstSeen: seen,
      ageDays,
      baselineDailyRate,
      baselineWeeklyRate,
    });
  }

  return { repos, tenure, windowLength };
}

export const getStatsIndex = cache(computeStatsIndex);

export function statsFor(index: StatsIndex, repo: Repo): RepoStats {
  return index.repos.get(repo.full_name) ?? EMPTY_STATS;
}

/**
 * PRECOMPUTED-FIRST
 * ----------------
 * scripts/fetch.py writes `steady_days` / `is_steady` / `surge_24h` /
 * `surge_7d` / `is_riser` into every repo of the daily digest, and the email
 * digest reads those same fields. Preferring them here is what keeps the site
 * and the email agreeing about what is "top" on a given day — the two used to
 * derive their own rankings and disagreed.
 *
 * The local computation below remains the fallback for the 121 historical
 * digests written before those fields existed (archive pages still render
 * them), so both paths must stay equivalent. Verified equal on 2026-08-16:
 * both classify 41 steady sellers on the same digest.
 */

/** Days this repo held a top-STEADY_TOP_N slot in the given category. */
export function tenureIn(
  index: StatsIndex,
  category: CategoryId | string,
  repo: Repo,
): number {
  if (typeof repo.steady_days === 'number') return repo.steady_days;
  return index.tenure.get(tenureKey(category, repo.full_name)) ?? 0;
}

/** Perennial leader: held a top-5 slot in this category on most days. */
export function isSteady(
  index: StatsIndex,
  category: CategoryId | string,
  repo: Repo,
): boolean {
  if (typeof repo.is_steady === 'boolean') return repo.is_steady;
  if (typeof repo.steady_days === 'number') {
    return repo.steady_days >= STEADY_MIN_DAYS;
  }
  return tenureIn(index, category, repo) >= STEADY_MIN_DAYS;
}

/** Newcomer to the tracked pool — entered within the last RISER_MAX_AGE_DAYS. */
export function isRiser(index: StatsIndex, repo: Repo): boolean {
  if (typeof repo.is_riser === 'boolean') return repo.is_riser;
  const s = statsFor(index, repo);
  return (
    s.firstSeen !== null &&
    s.ageDays <= RISER_MAX_AGE_DAYS &&
    // Age equal to the whole window means it was already there when we started
    // looking, so we can't tell that it's new.
    s.ageDays < index.windowLength
  );
}

/**
 * How hard is this repo growing *today* compared to its own recent normal?
 *
 *   surge = (delta_24h + k) / (baseline_daily_rate + k)
 *
 * 1.0 means "growing at its usual pace"; above is accelerating, below is
 * cooling off. Because both terms are the same repo's own numbers, a 250k-star
 * giant and a 2k-star newcomer are measured on the same scale.
 *
 * A repo with no baseline (brand new to the pool) is scored against zero,
 * which is the correct read: all of its growth is new.
 */
export function surge24h(repo: Repo, s: RepoStats): number {
  if (typeof repo.surge_24h === 'number') return repo.surge_24h;
  const delta = repo.stars_delta_24h ?? 0;
  const base = s.baselineDailyRate ?? 0;
  return (delta + SURGE_SHRINK_K) / (base + SURGE_SHRINK_K);
}

/** Weekly analogue of `surge24h`, on a 7-day scale. */
export function surge7d(repo: Repo, s: RepoStats): number {
  if (typeof repo.surge_7d === 'number') return repo.surge_7d;
  const delta = repo.stars_delta_7d ?? repo.stars_delta_24h ?? 0;
  const base = s.baselineWeeklyRate ?? 0;
  const k = SURGE_SHRINK_K * 7;
  return (delta + k) / (base + k);
}

export interface RepoSignal {
  /** Acceleration vs. this repo's own baseline (1.0 = business as usual). */
  surge: number;
  steady: boolean;
  riser: boolean;
  /** Days held a top-5 slot, in the category this signal was built for. */
  tenure: number;
  /** Stars/day (daily mode) or stars/week (weekly mode); null if unknown. */
  baselineRate: number | null;
}

/**
 * Flatten stats into a plain, serializable record keyed by full_name so it can
 * cross the server/client boundary into FilterableDigest (a 'use client' tree)
 * alongside the existing `sparklines` prop.
 *
 * Signals are per-category, so a repo appearing in two categories gets the
 * entry for whichever category is rendered first here. That only affects the
 * displayed tenure count, and callers pass a single page's categories.
 */
export function buildSignals(
  categories: CategoryResult[],
  index: StatsIndex,
  mode: 'daily' | 'weekly',
): Record<string, RepoSignal> {
  const out: Record<string, RepoSignal> = {};
  for (const cat of categories) {
    for (const repo of cat.items) {
      if (out[repo.full_name]) continue;
      const s = statsFor(index, repo);
      out[repo.full_name] = {
        surge: mode === 'daily' ? surge24h(repo, s) : surge7d(repo, s),
        steady: isSteady(index, cat.category, repo),
        riser: isRiser(index, repo),
        tenure: tenureIn(index, cat.category, repo),
        baselineRate:
          mode === 'daily' ? s.baselineDailyRate : s.baselineWeeklyRate,
      };
    }
  }
  return out;
}

/**
 * Split one category into its perennial leaders and everything else. Both
 * halves keep the CategoryResult shape so they drop straight into the existing
 * CategorySection/HeroSection components.
 */
export function partitionSteady(
  cat: CategoryResult,
  index: StatsIndex,
): { rising: CategoryResult; steady: CategoryResult } {
  const steadyItems: Repo[] = [];
  const risingItems: Repo[] = [];
  for (const repo of cat.items) {
    if (isSteady(index, cat.category, repo)) steadyItems.push(repo);
    else risingItems.push(repo);
  }
  return {
    rising: { ...cat, items: risingItems, total_count: risingItems.length },
    steady: { ...cat, items: steadyItems, total_count: steadyItems.length },
  };
}

/** Sort a category by today's acceleration against each repo's own baseline. */
export function sortBySurge24h(
  cat: CategoryResult,
  index: StatsIndex,
): CategoryResult {
  return {
    ...cat,
    items: [...cat.items].sort(
      (a, b) =>
        surge24h(b, statsFor(index, b)) - surge24h(a, statsFor(index, a)),
    ),
  };
}

/** Weekly analogue of `sortBySurge24h`. */
export function sortBySurge7d(
  cat: CategoryResult,
  index: StatsIndex,
): CategoryResult {
  return {
    ...cat,
    items: [...cat.items].sort(
      (a, b) => surge7d(b, statsFor(index, b)) - surge7d(a, statsFor(index, a)),
    ),
  };
}

/**
 * Steady-seller ordering: longest-held first, cumulative stars as tie-break.
 * Deliberately stable — churn is what the daily/weekly pages are for.
 */
export function sortBySteadyTenure(
  cat: CategoryResult,
  index: StatsIndex,
): CategoryResult {
  return {
    ...cat,
    items: [...cat.items].sort((a, b) => {
      const d =
        tenureIn(index, cat.category, b) - tenureIn(index, cat.category, a);
      return d !== 0 ? d : b.stargazers_count - a.stargazers_count;
    }),
  };
}
