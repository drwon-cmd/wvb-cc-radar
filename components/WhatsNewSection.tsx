import type { WhatsNewEntry } from '@/lib/diff';
import RepoCard from './RepoCard';
import Badge from './Badge';

interface Props {
  entries: WhatsNewEntry[];
  previousDate: string;
  limit?: number;
}

/**
 * "What's new today" — surfaces entries that newly entered the top 10 of any
 * category OR jumped 3+ positions vs the previous digest.
 *
 * Answers the complaint "top 2 repos never change" by making the actual
 * day-over-day delta the primary view.
 */
export default function WhatsNewSection({ entries, previousDate, limit = 8 }: Props) {
  if (entries.length === 0) return null;

  const shown = entries.slice(0, limit);
  const newCount = entries.filter((e) => e.change.type === 'new').length;
  const jumpCount = entries.filter((e) => e.change.type === 'jumped').length;

  return (
    <section id="whats-new" className="mb-12 pt-2">
      <div className="mb-4 pb-3 border-b border-bg-border">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-1 h-4 bg-accent-gold shadow-gold-glow" />
          <span className="font-mono text-xs text-accent-gold uppercase tracking-widest">
            ✨ WHAT&apos;S NEW · vs {previousDate}
          </span>
        </div>
        <h2 className="text-xl md:text-2xl font-bold text-fg-primary">
          어제 대비 변화
        </h2>
        <p className="text-fg-muted text-xs font-mono mt-0.5">
          {newCount > 0 && <span>{newCount} 신규 진입</span>}
          {newCount > 0 && jumpCount > 0 && <span> · </span>}
          {jumpCount > 0 && <span>{jumpCount} 순위 점프</span>}
          <span className="text-fg-dim"> · top 10 기준, 카테고리 교차</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {shown.map((entry) => (
          <div key={`${entry.category}-${entry.repo.full_name}`} className="relative">
            <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
              {entry.change.type === 'new' ? (
                <Badge variant="gold">
                  NEW · #{entry.change.todayRank} {entry.categoryTitle}
                </Badge>
              ) : (
                <Badge variant="gold">
                  #{entry.change.fromRank} → #{entry.change.toRank} {entry.categoryTitle}
                </Badge>
              )}
            </div>
            <RepoCard repo={entry.repo} />
          </div>
        ))}
      </div>
    </section>
  );
}
