import { NextResponse } from 'next/server';

const INDEXNOW_KEY = '13334acc9b0f8e60c3cf48d4c1364a28';
const HOST = 'orthis.app';
const API_URL = process.env.API_URL || 'https://fitcheck-production-0f92.up.railway.app';

// Static URLs always submitted
const STATIC_URLS = [
  'https://orthis.app',
  'https://orthis.app/rush',
  'https://orthis.app/learn',
  'https://orthis.app/back-to-work',
  'https://orthis.app/dating-again',
  'https://orthis.app/back-to-office',
  'https://orthis.app/postpartum-style',
  'https://orthis.app/career-change',
  'https://orthis.app/reinvention',
];

async function fetchLearnSlugs(): Promise<string[]> {
  try {
    const res = await fetch(`${API_URL}/api/learn/content?limit=200`);
    if (!res.ok) return [];
    const data = await res.json();
    return ((data.items || []) as Array<{ slug: string }>)
      .map(item => `https://orthis.app/learn/${item.slug}`);
  } catch {
    return [];
  }
}

export async function POST(req: Request) {
  // Optional secret check so this can't be called by random crawlers
  const auth = req.headers.get('x-admin-secret');
  const adminSecret = process.env.ADMIN_SECRET;
  if (adminSecret && auth !== adminSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const learnUrls = await fetchLearnSlugs();
  const urlList = [...STATIC_URLS, ...learnUrls];

  const body = {
    host: HOST,
    key: INDEXNOW_KEY,
    keyLocation: `https://${HOST}/${INDEXNOW_KEY}.txt`,
    urlList,
  };

  const response = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });

  return NextResponse.json({
    status: response.status,
    urlsSubmitted: urlList.length,
    urls: urlList,
  });
}
