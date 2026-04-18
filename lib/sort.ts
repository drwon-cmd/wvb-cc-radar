import type { CategoryResult, Repo } from './types';

/**
 * Composite trend score (Option C):
 * Score = delta_24h × 10 + cumulative_stars × 0.001
 *
 * Day 1: delta is undefined for all → score = stars × 0.001
 *        (effectively cumulative rank as fallback)
 * Day 2+: viral repos with high 24h delta surface above long-tail giants.
 *
 * Example: a repo with +200 stars/24h and 5,000 total → 200*10 + 5 = 2005
 *          a repo with +0 stars/24h and 350,000 total → 0 + 350 = 350
 *          The trending one wins.
 */
export function trendScore(r: Repo): number {
  const delta = r.stars_delta_24h ?? 0;
  return delta * 10 + r.stargazers_count * 0.001;
}

export function sortByTrendScore(cat: CategoryResult): CategoryResult {
  return {
    ...cat,
    items: [...cat.items].sort((a, b) => trendScore(b) - trendScore(a)),
  };
}

export function sortByCumulativeStars(cat: CategoryResult): CategoryResult {
  return {
    ...cat,
    items: [...cat.items].sort((a, b) => b.stargazers_count - a.stargazers_count),
  };
}
