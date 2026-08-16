import type { CategoryResult } from '@/lib/types';
import type { StarHistoryPoint } from '@/lib/history';
import type { RepoSignal } from '@/lib/steady';
import RepoCard from './RepoCard';
import EmptyState from './EmptyState';

interface Props {
  data: CategoryResult;
  /** full_name -> star history, capped upstream (e.g. top-3/category). */
  sparklines?: Record<string, StarHistoryPoint[]>;
  /** How many leading cards receive a sparkline when `sparklines` is present. */
  sparklineLimit?: number;
  /** full_name -> steady/surge classification (lib/steady.ts). */
  signals?: Record<string, RepoSignal>;
  /** Shown in place of the grid when the category has no items left. */
  emptyHint?: string;
}

export default function CategorySection({
  data,
  sparklines,
  sparklineLimit = 3,
  signals,
  emptyHint,
}: Props) {
  return (
    <section id={data.category} className="mb-12">
      <div className="mb-4 pb-3 border-b border-bg-border">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-1 h-4 bg-accent-gold" />
          <span className="font-mono text-xs text-accent-gold uppercase tracking-widest">
            {data.total_count} repos
          </span>
        </div>
        <h2 className="text-xl md:text-2xl font-bold text-fg-primary">
          {data.title}
        </h2>
        <p className="text-fg-muted text-xs font-mono mt-0.5">{data.subtitle}</p>
      </div>

      {data.items.length === 0 ? (
        <EmptyState title="이번 구간에 새로 오른 레포가 없습니다" compact>
          {emptyHint && <p className="text-fg-dim text-xs font-mono">{emptyHint}</p>}
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data.items.map((repo, i) => (
            <RepoCard
              key={repo.id}
              repo={repo}
              rank={i + 1}
              series={sparklines && i < sparklineLimit ? sparklines[repo.full_name] : undefined}
              signal={signals?.[repo.full_name]}
            />
          ))}
        </div>
      )}
    </section>
  );
}
