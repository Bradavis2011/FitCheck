/**
 * Learn Controller
 *
 * Public, read-only API for the orthis.app/learn content hub.
 * No authentication required. All queries filter for status='published'.
 */

import { Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';

const PAGE_SIZE = 10;

// GET /api/learn/content?type=...&category=...&page=1&limit=10
export async function getLearnContent(req: Request, res: Response): Promise<void> {
  const { type, category, page = '1', limit = String(PAGE_SIZE) } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || PAGE_SIZE));
  const skip = (pageNum - 1) * limitNum;

  const where: Record<string, unknown> = { status: 'published' };
  if (type) where.contentType = type;
  if (category) where.category = category;

  const [items, total] = await Promise.all([
    prisma.blogDraft.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      skip,
      take: limitNum,
      select: {
        id: true,
        title: true,
        slug: true,
        contentType: true,
        category: true,
        excerpt: true,
        seoKeywords: true,
        publishedAt: true,
        trendPeriod: true,
        metaDescription: true,
      },
    }),
    prisma.blogDraft.count({ where }),
  ]);

  res.json({
    items,
    total,
    page: pageNum,
    pages: Math.ceil(total / limitNum),
  });
}

// GET /api/learn/content/:slug
export async function getLearnContentBySlug(req: Request, res: Response): Promise<void> {
  const { slug } = req.params;

  const item = await prisma.blogDraft.findFirst({
    where: { slug, status: 'published' },
    select: {
      id: true,
      title: true,
      slug: true,
      contentType: true,
      category: true,
      excerpt: true,
      content: true,
      seoKeywords: true,
      publishedAt: true,
      trendPeriod: true,
      metaDescription: true,
      ogTitle: true,
      scriptData: true,
      sourceRuleIds: true,
    },
  });

  if (!item) {
    res.status(404).json({ error: 'Content not found' });
    return;
  }

  res.json(item);
}

// GET /api/learn/trends/latest
export async function getLatestTrend(_req: Request, res: Response): Promise<void> {
  const item = await prisma.blogDraft.findFirst({
    where: { status: 'published', contentType: 'trend_report' },
    orderBy: { publishedAt: 'desc' },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      content: true,
      trendPeriod: true,
      publishedAt: true,
      metaDescription: true,
      seoKeywords: true,
    },
  });

  res.json(item || null);
}

// GET /api/learn/tips?limit=10
export async function getLearnTips(req: Request, res: Response): Promise<void> {
  const limit = Math.min(50, parseInt((req.query.limit as string) || '10', 10));

  // Return randomised tips for freshness on each page load
  // PostgreSQL RANDOM() — safe for small result sets
  const tips = await prisma.$queryRaw<Array<{
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    content: string;
    published_at: Date | null;
    seo_keywords: string[];
  }>>`
    SELECT id, title, slug, excerpt, content, published_at, seo_keywords
    FROM blog_drafts
    WHERE status = 'published' AND content_type = 'style_tip'
    ORDER BY RANDOM()
    LIMIT ${limit}
  `;

  // Map snake_case back to camelCase for API consumers
  const mapped = tips.map(t => ({
    id: t.id,
    title: t.title,
    slug: t.slug,
    excerpt: t.excerpt,
    content: t.content,
    publishedAt: t.published_at,
    seoKeywords: t.seo_keywords,
  }));

  res.json(mapped);
}

// GET /api/learn/guides
// Returns guides grouped by category
export async function getLearnGuides(_req: Request, res: Response): Promise<void> {
  const guides = await prisma.blogDraft.findMany({
    where: {
      status: 'published',
      contentType: { in: ['style_guide', 'article'] },
    },
    orderBy: [{ category: 'asc' }, { publishedAt: 'desc' }],
    select: {
      id: true,
      title: true,
      slug: true,
      contentType: true,
      category: true,
      excerpt: true,
      publishedAt: true,
      metaDescription: true,
      seoKeywords: true,
    },
  });

  // Group by category
  const grouped: Record<string, typeof guides> = {};
  for (const guide of guides) {
    const key = guide.category || 'general';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(guide);
  }

  res.json(grouped);
}
