import Link from 'next/link';
import { getAllDates } from '@/lib/data';

export const dynamic = 'force-static';
export const revalidate = 3600;

export default async function ArchivePage() {
  const dates = await getAllDates();

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
        <p className="text-fg-dim">No snapshots yet.</p>
      ) : (
        <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {dates.map((date) => (
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
      )}
    </div>
  );
}
