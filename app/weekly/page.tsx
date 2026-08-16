import { getLatestDigest, formatDateKST } from '@/lib/data';
import { isoWeek, dateRangeLabel } from '@/lib/utils';
import { splitPrimarySecondary } from '@/lib/categories';
import {
  getStatsIndex,
  partitionSteady,
  sortBySurge7d,
  buildSignals,
  STEADY_WINDOW_DAYS,
  STEADY_TOP_N,
  STEADY_MIN_DAYS,
  BASELINE_DAYS,
} from '@/lib/steady';
import HeroSection from '@/components/HeroSection';
import CategoryNav from '@/components/CategoryNav';
import CategorySection from '@/components/CategorySection';
import HotThisWeekSection from '@/components/HotThisWeekSection';
import EmptyState from '@/components/EmptyState';

export const dynamic = 'force-static';
export const revalidate = 3600;

export default async function WeeklyPage() {
  const digest = await getLatestDigest();

  if (!digest) {
    return <EmptyState title="No data yet" />;
  }

  const windowDays = digest.meta.weekly_window_days ?? 0;
  const hasWeekly = windowDays > 0;

  const { year, week } = isoWeek(digest.date);
  const range = dateRangeLabel(digest.date, windowDays);

  const { primary, secondary } = splitPrimarySecondary(digest);

  // Same split as the daily page, on a weekly scale: perennial leaders go to
  // /steady, and the rest are ranked by this week's gain against each repo's
  // own trailing 4-week average.
  const stats = await getStatsIndex();
  const risingPrimary = primary ? partitionSteady(primary, stats).rising : undefined;
  const risingSecondary = secondary.map((cat) => partitionSteady(cat, stats).rising);

  const sortedPrimary = risingPrimary ? sortBySurge7d(risingPrimary, stats) : undefined;
  const sortedSecondary = risingSecondary.map((cat) => sortBySurge7d(cat, stats));

  const steadyCount =
    (primary ? primary.items.length - (risingPrimary?.items.length ?? 0) : 0) +
    secondary.reduce(
      (sum, cat, i) => sum + (cat.items.length - risingSecondary[i].items.length),
      0,
    );

  const allRising = [...(sortedPrimary ? [sortedPrimary] : []), ...sortedSecondary];
  const signals = buildSignals(allRising, stats, 'weekly');

  const emptyHint = `상위 ${STEADY_TOP_N}위를 ${STEADY_WINDOW_DAYS}일 중 ${STEADY_MIN_DAYS}일 이상 지킨 레포는 스테디셀러로 분류돼 이 목록에서 빠집니다.`;

  const navItems = [
    ...(hasWeekly ? [{ id: 'hot-this-week', label: '이번 주 새로 뜬 레포' }] : []),
    ...(sortedPrimary ? [{ id: sortedPrimary.category, label: sortedPrimary.title }] : []),
    ...sortedSecondary.map((c) => ({ id: c.category, label: c.title })),
  ];

  return (
    <div>
      <div className="py-6 md:py-10 border-b border-bg-border mb-4">
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <span className="font-mono text-xs tracking-widest text-accent-gold uppercase">
            ▲ THIS WEEK · {year} W{String(week).padStart(2, '0')}
          </span>
          {range && (
            <span className="font-mono text-xs tracking-wider text-accent-teal">
              {range} KST
            </span>
          )}
          <span className="text-fg-dim text-xs font-mono">
            · {digest.meta.total_repos} repos
          </span>
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-fg-primary mb-2">
          이번 주 신규 인기
        </h1>
        <p className="text-fg-muted text-sm md:text-base">
          {hasWeekly ? (
            <>
              한 주 누적 성장을 각 레포의{' '}
              <span className="text-accent-gold">자체 {BASELINE_DAYS}일 평균 대비</span>로
              환산해 정렬합니다. 오래 상위권을 지킨 레포는{' '}
              <a href="/steady" className="text-accent-teal hover:underline">
                스테디셀러
              </a>
              로 빠지고, 하루 단위 급등은{' '}
              <a href="/" className="text-accent-teal hover:underline">
                일간
              </a>
              에서 봅니다.
            </>
          ) : (
            <>
              주간 기준선이 아직 쌓이지 않았습니다. 지금은{' '}
              <a href="/" className="text-accent-teal hover:underline">일간</a> 또는{' '}
              <a href="/top" className="text-accent-teal hover:underline">전체 누적</a>{' '}
              뷰를 참고하십시오.
            </>
          )}
        </p>
        <p className="text-fg-dim text-xs font-mono mt-2">
          sorted by {windowDays}d surge vs own {BASELINE_DAYS}d baseline · generated{' '}
          {formatDateKST(digest.generated_at)} KST
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

      <HotThisWeekSection
        categories={allRising}
        signals={signals}
        windowDays={windowDays}
      />

      {sortedPrimary && (
        <HeroSection
          data={sortedPrimary}
          signals={signals}
          emptyHint={emptyHint}
          eyebrow="RISING"
        />
      )}

      {sortedSecondary.map((cat) => (
        <CategorySection
          key={cat.category}
          data={cat}
          signals={signals}
          emptyHint={emptyHint}
        />
      ))}
    </div>
  );
}
