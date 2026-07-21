'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export interface CategoryNavItem {
  id: string;
  label: string;
}

interface Props {
  items: CategoryNavItem[];
}

/**
 * Sticky horizontal quick-jump pill bar. Plain `<a href="#id">` anchors so
 * jumping works with JS disabled — IntersectionObserver only adds the
 * current-section highlight on top of that base behavior.
 */
export default function CategoryNav({ items }: Props) {
  const [activeId, setActiveId] = useState<string | null>(items[0]?.id ?? null);

  useEffect(() => {
    if (items.length === 0 || typeof IntersectionObserver === 'undefined') return;

    const sections = items
      .map((it) => document.getElementById(it.id))
      .filter((el): el is HTMLElement => !!el);
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-88px 0px -70% 0px', threshold: 0 },
    );

    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  return (
    <nav
      aria-label="카테고리 바로가기"
      className="sticky top-0 z-20 mb-4 border-b border-bg-border bg-bg-darkest/90 backdrop-blur-sm"
    >
      <div className="flex items-center gap-2 overflow-x-auto py-2">
        {items.map((it) => (
          <a
            key={it.id}
            href={`#${it.id}`}
            className={cn(
              'flex-shrink-0 whitespace-nowrap font-mono text-[11px] uppercase tracking-wider px-3 py-1 rounded-full border transition-colors',
              activeId === it.id
                ? 'text-accent-teal border-accent-teal-dim bg-accent-teal-glow'
                : 'text-fg-muted border-bg-border hover:text-accent-teal hover:border-accent-teal-dim',
            )}
          >
            {it.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
