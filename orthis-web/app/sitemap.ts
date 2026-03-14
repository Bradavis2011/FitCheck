import { MetadataRoute } from 'next';
import { getPostMeta } from '../content/journal/index.js';

const API_URL = process.env.API_URL || 'https://fitcheck-production-0f92.up.railway.app';

interface LearnItem {
  slug: string;
  publishedAt?: string | null;
  contentType: string;
}

async function fetchLearnSlugs(): Promise<LearnItem[]> {
  try {
    const res = await fetch(`${API_URL}/api/learn/content?limit=100`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || []) as LearnItem[];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, learnItems] = await Promise.all([
    Promise.resolve(getPostMeta()),
    fetchLearnSlugs(),
  ]);

  const learnUrls: MetadataRoute.Sitemap = learnItems.map((item) => ({
    url: `https://orthis.app/learn/${item.slug}`,
    lastModified: item.publishedAt ? new Date(item.publishedAt) : new Date(),
    changeFrequency: item.contentType === 'trend_report' ? 'weekly' : 'monthly' as const,
    priority: item.contentType === 'style_guide' ? 0.8 : 0.7,
  }));

  return [
    { url: 'https://orthis.app', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: 'https://orthis.app/rush', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: 'https://orthis.app/learn', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: 'https://orthis.app/learn/trends', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: 'https://orthis.app/learn/guides', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://orthis.app/learn/tips', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    ...learnUrls,
    { url: 'https://orthis.app/journal', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    ...posts.map((post) => ({
      url: `https://orthis.app/journal/${post.slug}`,
      lastModified: new Date(post.date),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    { url: 'https://orthis.app/privacy', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: 'https://orthis.app/terms', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: 'https://orthis.app/support', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: 'https://orthis.app/delete-account', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
  ];
}
