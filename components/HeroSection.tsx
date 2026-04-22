import type { CategoryResult } from '@/lib/types';
import RepoCard from './RepoCard';

interface Props {
  data: CategoryResult;
}

export default function HeroSection({ data }: Props) {
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
                  PRIMARY · {data.total_count} repos
                </span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-fg-primary">
                {data.title}
              </h2>
              <p className="text-fg-muted mt-1 text-sm font-mono">{data.subtitle}</p>
            </div>
          </div>

          {featured.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {featured.map((repo, i) => (
                <RepoCard key={repo.id} repo={repo} rank={i + 1} featured />
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {rest.map((repo, i) => (
              <RepoCard key={repo.id} repo={repo} rank={i + 2} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
