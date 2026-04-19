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

/**
 * Detect whether a string contains Hangul characters (U+AC00–U+D7AF).
 * Used to identify repos that are genuinely targeted at Korean users.
 */
export function hasKoreanDescription(desc: string | null | undefined): boolean {
  if (!desc) return false;
  return /[\uAC00-\uD7AF]/.test(desc);
}

/**
 * Korean Quality Score (KQS) — scoring tailored for the `korean-opensource`
 * category where raw star count understates domestic value (smaller market).
 *
 * KQS = stars × 1
 *     + forks × 3                  // real-usage weight
 *     + (hasKoreanDesc ? 30 : 0)   // Korean-text description = Korea-focused
 *     + (stars_delta_24h × 5)      // recent momentum
 *     + (is_new_this_week ? 15 : 0)
 *
 * Example: a repo with 19★ + Korean description + 2 forks
 *          = 19 + 6 + 30 = 55
 *          beats a repo with 44★ English-only + 1 fork = 47.
 */
export function koreanQualityScore(r: Repo): number {
  const stars = r.stargazers_count;
  const forks = r.forks_count ?? 0;
  const koreanDesc = hasKoreanDescription(r.description) ? 30 : 0;
  const delta = (r.stars_delta_24h ?? 0) * 5;
  const newBonus = r.is_new_this_week ? 15 : 0;
  return stars + forks * 3 + koreanDesc + delta + newBonus;
}

export function sortByKoreanQuality(cat: CategoryResult): CategoryResult {
  return {
    ...cat,
    items: [...cat.items].sort((a, b) => koreanQualityScore(b) - koreanQualityScore(a)),
  };
}
