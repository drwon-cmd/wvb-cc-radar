import type { ReactNode } from 'react';
import { Star, GitFork, ExternalLink } from 'lucide-react';
import OgImage from './OgImage';
import Sparkline from './Sparkline';
import type { Repo } from '@/lib/types';
import type { StarHistoryPoint } from '@/lib/history';
import { cn, formatStars, formatDelta, relativeDays } from '@/lib/utils';
import { isWvbStack } from '@/lib/wvb-stack';
import Badge from './Badge';

interface Props {
  repo: Repo;
  rank?: number;
  featured?: boolean;
  /**
   * Optional label rendered as a prominent strip at the top of the card body.
   * Used by WhatsNewSection to surface the origin category + rank delta so
   * viewers don't have to squint at the image overlay to understand context.
   */
  topLabel?: ReactNode;
  /**
   * Optional star history series (oldest -> newest). Renders a small inline
   * Sparkline in the stats row when present with >= 2 points. Callers cap how
   * many cards receive this (e.g. top-3 per category) — never fetched for
   * every repo on the page.
   */
  series?: StarHistoryPoint[];
}

export default function RepoCard({ repo, rank, featured = false, topLabel, series }: Props) {
  const delta = repo.stars_delta_24h;
  const deltaPositive = typeof delta === 'number' && delta > 0;
  const weekly = repo.stars_delta_7d;
  const weeklyWindow = repo.delta_window_days ?? 0;
  // Surface weekly delta only when positive AND the baseline window is real.
  // bkamp.ai leans on this as the "이번 주 +N⭐" badge — it's the signal that
  // separates a long-tail giant from a viral newcomer.
  const weeklyPositive = typeof weekly === 'number' && weekly > 0 && weeklyWindow > 0;
  const isWvb = isWvbStack(repo.full_name);

  return (
    <a
      href={repo.html_url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'group relative block bg-bg-panel border border-bg-border rounded-md overflow-hidden',
        'hover:border-accent-teal-dim hover:shadow-teal-glow transition-all duration-200',
        featured && 'md:col-span-2',
      )}
    >
      {featured && (
        <div className="relative aspect-[1200/600] bg-bg-darker overflow-hidden">
          <OgImage
            src={repo.opengraph_url}
            alt={`${repo.full_name} preview`}
            repoName={repo.full_name}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg-panel via-transparent to-transparent" />
          {rank !== undefined && (
            <div className="absolute top-3 left-3 font-mono text-xs text-accent-teal bg-bg-darkest/80 border border-accent-teal-dim px-2 py-0.5 rounded-sm">
              #{String(rank).padStart(2, '0')}
            </div>
          )}
        </div>
      )}

      <div className="p-4 md:p-5">
        {topLabel && (
          <div className="mb-3 pb-2 border-b border-bg-border">{topLabel}</div>
        )}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {!featured && rank !== undefined && (
                <span className="font-mono text-xs text-fg-dim">
                  #{String(rank).padStart(2, '0')}
                </span>
              )}
              <span className="font-mono text-xs text-fg-muted">{repo.owner}/</span>
              <span className="font-mono text-sm font-semibold text-fg-primary group-hover:text-accent-teal truncate">
                {repo.name}
              </span>
              <ExternalLink className="w-3 h-3 text-fg-dim flex-shrink-0" />
            </div>
            {(repo.description_ko || repo.description) && (
              <p
                className={cn(
                  'text-fg-muted',
                  featured ? 'text-sm line-clamp-2' : 'text-xs line-clamp-2',
                )}
                title={repo.description || undefined}
              >
                {repo.description_ko || repo.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap mt-3">
          {weeklyPositive && (
            <span
              className={cn(
                'font-mono font-bold inline-flex items-center gap-1 rounded-sm px-2 py-0.5',
                'bg-accent-gold-dim text-accent-gold border border-accent-gold/40',
                featured ? 'text-sm' : 'text-xs',
              )}
              title={`Stars gained over the last ${weeklyWindow}d baseline`}
            >
              {formatDelta(weekly)}★ {weeklyWindow}d
            </span>
          )}
          {repo.is_new_this_week && <Badge variant="new">NEW</Badge>}
          {isWvb && <Badge variant="gold">WVB uses</Badge>}
          {repo.language && (
            <Badge variant="teal">{repo.language}</Badge>
          )}
          {repo.topics.slice(0, featured ? 4 : 2).map((t) => (
            <Badge key={t} variant="muted">
              {t}
            </Badge>
          ))}
        </div>

        <div className="flex items-center gap-4 mt-3 text-xs font-mono text-fg-muted">
          <span className="flex items-center gap-1">
            <Star className="w-3 h-3" />
            {formatStars(repo.stargazers_count)}
            {deltaPositive && (
              <span className="text-accent-teal ml-1">
                {formatDelta(delta)}/24h
              </span>
            )}
          </span>
          <span className="flex items-center gap-1">
            <GitFork className="w-3 h-3" />
            {formatStars(repo.forks_count)}
            {typeof repo.forks_delta_7d === 'number' && repo.forks_delta_7d > 0 && weeklyWindow > 0 && (
              <span className="text-accent-teal ml-1">
                {formatDelta(repo.forks_delta_7d)}/{weeklyWindow}d
              </span>
            )}
          </span>
          {series && series.length >= 2 && (
            <span className="hidden sm:inline-flex items-center flex-shrink-0" title="14일 스타 추이">
              <Sparkline data={series} width={featured ? 96 : 64} height={featured ? 28 : 20} />
            </span>
          )}
          <span className="ml-auto text-fg-dim">
            pushed {relativeDays(repo.pushed_at)}
          </span>
        </div>
      </div>
    </a>
  );
}
