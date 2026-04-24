import type { CategoryId, CategoryResult, DailyDigest, Repo } from './types';
import { sortByTrendScore, sortByKoreanQuality } from './sort';

export type WhatsNewChange =
  | { type: 'new'; todayRank: number }
  | { type: 'jumped'; fromRank: number; toRank: number };

export interface WhatsNewEntry {
  repo: Repo;
  category: CategoryId;
  categoryTitle: string;
  change: WhatsNewChange;
  /** Rank-gap magnitude used for sorting (new entries get a large pseudo-gap). */
  impact: number;
}

const NEW_IMPACT_BASE = 100;
const TOP_N = 10;
const COMPARE_N = 20;
/**
 * Star floor for What's New eligibility. Keeps niche-category NEW entries
 * (few dozen stars) from outranking genuine movement in the mainstream cats
 * (claude-code, ai-agents, rag-kb) where the min is already 20k+.
 */
const MIN_STARS = 1000;
/**
 * Categories excluded from cross-category What's New pool. korean-opensource
 * has its own popularity scale (median ~500 stars) and belongs on its own
 * page rather than competing with global trends.
 */
const EXCLUDED_CATEGORIES: CategoryId[] = ['korean-opensource'];

function rankMap(cat: CategoryResult): Map<string, number> {
  const sorted =
    cat.category === 'korean-opensource' ? sortByKoreanQuality(cat) : sortByTrendScore(cat);
  const m = new Map<string, number>();
  sorted.items.forEach((r, i) => m.set(r.full_name, i + 1));
  return m;
}

/**
 * Compute "What's new today" — entries that newly entered the top 10 of any
 * category, plus entries that jumped 3+ positions vs the previous digest.
 *
 * Returns a flat list across categories, sorted by impact (new entries first,
 * then biggest jumps). Caller decides the display limit.
 */
export function computeWhatsNew(
  today: DailyDigest,
  previous: DailyDigest | null,
): WhatsNewEntry[] {
  if (!previous) return [];

  const prevByCat = new Map<CategoryId, Map<string, number>>();
  for (const cat of previous.categories) {
    prevByCat.set(cat.category, rankMap(cat));
  }

  const out: WhatsNewEntry[] = [];

  for (const cat of today.categories) {
    if (EXCLUDED_CATEGORIES.includes(cat.category)) continue;
    const prevRanks = prevByCat.get(cat.category);
    if (!prevRanks) continue;

    const sortedToday = sortByTrendScore(cat);
    const top = sortedToday.items.slice(0, TOP_N);

    top.forEach((repo, i) => {
      const todayRank = i + 1;
      const prevRank = prevRanks.get(repo.full_name);

      // Star floor: skip repos below MIN_STARS regardless of category rank.
      if ((repo.stargazers_count ?? 0) < MIN_STARS) return;

      if (prevRank === undefined || prevRank > COMPARE_N) {
        out.push({
          repo,
          category: cat.category,
          categoryTitle: cat.title,
          change: { type: 'new', todayRank },
          impact: NEW_IMPACT_BASE + (TOP_N - todayRank),
        });
      } else if (prevRank - todayRank >= 3) {
        out.push({
          repo,
          category: cat.category,
          categoryTitle: cat.title,
          change: { type: 'jumped', fromRank: prevRank, toRank: todayRank },
          impact: prevRank - todayRank,
        });
      }
    });
  }

  out.sort((a, b) => b.impact - a.impact);
  return out;
}
