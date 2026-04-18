import type { CategoryResult } from '@/lib/types';
import RepoCard from './RepoCard';

interface Props {
  data: CategoryResult;
}

export default function CategorySection({ data }: Props) {
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {data.items.map((repo, i) => (
          <RepoCard key={repo.id} repo={repo} rank={i + 1} />
        ))}
      </div>
    </section>
  );
}
