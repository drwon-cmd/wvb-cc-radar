import { getLatestDigest, getPreviousDigest, formatDateKST } from '@/lib/data';
import { computeWhatsNew } from '@/lib/diff';
import { filterActiveCategories, splitPrimarySecondary } from '@/lib/categories';
import { getStarHistoryForDigest } from '@/lib/history';
import {
  getStatsIndex,
  partitionSteady,
  sortBySurge24h,
  buildSignals,
  STEADY_WINDOW_DAYS,
  STEADY_TOP_N,
  STEADY_MIN_DAYS,
  BASELINE_DAYS,
} from '@/lib/steady';
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

  // Perennial leaders move to /steady. What's left is ranked by how hard each
  // repo is accelerating against its OWN 28-day baseline, so a 2k-star repo
  // that doubled outranks a 200k-star repo posting its usual daily gain.
  const stats = await getStatsIndex();
  const risingPrimary = primary ? partitionSteady(primary, stats).rising : undefined;
  const risingSecondary = secondary.map((cat) => partitionSteady(cat, stats).rising);

  const sortedPrimary = risingPrimary
    ? sortBySurge24h(risingPrimary, stats)
    : undefined;
  const sortedSecondary = risingSecondary.map((cat) => sortBySurge24h(cat, stats));

  const steadyCount =
    (primary ? primary.items.length - (risingPrimary?.items.length ?? 0) : 0) +
    secondary.reduce(
      (sum, cat, i) => sum + (cat.items.length - risingSecondary[i].items.length),
      0,
    );

  const signals = buildSignals(
    [...(sortedPrimary ? [sortedPrimary] : []), ...sortedSecondary],
    stats,
    'daily',
  );

  // Sparklines are capped to the top-3 repos per category (14d window) — never
  // fetched for every repo on the page.
  const sparklines = await getStarHistoryForDigest(digest, { limitPerCategory: 3 });

  const emptyHint = `상위 ${STEADY_TOP_N}위를 ${STEADY_WINDOW_DAYS}일 중 ${STEADY_MIN_DAYS}일 이상 지킨 레포는 스테디셀러로 분류돼 이 목록에서 빠집니다.`;

  const navItems = [
    ...(whatsNew.length > 0 ? [{ id: 'whats-new', label: '오늘의 변화' }] : []),
    ...(sortedPrimary ? [{ id: sortedPrimary.category, label: sortedPrimary.title }] : []),
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
          오늘 급상승
        </h1>
        <p className="text-fg-muted text-sm md:text-base">
          각 레포의{' '}
          <span className="text-accent-teal">자체 {BASELINE_DAYS}일 평균 대비 가속도</span>
          로 순위를 매깁니다 — 덩치가 아니라 &ldquo;평소보다 얼마나 빨라졌나&rdquo;가 기준입니다. Curated by{' '}
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
          sorted by 24h surge vs own {BASELINE_DAYS}d baseline · generated{' '}
          {formatDateKST(digest.generated_at)} KST · fetch {digest.meta.fetch_duration_ms}ms
          {' '}·{' '}
          <a href="/weekly" className="text-accent-gold hover:underline">
            이번 주 신규 인기 →
          </a>
        </p>
        {steadyCount > 0 && (
          <p className="text-fg-dim text-xs font-mono mt-1">
            스테디셀러 {steadyCount}개는 이 목록에서 제외됐습니다 ·{' '}
            <a href="/steady" className="text-accent-gold hover:underline">
              스테디셀러 보기 →
            </a>
          </p>
        )}
      </div>

      <CategoryNav items={navItems} />

      {previous && whatsNew.length > 0 && (
        <WhatsNewSection entries={whatsNew} previousDate={previous.date} />
      )}

      {sortedPrimary && (
        <HeroSection
          data={sortedPrimary}
          sparklines={sparklines}
          signals={signals}
          emptyHint={emptyHint}
          eyebrow="RISING"
        />
      )}

      <FilterableDigest
        categories={sortedSecondary}
        sparklines={sparklines}
        signals={signals}
        emptyHint={emptyHint}
      />
    </div>
  );
}
