const API_URL = process.env.API_URL || "https://fitcheck-production-0f92.up.railway.app";

export interface LearnItem {
  id: string;
  title: string;
  slug: string;
  contentType: string;
  category?: string | null;
  excerpt?: string | null;
  publishedAt?: string | null;
  metaDescription?: string | null;
  seoKeywords?: string[];
  trendPeriod?: string | null;
}

export interface LearnItemFull extends LearnItem {
  content: string;
  ogTitle?: string | null;
  scriptData?: Record<string, string> | null;
  sourceRuleIds?: string[];
}

export interface LearnContentResponse {
  items: LearnItem[];
  total: number;
  page: number;
  pages: number;
}

export async function fetchLearnContent(
  type?: string,
  category?: string,
  page = 1,
  limit = 12,
  revalidate = 3600
): Promise<LearnContentResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (type) params.set("type", type);
  if (category) params.set("category", category);

  const res = await fetch(`${API_URL}/api/learn/content?${params}`, {
    next: { revalidate },
  });
  if (!res.ok) return { items: [], total: 0, page: 1, pages: 0 };
  return res.json();
}

export async function fetchLearnContentBySlug(slug: string): Promise<LearnItemFull | null> {
  const res = await fetch(`${API_URL}/api/learn/content/${slug}`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchLatestTrend(): Promise<LearnItemFull | null> {
  const res = await fetch(`${API_URL}/api/learn/trends/latest`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchLearnTips(limit = 10): Promise<LearnItem[]> {
  const res = await fetch(`${API_URL}/api/learn/tips?limit=${limit}`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchLearnGuides(): Promise<Record<string, LearnItem[]>> {
  const res = await fetch(`${API_URL}/api/learn/guides`, {
    next: { revalidate: 86400 },
  });
  if (!res.ok) return {};
  return res.json();
}
