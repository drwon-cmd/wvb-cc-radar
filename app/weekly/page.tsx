import { getLatestDigest, formatDateKST } from '@/lib/data';
import {
  sortByWeeklyDelta,
  sortByCumulativeStars,
  sortByKoreanQuality,
} from '@/lib/sort';
import { isoWeek, dateRangeLabel } from '@/lib/utils';
import { splitPrimarySecondary } from '@/lib/categories';
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
  // Falls back to cumulative only when no baseline exists at all (first-ever
  // fetch). Once there's even a 1-day history, we rank by delta.
  const primarySort = hasWeekly ? sortByWeeklyDelta : sortByCumulativeStars;

  const { year, week } = isoWeek(digest.date);
  const range = dateRangeLabel(digest.date, windowDays);

  const { primary, secondary } = splitPrimarySecondary(digest);

  const navItems = [
    ...(hasWeekly ? [{ id: 'hot-this-week', label: '이번 주 화제' }] : []),
    ...(primary ? [{ id: primary.category, label: primary.title }] : []),
    ...secondary.map((c) => ({ id: c.category, label: c.title })),
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
          이번 주 Top
        </h1>
        <p className="text-fg-muted text-sm md:text-base">
          {hasWeekly ? (
            <>
              Highest{' '}
              <span className="text-accent-gold">weekly star delta</span> across each category,
              based on a {windowDays}-day baseline. The{' '}
              <a href="/" className="text-accent-teal hover:underline">daily</a> view ranks by
              24h trend, and{' '}
              <a href="/top" className="text-accent-teal hover:underline">all-time</a> ranks
              by cumulative stars.
            </>
          ) : (
            <>
              Weekly-delta ranking unlocks once a baseline accumulates. For now, see the{' '}
              <a href="/" className="text-accent-teal hover:underline">daily</a> or{' '}
              <a href="/top" className="text-accent-teal hover:underline">all-time</a> views.
            </>
          )}
        </p>
        <p className="text-fg-dim text-xs font-mono mt-2">
          sorted by {hasWeekly ? `${windowDays}d star delta` : 'cumulative stars'} · generated{' '}
          {formatDateKST(digest.generated_at)} KST
        </p>
      </div>

      <CategoryNav items={navItems} />

      {hasWeekly && (
        <HotThisWeekSection
          categories={primary ? [primary, ...secondary] : secondary}
          windowDays={windowDays}
        />
      )}

      {primary && <HeroSection data={primarySort(primary)} />}

      {secondary.map((cat) => {
        const sorted =
          cat.category === 'korean-opensource'
            ? sortByKoreanQuality(cat)
            : hasWeekly
              ? sortByWeeklyDelta(cat)
              : sortByCumulativeStars(cat);
        return <CategorySection key={cat.category} data={sorted} />;
      })}
    </div>
  );
}
