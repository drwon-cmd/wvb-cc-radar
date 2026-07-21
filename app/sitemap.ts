import type { MetadataRoute } from 'next';
import { getAllDates, getLatestDigest } from '@/lib/data';
import { SITE_URL } from '@/lib/site';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const dates = await getAllDates();
  const latest = await getLatestDigest();
  const latestModified = latest ? new Date(latest.generated_at) : new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: latestModified, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/top`, lastModified: latestModified, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/weekly`, lastModified: latestModified, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/archive`, lastModified: latestModified, changeFrequency: 'daily', priority: 0.6 },
    { url: `${SITE_URL}/about`, lastModified: latestModified, changeFrequency: 'monthly', priority: 0.3 },
  ];

  const archiveRoutes: MetadataRoute.Sitemap = dates.map((date) => ({
    url: `${SITE_URL}/archive/${date}`,
    lastModified: new Date(`${date}T00:00:00Z`),
    changeFrequency: 'never',
    priority: 0.4,
  }));

  return [...staticRoutes, ...archiveRoutes];
}
