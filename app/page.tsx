import { getLatestDigest, getPreviousDigest, formatDateKST } from '@/lib/data';
import { sortByTrendScore, sortByKoreanQuality } from '@/lib/sort';
import { computeWhatsNew } from '@/lib/diff';
import { ACTIVE_CATEGORY_IDS } from '@/lib/categories';
import HeroSection from '@/components/HeroSection';
import CategorySection from '@/components/CategorySection';
import WhatsNewSection from '@/components/WhatsNewSection';

export const dynamic = 'force-static';
export const revalidate = 300;

export default async function HomePage() {
  const digest = await getLatestDigest();
  const previous = digest ? await getPreviousDigest(digest.date) : null;

  // Scrub categories that are no longer in the active config (e.g. removed
  // enterprise-ax lingering in historical data files) before running diff/UI.
  const filterActive = <T extends { categories: { category: string }[] }>(
    d: T | null,
  ): T | null =>
    d
      ? ({
          ...d,
          categories: d.categories.filter((c) =>
            ACTIVE_CATEGORY_IDS.has(c.category),
          ),
        } as T)
      : null;
  const activeToday = filterActive(digest);
  const activePrev = filterActive(previous);
  const whatsNew = activeToday ? computeWhatsNew(activeToday, activePrev) : [];

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

  // Filter out stale categories (e.g. enterprise-ax that was removed but still
  // lingers in historical data files until the next fetch cron runs).
  const activeCategories = digest.categories.filter((c) =>
    ACTIVE_CATEGORY_IDS.has(c.category),
  );
  const primary = activeCategories.find((c) => c.category === 'claude-code');
  const secondary = activeCategories.filter((c) => c.category !== 'claude-code');

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
          What&apos;s new today
        </h1>
        <p className="text-fg-muted text-sm md:text-base">
          Day-over-day changes in the{' '}
          <span className="text-accent-teal">Claude Code ecosystem</span>
          {' '}— new entries and rank jumps surface first. Curated by{' '}
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

      {previous && whatsNew.length > 0 && (
        <WhatsNewSection entries={whatsNew} previousDate={previous.date} />
      )}

      {primary && <HeroSection data={sortByTrendScore(primary)} />}

      {secondary.map((cat) => (
        <CategorySection
          key={cat.category}
          data={cat.category === 'korean-opensource' ? sortByKoreanQuality(cat) : sortByTrendScore(cat)}
        />
      ))}
    </div>
  );
}
