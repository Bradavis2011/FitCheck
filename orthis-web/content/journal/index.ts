import { post as wispr } from './what-wispr-flow-taught-us-about-ugc.js';

export const allPosts = [wispr];

export type PostMeta = {
  slug: string;
  title: string;
  date: string;
  readingTime: string;
  description: string;
};

export function getPostMeta(): PostMeta[] {
  return allPosts.map(({ slug, title, date, readingTime, description }) => ({
    slug, title, date, readingTime, description,
  }));
}

export function getPostBySlug(slug: string) {
  return allPosts.find(p => p.slug === slug) ?? null;
}
