import { MetadataRoute } from 'next';
import { getPostMeta } from '../content/journal/index.js';

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getPostMeta();

  return [
    { url: 'https://orthis.app', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
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
