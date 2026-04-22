import type { WhatsNewEntry } from '@/lib/diff';
import { cn } from '@/lib/utils';
import RepoCard from './RepoCard';

interface Props {
  entries: WhatsNewEntry[];
  previousDate: string;
  limit?: number;
}

/**
 * Category + rank-delta strip rendered inside the card body (not as an image
 * overlay). The previous top-right overlay was invisible on the featured
 * hero because bg-accent-gold/10 washed out against bright OG preview images.
 */
function OriginStrip({ entry }: { entry: WhatsNewEntry }) {
  const { change, categoryTitle } = entry;
  const deltaText =
    change.type === 'new'
      ? `NEW · #${change.todayRank}`
      : `#${change.fromRank} → #${change.toRank}`;
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="font-mono text-[11px] uppercase tracking-widest text-accent-gold truncate">
        {categoryTitle}
      </span>
      <span className="font-mono text-[11px] font-bold text-accent-gold bg-accent-gold-dim px-2 py-0.5 rounded-sm border border-accent-gold/40 flex-shrink-0">
        {deltaText}
      </span>
    </div>
  );
}

/**
 * "What's new today" — surfaces entries that newly entered the top 10 of any
 * category OR jumped 3+ positions vs the previous digest.
 *
 * The top-impact entry is rendered as a featured card (full-width OG image)
 * so the visual hero reflects today's biggest movement rather than yesterday's
 * static ranking.
 */
export default function WhatsNewSection({ entries, previousDate, limit = 8 }: Props) {
  if (entries.length === 0) return null;

  const shown = entries.slice(0, limit);
  const [hero, ...others] = shown;
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
        {hero && (
          <div className={cn('md:col-span-2')}>
            <RepoCard repo={hero.repo} featured topLabel={<OriginStrip entry={hero} />} />
          </div>
        )}
        {others.map((entry) => (
          <RepoCard
            key={`${entry.category}-${entry.repo.full_name}`}
            repo={entry.repo}
            topLabel={<OriginStrip entry={entry} />}
          />
        ))}
      </div>
    </section>
  );
}
