import { getAllDates, getDigestByDate } from '@/lib/data';
import { filterActiveCategories } from '@/lib/categories';
import { computeWhatsNew, TOP_N } from '@/lib/diff';
import RepoCard from '@/components/RepoCard';
import EmptyState from '@/components/EmptyState';
import CompareForm from './CompareForm';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: { from?: string; to?: string };
}

/**
 * Nearest available snapshot date <= (dateStr - days). `allDates` is sorted
 * newest -> oldest, so the first entry <= the target is the closest earlier
 * (or exact) snapshot.
 */
function nearestDateBefore(dateStr: string, days: number, allDates: string[]): string {
  const target = new Date(`${dateStr}T00:00:00Z`);
  target.setUTCDate(target.getUTCDate() - days);
  const targetStr = target.toISOString().slice(0, 10);
  return allDates.find((d) => d <= targetStr) ?? allDates[allDates.length - 1];
}

export default async function ComparePage({ searchParams }: Props) {
  const allDates = await getAllDates(); // newest -> oldest

  if (allDates.length === 0) {
    return <EmptyState title="No data yet" />;
  }

  const latest = allDates[0];
  const to = searchParams.to && allDates.includes(searchParams.to) ? searchParams.to : latest;
  const defaultFrom = nearestDateBefore(to, 7, allDates);
  const from =
    searchParams.from && allDates.includes(searchParams.from) ? searchParams.from : defaultFrom;

  const [toDigestRaw, fromDigestRaw] = await Promise.all([
    getDigestByDate(to),
    getDigestByDate(from),
  ]);
  const toDigest = filterActiveCategories(toDigestRaw);
  const fromDigest = filterActiveCategories(fromDigestRaw);

  const entries =
    toDigest && fromDigest && from !== to ? computeWhatsNew(toDigest, fromDigest) : [];

  return (
    <div className="py-8">
      <div className="mb-8 pb-4 border-b border-bg-border">
        <span className="font-mono text-xs text-accent-gold uppercase tracking-widest">Compare</span>
        <h1 className="text-3xl md:text-4xl font-bold mt-2">두 시점 비교</h1>
        <p className="text-fg-muted mt-1 text-sm">
          두 스냅샷 사이의 신규 진입 · 순위 점프를 비교합니다.
        </p>
      </div>

      <CompareForm dates={allDates} from={from} to={to} />

      {!toDigest || !fromDigest ? (
        <EmptyState title="선택한 날짜의 데이터를 찾을 수 없습니다" compact />
      ) : from === to ? (
        <EmptyState title="다른 두 날짜를 선택해주세요" compact />
      ) : entries.length === 0 ? (
        <EmptyState title="두 시점 사이에 눈에 띄는 변화가 없습니다" compact />
      ) : (
        <section className="mt-8">
          <p className="text-fg-dim text-xs font-mono mb-4">
            {from} → {to} · {entries.length}건 변화 · 카테고리별 top {TOP_N} 기준
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {entries.map((entry) => (
              <RepoCard
                key={`${entry.category}-${entry.repo.full_name}`}
                repo={entry.repo}
                topLabel={
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] uppercase tracking-widest text-accent-gold truncate">
                      {entry.categoryTitle}
                    </span>
                    <span className="font-mono text-[11px] font-bold text-accent-gold bg-accent-gold-dim px-2 py-0.5 rounded-sm border border-accent-gold/40 flex-shrink-0">
                      {entry.change.type === 'new'
                        ? `NEW · #${entry.change.todayRank}`
                        : `#${entry.change.fromRank} → #${entry.change.toRank}`}
                    </span>
                  </div>
                }
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
