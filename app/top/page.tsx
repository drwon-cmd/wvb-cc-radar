import { getLatestDigest, formatDateKST } from '@/lib/data';
import { sortByCumulativeStars, sortByKoreanQuality } from '@/lib/sort';
import { ACTIVE_CATEGORY_IDS } from '@/lib/categories';
import HeroSection from '@/components/HeroSection';
import CategorySection from '@/components/CategorySection';

export const dynamic = 'force-static';
export const revalidate = 300;

export default async function TopPage() {
  const digest = await getLatestDigest();

  if (!digest) {
    return (
      <div className="py-24 text-center">
        <span className="font-mono text-xs text-accent-teal rec-dot">● AWAITING DATA</span>
        <h1 className="text-3xl font-bold mt-4 mb-2">No data yet</h1>
      </div>
    );
  }

  const activeCategories = digest.categories.filter((c) =>
    ACTIVE_CATEGORY_IDS.has(c.category),
  );
  const primary = activeCategories.find((c) => c.category === 'claude-code');
  const secondary = activeCategories.filter((c) => c.category !== 'claude-code');

  return (
    <div>
      <div className="py-6 md:py-10 border-b border-bg-border mb-4">
        <div className="flex items-center gap-3 mb-3">
          <span className="font-mono text-xs tracking-widest text-accent-gold uppercase">
            ★ ALL-TIME · {digest.date}
          </span>
          <span className="text-fg-dim text-xs font-mono">
            · {digest.meta.total_repos} repos
          </span>
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-fg-primary mb-2">
          All-time Top
        </h1>
        <p className="text-fg-muted text-sm md:text-base">
          Highest cumulative stars across each category (filtered to repos with activity in the last 14 days).
          For weekly momentum see{' '}
          <a href="/weekly" className="text-accent-gold hover:underline">weekly</a>; for 24h trend see the{' '}
          <a href="/" className="text-accent-teal hover:underline">daily</a> view.
        </p>
        <p className="text-fg-dim text-xs font-mono mt-2">
          sorted by cumulative stars · generated {formatDateKST(digest.generated_at)} KST
        </p>
      </div>

      {primary && <HeroSection data={sortByCumulativeStars(primary)} />}

      {secondary.map((cat) => (
        <CategorySection
          key={cat.category}
          data={cat.category === 'korean-opensource' ? sortByKoreanQuality(cat) : sortByCumulativeStars(cat)}
        />
      ))}
    </div>
  );
}
