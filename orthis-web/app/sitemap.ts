import { MetadataRoute } from 'next';

const API_URL = process.env.API_URL || 'https://fitcheck-production-0f92.up.railway.app';

interface LearnItem {
  slug: string;
  publishedAt?: string | null;
  contentType: string;
}

async function fetchLearnSlugs(): Promise<LearnItem[]> {
  try {
    const res = await fetch(`${API_URL}/api/learn/content?limit=200`, {
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
  const learnItems = await fetchLearnSlugs();

  const learnUrls: MetadataRoute.Sitemap = learnItems.map((item) => ({
    url: `https://orthis.app/learn/${item.slug}`,
    lastModified: item.publishedAt ? new Date(item.publishedAt) : new Date(),
    changeFrequency: item.contentType === 'trend_report' ? 'weekly' : 'monthly' as const,
    priority: item.contentType === 'style_guide' ? 0.8 : 0.7,
  }));

  // Niche landing pages — transition moments content hub
  const nichePages: MetadataRoute.Sitemap = [
    { url: 'https://orthis.app/back-to-work', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: 'https://orthis.app/dating-again', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: 'https://orthis.app/back-to-office', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: 'https://orthis.app/postpartum-style', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: 'https://orthis.app/career-change', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: 'https://orthis.app/reinvention', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
  ];

  return [
    { url: 'https://orthis.app', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: 'https://orthis.app/try', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.95 },
    { url: 'https://orthis.app/rush', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: 'https://orthis.app/learn', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: 'https://orthis.app/learn/trends', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: 'https://orthis.app/learn/guides', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://orthis.app/learn/tips', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    ...nichePages,
    ...learnUrls,
    { url: 'https://orthis.app/privacy', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: 'https://orthis.app/terms', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: 'https://orthis.app/support', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: 'https://orthis.app/delete-account', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
  ];
}
