import { NextResponse } from 'next/server';
import { getLatestDigest, getAllDates } from '@/lib/data';

export const dynamic = 'force-static';
export const revalidate = 3600;

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const digest = await getLatestDigest();
  const dates = await getAllDates();
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || 'https://wvb-cc-radar.up.railway.app';

  const items: string[] = [];

  if (digest) {
    for (const cat of digest.categories) {
      for (const repo of cat.items.slice(0, 5)) {
        const title = `[${cat.title}] ${repo.full_name}`;
        const link = repo.html_url;
        const desc = repo.description || '';
        const stars = repo.stargazers_count;
        const delta = repo.stars_delta_24h
          ? ` (+${repo.stars_delta_24h}/24h)`
          : '';
        items.push(`
    <item>
      <title>${escape(title)}</title>
      <link>${escape(link)}</link>
      <guid isPermaLink="false">${escape(repo.full_name)}-${digest.date}</guid>
      <pubDate>${new Date(digest.generated_at).toUTCString()}</pubDate>
      <description>${escape(desc)} | ${stars} stars${delta}</description>
    </item>`);
      }
    }
  }

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>wvb-cc-radar — Claude Code Daily Digest</title>
    <link>${siteUrl}</link>
    <description>Daily digest of trending GitHub repos for Claude Code ecosystem upgrade. Curated by WVB.</description>
    <language>en-us</language>
    <lastBuildDate>${digest ? new Date(digest.generated_at).toUTCString() : new Date().toUTCString()}</lastBuildDate>
    ${dates.length > 0 ? `<ttl>3600</ttl>` : ''}
${items.join('\n')}
  </channel>
</rss>`;

  return new NextResponse(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
