import { getLatestDigest, getPreviousDigest, formatDateKST } from '@/lib/data';
import { sortByTrendScore, sortByKoreanQuality } from '@/lib/sort';
import { computeWhatsNew } from '@/lib/diff';
import { filterActiveCategories, splitPrimarySecondary } from '@/lib/categories';
import { getStarHistoryForDigest } from '@/lib/history';
import HeroSection from '@/components/HeroSection';
import CategoryNav from '@/components/CategoryNav';
import FilterableDigest from '@/components/FilterableDigest';
import WhatsNewSection from '@/components/WhatsNewSection';
import EmptyState from '@/components/EmptyState';

export const dynamic = 'force-static';
export const revalidate = 3600;

export default async function HomePage() {
  const digest = await getLatestDigest();
  const previous = digest ? await getPreviousDigest(digest.date) : null;

  // Scrub categories that are no longer in the active config (e.g. removed
  // enterprise-ax lingering in historical data files) before running diff/UI.
  const activeToday = filterActiveCategories(digest);
  const activePrev = filterActiveCategories(previous);
  const whatsNew = activeToday ? computeWhatsNew(activeToday, activePrev) : [];

  if (!digest || !activeToday) {
    return (
      <EmptyState title="No digest yet">
        <p className="text-fg-muted text-sm">
          The first daily fetch will populate <code className="text-accent-teal">data/YYYY-MM-DD.json</code>.
        </p>
        <p className="text-fg-dim text-xs mt-2 font-mono">
          Run <code>python scripts/fetch.py</code> locally or wait for the GitHub Actions cron.
        </p>
      </EmptyState>
    );
  }

  const { primary, secondary } = splitPrimarySecondary(activeToday);
  const sortedSecondary = secondary.map((cat) =>
    cat.category === 'korean-opensource' ? sortByKoreanQuality(cat) : sortByTrendScore(cat),
  );

  // Sparklines are capped to the top-3 repos per category (14d window) — never
  // fetched for every repo on the page.
  const sparklines = await getStarHistoryForDigest(digest, { limitPerCategory: 3 });

  const navItems = [
    ...(whatsNew.length > 0 ? [{ id: 'whats-new', label: '오늘의 변화' }] : []),
    ...(primary ? [{ id: primary.category, label: primary.title }] : []),
    ...sortedSecondary.map((c) => ({ id: c.category, label: c.title })),
  ];

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
          {' '}·{' '}
          <a href="/weekly" className="text-accent-gold hover:underline">
            이번 주 화제 보기 →
          </a>
        </p>
      </div>

      <CategoryNav items={navItems} />

      {previous && whatsNew.length > 0 && (
        <WhatsNewSection entries={whatsNew} previousDate={previous.date} />
      )}

      {primary && <HeroSection data={sortByTrendScore(primary)} sparklines={sparklines} />}

      <FilterableDigest categories={sortedSecondary} sparklines={sparklines} />
    </div>
  );
}
