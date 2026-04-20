import { getLatestDigest, formatDateKST } from '@/lib/data';
import {
  sortByWeeklyDelta,
  sortByCumulativeStars,
  sortByKoreanQuality,
} from '@/lib/sort';
import { isoWeek, dateRangeLabel } from '@/lib/utils';
import HeroSection from '@/components/HeroSection';
import CategorySection from '@/components/CategorySection';
import HotThisWeekSection from '@/components/HotThisWeekSection';

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

  const windowDays = digest.meta.weekly_window_days ?? 0;
  const hasWeekly = windowDays > 0;
  // With a real baseline: weekly-delta primary. Without it (first-ever run):
  // fall back to cumulative so the page still shows a stable ranking.
  const primarySort = hasWeekly ? sortByWeeklyDelta : sortByCumulativeStars;

  const { year, week } = isoWeek(digest.date);
  const range = dateRangeLabel(digest.date, windowDays);

  const primary = digest.categories.find((c) => c.category === 'claude-code');
  const secondary = digest.categories.filter((c) => c.category !== 'claude-code');

  return (
    <div>
      <div className="py-6 md:py-10 border-b border-bg-border mb-4">
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <span className="font-mono text-xs tracking-widest text-accent-gold uppercase">
            {hasWeekly ? '▲ THIS WEEK' : '★ ALL-TIME'} · {year} W{String(week).padStart(2, '0')}
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
          {hasWeekly ? '이번 주 Top' : 'All-time Top'}
        </h1>
        <p className="text-fg-muted text-sm md:text-base">
          {hasWeekly ? (
            <>
              Highest{' '}
              <span className="text-accent-gold">weekly star delta</span> across each category,
              based on a {windowDays}-day baseline. The{' '}
              <a href="/" className="text-accent-teal hover:underline">home</a> page ranks by
              24h trend; this view captures{' '}
              <span className="text-accent-teal">sustained weekly momentum</span>.
            </>
          ) : (
            <>
              Highest cumulative stars across each category (filtered to repos with activity
              in the last 14 days). Weekly-delta ranking unlocks once a 7-day baseline
              accumulates.
            </>
          )}
        </p>
        <p className="text-fg-dim text-xs font-mono mt-2">
          sorted by {hasWeekly ? `${windowDays}d star delta` : 'cumulative stars'} · generated{' '}
          {formatDateKST(digest.generated_at)} KST
        </p>
      </div>

      {hasWeekly && (
        <HotThisWeekSection categories={digest.categories} windowDays={windowDays} />
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
