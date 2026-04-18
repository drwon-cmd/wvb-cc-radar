import { getLatestDigest, formatDateKST } from '@/lib/data';
import { sortByTrendScore } from '@/lib/sort';
import HeroSection from '@/components/HeroSection';
import CategorySection from '@/components/CategorySection';

export const dynamic = 'force-static';
export const revalidate = 3600;

export default async function HomePage() {
  const digest = await getLatestDigest();

  if (!digest) {
    return (
      <div className="py-24 text-center">
        <div className="inline-block">
          <span className="font-mono text-xs text-accent-teal rec-dot">● AWAITING DATA</span>
          <h1 className="text-3xl font-bold mt-4 mb-2">No digest yet</h1>
          <p className="text-fg-muted text-sm">
            The first daily fetch will populate <code className="text-accent-teal">data/YYYY-MM-DD.json</code>.
          </p>
          <p className="text-fg-dim text-xs mt-2 font-mono">
            Run <code>python scripts/fetch.py</code> locally or wait for the GitHub Actions cron.
          </p>
        </div>
      </div>
    );
  }

  const primary = digest.categories.find((c) => c.category === 'claude-code');
  const secondary = digest.categories.filter((c) => c.category !== 'claude-code');

  return (
    <div>
      <div className="py-6 md:py-10 border-b border-bg-border mb-4">
        <div className="flex items-center gap-3 mb-3">
          <span className="w-2.5 h-2.5 rounded-full bg-accent-teal rec-dot shadow-teal-glow" />
          <span className="font-mono text-xs tracking-widest text-accent-teal uppercase">
            REC · {digest.date}
          </span>
          <span className="text-fg-dim text-xs font-mono">
            · {digest.meta.total_repos} repos · {digest.meta.total_new} new
          </span>
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-fg-primary mb-2">
          Daily Digest
        </h1>
        <p className="text-fg-muted text-sm md:text-base">
          Trending GitHub repositories for{' '}
          <span className="text-accent-teal">Claude Code ecosystem upgrade</span>.
          Curated by{' '}
          <a
            href="https://www.wiltvb.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-gold hover:underline"
          >
            Wilt Venture Builder
          </a>
          .
        </p>
        <p className="text-fg-dim text-xs font-mono mt-2">
          sorted by 24h trend score · generated {formatDateKST(digest.generated_at)} KST · fetch {digest.meta.fetch_duration_ms}ms
        </p>
      </div>

      {primary && <HeroSection data={sortByTrendScore(primary)} />}

      {secondary.map((cat) => (
        <CategorySection key={cat.category} data={sortByTrendScore(cat)} />
      ))}
    </div>
  );
}
