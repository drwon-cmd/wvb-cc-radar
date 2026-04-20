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
 *     + forks × 3                   // real-usage weight
 *     + (hasKoreanDesc ? 30 : 0)    // Korean-text description = Korea-focused
 *     + (korean_owner   ? 30 : 0)   // allowlisted Korean owner (data/korean-owners.json)
 *     + (stars_delta_24h × 5)       // recent momentum
 *     + (is_new_this_week ? 15 : 0)
 *
 * `korean_owner` carries the same weight as `hasKoreanDesc` so that
 * Korean-made repos with English-only descriptions (e.g. popup-studio-ai/
 * bkit-claude-code) can surface alongside explicitly Korean-marked ones.
 * Both bonuses stack when a repo has Korean text *and* an allowlisted owner.
 */
export function koreanQualityScore(r: Repo): number {
  const stars = r.stargazers_count;
  const forks = r.forks_count ?? 0;
  const koreanDesc = hasKoreanDescription(r.description) ? 30 : 0;
  const ownerBonus = r.korean_owner ? 30 : 0;
  const delta = (r.stars_delta_24h ?? 0) * 5;
  const newBonus = r.is_new_this_week ? 15 : 0;
  return stars + forks * 3 + koreanDesc + ownerBonus + delta + newBonus;
}

export function sortByKoreanQuality(cat: CategoryResult): CategoryResult {
  return {
    ...cat,
    items: [...cat.items].sort((a, b) => koreanQualityScore(b) - koreanQualityScore(a)),
  };
}

/**
 * Weekly delta score — mirrors bkamp.ai-style "가장 핫한 레포" ranking.
 *
 *   score = stars_delta_7d × 1 + stars × 0.0005
 *
 * Cumulative-star tie-breaker is tiny (0.0005) so a viral newcomer with +500
 * this week outranks a 100k-star giant that gained +2. Repos without a weekly
 * delta (no baseline in data/) fall back to cumulative rank.
 */
export function weeklyDeltaScore(r: Repo): number {
  const delta = r.stars_delta_7d ?? r.stars_delta_24h ?? 0;
  return delta + r.stargazers_count * 0.0005;
}

export function sortByWeeklyDelta(cat: CategoryResult): CategoryResult {
  return {
    ...cat,
    items: [...cat.items].sort((a, b) => weeklyDeltaScore(b) - weeklyDeltaScore(a)),
  };
}

/**
 * Weekly engagement score — what bkamp.ai calls "이번 주 진짜 화제였던" section.
 * Captures repos with real community traction, not just a star-bot spike.
 *
 *   score = stars_delta_7d + forks_delta_7d × 3 + (is_new_this_week ? 5 : 0)
 *
 * Forks weighted 3× because a fork is a stronger "I'm using this" signal than
 * a star. New-this-week bonus surfaces genuinely fresh momentum.
 */
export function weeklyEngagementScore(r: Repo): number {
  const s = r.stars_delta_7d ?? 0;
  const f = (r.forks_delta_7d ?? 0) * 3;
  const n = r.is_new_this_week ? 5 : 0;
  return s + f + n;
}

export function sortByWeeklyEngagement(cat: CategoryResult): CategoryResult {
  return {
    ...cat,
    items: [...cat.items].sort((a, b) => weeklyEngagementScore(b) - weeklyEngagementScore(a)),
  };
}
