'use client';

import { useMemo, useState } from 'react';
import type { CategoryResult } from '@/lib/types';
import type { StarHistoryPoint } from '@/lib/history';
import { isWvbStack } from '@/lib/wvb-stack';
import FilterBar from './FilterBar';
import CategorySection from './CategorySection';
import EmptyState from './EmptyState';

interface Props {
  /** Already-sorted secondary categories (hero/primary stays server-rendered
   * above this, per the simpler split — see app/page.tsx). */
  categories: CategoryResult[];
  sparklines?: Record<string, StarHistoryPoint[]>;
}

/**
 * Client-side search/language/WVB-stack filter over an already-computed set
 * of categories. Reuses CategorySection/RepoCard as-is (they have no
 * server-only imports, so they bundle fine inside this 'use client' tree).
 */
export default function FilterableDigest({ categories, sparklines }: Props) {
  const [search, setSearch] = useState('');
  const [language, setLanguage] = useState('');
  const [wvbOnly, setWvbOnly] = useState(false);

  const languages = useMemo(() => {
    const set = new Set<string>();
    categories.forEach((c) => c.items.forEach((r) => r.language && set.add(r.language)));
    return [...set].sort();
  }, [categories]);

  const q = search.trim().toLowerCase();
  const isFiltering = q.length > 0 || language.length > 0 || wvbOnly;

  const filtered = useMemo(() => {
    if (!isFiltering) return categories;
    return categories
      .map((cat) => ({
        ...cat,
        items: cat.items.filter((r) => {
          if (language && r.language !== language) return false;
          if (wvbOnly && !isWvbStack(r.full_name)) return false;
          if (q) {
            const haystack = `${r.full_name} ${r.description ?? ''} ${r.description_ko ?? ''}`.toLowerCase();
            if (!haystack.includes(q)) return false;
          }
          return true;
        }),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [categories, isFiltering, language, wvbOnly, q]);

  const totalShown = filtered.reduce((sum, c) => sum + c.items.length, 0);

  return (
    <div>
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        language={language}
        onLanguageChange={setLanguage}
        languages={languages}
        wvbOnly={wvbOnly}
        onWvbOnlyChange={setWvbOnly}
      />

      {isFiltering && totalShown === 0 ? (
        <EmptyState title="일치하는 레포가 없습니다" compact />
      ) : (
        filtered.map((cat) => (
          <CategorySection key={cat.category} data={cat} sparklines={sparklines} />
        ))
      )}
    </div>
  );
}
