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
    const prevRanks = prevByCat.get(cat.category);
    if (!prevRanks) continue;

    const sortedToday =
      cat.category === 'korean-opensource' ? sortByKoreanQuality(cat) : sortByTrendScore(cat);
    const top = sortedToday.items.slice(0, TOP_N);

    top.forEach((repo, i) => {
      const todayRank = i + 1;
      const prevRank = prevRanks.get(repo.full_name);

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
