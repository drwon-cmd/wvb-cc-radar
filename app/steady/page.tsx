import type { Metadata } from 'next';
import { getLatestDigest, formatDateKST } from '@/lib/data';
import { splitPrimarySecondary } from '@/lib/categories';
import {
  getStatsIndex,
  partitionSteady,
  sortBySteadyTenure,
  buildSignals,
  STEADY_WINDOW_DAYS,
  STEADY_TOP_N,
  STEADY_MIN_DAYS,
} from '@/lib/steady';
import HeroSection from '@/components/HeroSection';
import CategoryNav from '@/components/CategoryNav';
import CategorySection from '@/components/CategorySection';
import EmptyState from '@/components/EmptyState';

export const dynamic = 'force-static';
export const revalidate = 3600;

export const metadata: Metadata = {
  title: '스테디셀러 · WVB CC Radar',
  description: `최근 ${STEADY_WINDOW_DAYS}일 중 ${STEADY_MIN_DAYS}일 이상 카테고리 상위 ${STEADY_TOP_N}위를 지킨 Claude Code 생태계 레포 — 이미 자리를 잡은 것들.`,
};

export default async function SteadyPage() {
  const digest = await getLatestDigest();

  if (!digest) {
    return <EmptyState title="No data yet" />;
  }

  const { primary, secondary } = splitPrimarySecondary(digest);
  const stats = await getStatsIndex();

  const steadyPrimaryRaw = primary ? partitionSteady(primary, stats).steady : undefined;
  const steadySecondaryRaw = secondary.map((cat) => partitionSteady(cat, stats).steady);

  const steadyPrimary =
    steadyPrimaryRaw && steadyPrimaryRaw.items.length > 0
      ? sortBySteadyTenure(steadyPrimaryRaw, stats)
      : undefined;
  // Categories with no fixtures at all are dropped rather than rendered empty —
  // on this page an empty category means "nothing has held here", which is
  // information best conveyed by absence.
  const steadySecondary = steadySecondaryRaw
    .filter((cat) => cat.items.length > 0)
    .map((cat) => sortBySteadyTenure(cat, stats));

  const signals = buildSignals(
    [...(steadyPrimary ? [steadyPrimary] : []), ...steadySecondary],
    stats,
    'daily',
  );

  const total =
    (steadyPrimary?.items.length ?? 0) +
    steadySecondary.reduce((sum, c) => sum + c.items.length, 0);

  const navItems = [
    ...(steadyPrimary ? [{ id: steadyPrimary.category, label: steadyPrimary.title }] : []),
    ...steadySecondary.map((c) => ({ id: c.category, label: c.title })),
  ];

  return (
    <div>
      <div className="py-6 md:py-10 border-b border-bg-border mb-4">
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <span className="font-mono text-xs tracking-widest text-accent-gold uppercase">
            ◆ STEADY SELLERS · {digest.date}
          </span>
          <span className="text-fg-dim text-xs font-mono">· {total} repos</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-fg-primary mb-2">
          스테디셀러
        </h1>
        <p className="text-fg-muted text-sm md:text-base">
          최근 {STEADY_WINDOW_DAYS}일 중{' '}
          <span className="text-accent-gold">{STEADY_MIN_DAYS}일 이상</span> 카테고리 상위{' '}
          {STEADY_TOP_N}위를 지킨 레포입니다. 이미 자리를 잡아 순위 변동이 거의 없기 때문에,
          매일 바뀌는{' '}
          <a href="/" className="text-accent-teal hover:underline">일간</a>·
          <a href="/weekly" className="text-accent-teal hover:underline">주간</a>{' '}
          목록에서는 제외하고 여기에 모았습니다.
        </p>
        <p className="text-fg-dim text-xs font-mono mt-2">
          sorted by tenure (days held) · generated {formatDateKST(digest.generated_at)} KST
        </p>
      </div>

      <CategoryNav items={navItems} />

      {total === 0 ? (
        <EmptyState title="아직 스테디셀러가 없습니다">
          <p className="text-fg-muted text-sm">
            상위 {STEADY_TOP_N}위를 {STEADY_MIN_DAYS}일 이상 지킨 레포가 나오려면
            최소 {STEADY_MIN_DAYS}일치 스냅샷이 필요합니다.
          </p>
        </EmptyState>
      ) : (
        <>
          {steadyPrimary && (
            <HeroSection data={steadyPrimary} signals={signals} eyebrow="LONGEST HELD" />
          )}
          {steadySecondary.map((cat) => (
            <CategorySection key={cat.category} data={cat} signals={signals} />
          ))}
        </>
      )}
    </div>
  );
}
