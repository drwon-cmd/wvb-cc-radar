import type { ReactNode } from 'react';

interface Props {
  title?: string;
  children?: ReactNode;
  /** Compact mode: single muted line, no REC dot / heading treatment. Used for
   * filter-empty-result states and small inline "no data" notices. */
  compact?: boolean;
}

/**
 * Shared "no data" / "no results" placeholder. Extracted from the ad-hoc
 * "No digest yet" / "No data yet" JSX duplicated across app/page.tsx,
 * app/top/page.tsx, app/weekly/page.tsx, and app/archive/page.tsx.
 */
export default function EmptyState({ title = 'No data yet', children, compact = false }: Props) {
  if (compact) {
    return <p className="py-16 text-center text-fg-muted text-sm font-mono">{title}</p>;
  }

  return (
    <div className="py-24 text-center">
      <div className="inline-block">
        <span className="font-mono text-xs text-accent-teal rec-dot">● AWAITING DATA</span>
        <h1 className="text-3xl font-bold mt-4 mb-2">{title}</h1>
        {children}
      </div>
    </div>
  );
}
