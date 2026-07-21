import Link from 'next/link';
import { getAllDates } from '@/lib/data';
import EmptyState from '@/components/EmptyState';

export const dynamic = 'force-static';
export const revalidate = 3600;

interface MonthGroup {
  key: string;
  label: string;
  dates: string[];
}

/**
 * Groups YYYY-MM-DD date strings by month, newest month first. `dates` is
 * already sorted newest -> oldest by getAllDates(), so a single pass with a
 * Map (which preserves insertion order) is enough — no extra sort needed.
 */
function groupByMonth(dates: string[]): MonthGroup[] {
  const groups = new Map<string, string[]>();
  for (const date of dates) {
    const key = date.slice(0, 7); // YYYY-MM
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(date);
  }
  return [...groups.entries()].map(([key, groupDates]) => {
    const [year, month] = key.split('-');
    return { key, label: `${year}년 ${parseInt(month, 10)}월`, dates: groupDates };
  });
}

export default async function ArchivePage() {
  const dates = await getAllDates();
  const months = groupByMonth(dates);

  return (
    <div className="py-8">
      <div className="mb-8 pb-4 border-b border-bg-border">
        <span className="font-mono text-xs text-accent-gold uppercase tracking-widest">
          {dates.length} snapshots
        </span>
        <h1 className="text-3xl md:text-4xl font-bold mt-2">Archive</h1>
        <p className="text-fg-muted mt-1 text-sm">
          Daily snapshots. Each entry is a JSON + static page built at commit time.
        </p>
      </div>

      {dates.length === 0 ? (
        <EmptyState title="No snapshots yet." compact />
      ) : (
        <div className="space-y-8">
          {months.map((month) => (
            <section key={month.key}>
              <h2 className="font-mono text-sm text-accent-gold uppercase tracking-widest mb-3">
                {month.label}{' '}
                <span className="text-fg-dim normal-case">· {month.dates.length}개</span>
              </h2>
              <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {month.dates.map((date) => (
                  <li key={date}>
                    <Link
                      href={`/archive/${date}`}
                      className="block font-mono text-sm text-fg-muted hover:text-accent-teal bg-bg-panel border border-bg-border hover:border-accent-teal-dim p-3 rounded-sm transition-colors"
                    >
                      <span className="text-accent-teal mr-1">▸</span> {date}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
