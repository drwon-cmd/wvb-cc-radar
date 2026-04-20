import type { CategoryResult, Repo } from '@/lib/types';
import { weeklyEngagementScore } from '@/lib/sort';
import RepoCard from './RepoCard';

interface Props {
  categories: CategoryResult[];
  windowDays: number;
  limit?: number;
}

/**
 * "🔥 이번 주 화제" — cross-category momentum view.
 *
 * Mirrors bkamp.ai's "이번 주 진짜 화제였던 5개" section. Unlike the
 * per-category sort (pure star delta), this ranks by combined community
 * traction (stars + forks×3 + new-bonus) so fork-heavy mid-sized repos can
 * surface alongside viral giants.
 *
 * Renders nothing when the baseline window is 0 (first-ever fetch) or when
 * no repo gained any traction — avoids empty sections.
 */
export default function HotThisWeekSection({ categories, windowDays, limit = 10 }: Props) {
  if (!windowDays) return null;

  const seen = new Set<string>();
  const merged: Repo[] = [];
  for (const cat of categories) {
    for (const r of cat.items) {
      if (seen.has(r.full_name)) continue;
      seen.add(r.full_name);
      merged.push(r);
    }
  }
  const ranked = merged
    .filter((r) => (r.stars_delta_7d ?? 0) > 0 || (r.forks_delta_7d ?? 0) > 0)
    .sort((a, b) => weeklyEngagementScore(b) - weeklyEngagementScore(a))
    .slice(0, limit);

  if (ranked.length === 0) return null;

  return (
    <section id="hot-this-week" className="mb-12">
      <div className="mb-4 pb-3 border-b border-bg-border">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-1 h-4 bg-accent-gold shadow-gold-glow" />
          <span className="font-mono text-xs text-accent-gold uppercase tracking-widest">
            🔥 HOT THIS WEEK · top {ranked.length}
          </span>
        </div>
        <h2 className="text-xl md:text-2xl font-bold text-fg-primary">
          이번 주 화제
        </h2>
        <p className="text-fg-muted text-xs font-mono mt-0.5">
          Cross-category momentum ranked by stars + forks×3 over the last {windowDays}d baseline
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {ranked.map((repo, i) => (
          <RepoCard key={repo.id} repo={repo} rank={i + 1} />
        ))}
      </div>
    </section>
  );
}
