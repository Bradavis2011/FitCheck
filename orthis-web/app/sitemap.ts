import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://orthis.app', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: 'https://orthis.app/privacy', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: 'https://orthis.app/terms', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: 'https://orthis.app/support', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: 'https://orthis.app/delete-account', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
  ];
}
