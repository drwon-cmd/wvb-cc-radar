import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDigestByDate, getAllDates, formatDateKST } from '@/lib/data';
import { ACTIVE_CATEGORY_IDS } from '@/lib/categories';
import HeroSection from '@/components/HeroSection';
import CategorySection from '@/components/CategorySection';

export const dynamic = 'force-static';
export const dynamicParams = false;

export async function generateStaticParams() {
  const dates = await getAllDates();
  return dates.map((date) => ({ date }));
}

export default async function ArchiveDatePage({
  params,
}: {
  params: { date: string };
}) {
  const digest = await getDigestByDate(params.date);
  if (!digest) notFound();

  const activeCategories = digest.categories.filter((c) =>
    ACTIVE_CATEGORY_IDS.has(c.category),
  );
  const primary = activeCategories.find((c) => c.category === 'claude-code');
  const secondary = activeCategories.filter((c) => c.category !== 'claude-code');

  return (
    <div>
      <div className="py-6 md:py-10 border-b border-bg-border mb-4">
        <div className="flex items-center gap-3 mb-3">
          <Link href="/archive" className="font-mono text-xs text-fg-muted hover:text-accent-teal">
            ← archive
          </Link>
          <span className="font-mono text-xs tracking-widest text-accent-gold uppercase">
            archived · {digest.date}
          </span>
          <span className="text-fg-dim text-xs font-mono">
            · {digest.meta.total_repos} repos
          </span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold">{digest.date}</h1>
        <p className="text-fg-dim text-xs font-mono mt-2">
          {formatDateKST(digest.generated_at)} KST
        </p>
      </div>

      {primary && <HeroSection data={primary} />}
      {secondary.map((cat) => (
        <CategorySection key={cat.category} data={cat} />
      ))}
    </div>
  );
}
