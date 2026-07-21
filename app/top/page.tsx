import { getLatestDigest, formatDateKST } from '@/lib/data';
import { sortByCumulativeStars, sortByKoreanQuality } from '@/lib/sort';
import { splitPrimarySecondary } from '@/lib/categories';
import HeroSection from '@/components/HeroSection';
import CategoryNav from '@/components/CategoryNav';
import FilterableDigest from '@/components/FilterableDigest';
import EmptyState from '@/components/EmptyState';

export const dynamic = 'force-static';
export const revalidate = 3600;

export default async function TopPage() {
  const digest = await getLatestDigest();

  if (!digest) {
    return <EmptyState title="No data yet" />;
  }

  const { primary, secondary } = splitPrimarySecondary(digest);
  const sortedSecondary = secondary.map((cat) =>
    cat.category === 'korean-opensource' ? sortByKoreanQuality(cat) : sortByCumulativeStars(cat),
  );

  const navItems = [
    ...(primary ? [{ id: primary.category, label: primary.title }] : []),
    ...sortedSecondary.map((c) => ({ id: c.category, label: c.title })),
  ];

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

      <CategoryNav items={navItems} />

      {primary && <HeroSection data={sortByCumulativeStars(primary)} />}

      <FilterableDigest categories={sortedSecondary} />
    </div>
  );
}
