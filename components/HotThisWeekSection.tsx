import type { CategoryResult, Repo } from '@/lib/types';
import type { RepoSignal } from '@/lib/steady';
import { formatSurge } from '@/lib/utils';
import RepoCard from './RepoCard';

interface Props {
  /** Already steady-filtered categories (see lib/steady.ts partitionSteady). */
  categories: CategoryResult[];
  signals: Record<string, RepoSignal>;
  windowDays: number;
  limit?: number;
  /** Minimum surge to qualify. 1.0 = growing at its own usual pace. */
  minSurge?: number;
}

/**
 * "이번 주 신규 인기" — cross-category momentum headline.
 *
 * Previously this ranked by absolute community traction
 * (stars + forks×3 + new-bonus), which had the same size bias as the old
 * per-category sort: big repos posted big absolute numbers every week and
 * never moved off the list. It now ranks by weekly surge — this week's gain
 * measured against each repo's OWN trailing 4-week average — over the
 * steady-filtered pool, so it answers "what got popular *this week*" rather
 * than "what is biggest".
 *
 * Renders nothing when the baseline window is 0 (first-ever fetch) or when no
 * repo cleared `minSurge` — an empty headline is worse than no headline.
 */
export default function HotThisWeekSection({
  categories,
  signals,
  windowDays,
  limit = 10,
  minSurge = 1.15,
}: Props) {
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
    .filter((r) => (signals[r.full_name]?.surge ?? 0) >= minSurge)
    .sort(
      (a, b) => (signals[b.full_name]?.surge ?? 0) - (signals[a.full_name]?.surge ?? 0),
    )
    .slice(0, limit);

  if (ranked.length === 0) return null;

  const top = signals[ranked[0].full_name]?.surge;

  return (
    <section id="hot-this-week" className="mb-12">
      <div className="mb-4 pb-3 border-b border-bg-border">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-1 h-4 bg-accent-gold shadow-gold-glow" />
          <span className="font-mono text-xs text-accent-gold uppercase tracking-widest">
            🔥 NEW THIS WEEK · top {ranked.length}
            {top !== undefined && ` · peak ${formatSurge(top)}`}
          </span>
        </div>
        <h2 className="text-xl md:text-2xl font-bold text-fg-primary">
          이번 주 새로 뜬 레포
        </h2>
        <p className="text-fg-muted text-xs font-mono mt-0.5">
          카테고리 통합 · 최근 {windowDays}일 성장을 각 레포 자체 평균과 비교해 정렬 · 스테디셀러 제외
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {ranked.map((repo, i) => (
          <RepoCard
            key={repo.id}
            repo={repo}
            rank={i + 1}
            signal={signals[repo.full_name]}
          />
        ))}
      </div>
    </section>
  );
}
