import type { CategoryResult } from '@/lib/types';
import type { StarHistoryPoint } from '@/lib/history';
import type { RepoSignal } from '@/lib/steady';
import RepoCard from './RepoCard';
import EmptyState from './EmptyState';

interface Props {
  data: CategoryResult;
  /** full_name -> star history, capped upstream (e.g. top-3/category). */
  sparklines?: Record<string, StarHistoryPoint[]>;
  /** full_name -> steady/surge classification (lib/steady.ts). */
  signals?: Record<string, RepoSignal>;
  /** Shown in place of the grid when the category has no items left. */
  emptyHint?: string;
  /** Overrides the "PRIMARY" eyebrow label. */
  eyebrow?: string;
}

export default function HeroSection({
  data,
  sparklines,
  signals,
  emptyHint,
  eyebrow = 'PRIMARY',
}: Props) {
  // Only the #1 repo gets the OG preview image. Two images on the primary
  // hero made the "top never changes" feedback worse — the second slot
  // was almost always a long-tail giant that rarely moves. Keeping one
  // image frees the visual focus for the What's new section below.
  const featured = data.items.slice(0, 1);
  const rest = data.items.slice(1);

  return (
    <section id={data.category} className="relative mb-16 pt-8">
      <div className="glow-teal relative">
        <div className="relative z-10">
          <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-1 h-5 bg-accent-teal shadow-teal-glow" />
                <span className="font-mono text-xs text-accent-teal uppercase tracking-widest">
                  {eyebrow} · {data.total_count} repos
                </span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-fg-primary">
                {data.title}
              </h2>
              <p className="text-fg-muted mt-1 text-sm font-mono">{data.subtitle}</p>
            </div>
          </div>

          {data.items.length === 0 && (
            <EmptyState title="이번 구간에 새로 오른 레포가 없습니다" compact>
              {emptyHint && (
                <p className="text-fg-dim text-xs font-mono">{emptyHint}</p>
              )}
            </EmptyState>
          )}

          {featured.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {featured.map((repo, i) => (
                <RepoCard
                  key={repo.id}
                  repo={repo}
                  rank={i + 1}
                  featured
                  series={sparklines?.[repo.full_name]}
                  signal={signals?.[repo.full_name]}
                />
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {rest.map((repo, i) => (
              <RepoCard
                key={repo.id}
                repo={repo}
                rank={i + 2}
                series={i < 2 ? sparklines?.[repo.full_name] : undefined}
                signal={signals?.[repo.full_name]}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
