/**
 * SEO Intelligence Service
 *
 * Pulls Google Search Console data, identifies keyword opportunities,
 * discovers niche keywords via Gemini, checks PageSpeed, and emails
 * the founder a weekly SEO report.
 *
 * Schedule: Monday 7:30am UTC
 * Env vars:
 *   GSC_SERVICE_ACCOUNT_EMAIL — service account email
 *   GSC_PRIVATE_KEY           — service account private key (PEM)
 *   GSC_SITE_URL              — defaults to https://orthis.app
 *   PAGESPEED_API_KEY         — optional, increases rate limits
 */

import { google } from 'googleapis';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Resend } from 'resend';
import { prisma } from '../utils/prisma.js';
import { publishToIntelligenceBus } from './intelligence-bus.service.js';
import { hasLearningBudget, reserveTokens, recordTokenUsage } from './token-budget.service.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const SITE_URL = process.env.GSC_SITE_URL || 'https://orthis.app';
const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || 'hello@orthis.app';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SearchAnalyticsRow {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface KeywordOpportunity {
  query: string;
  page: string | null;
  clicks: number;
  impressions: number;
  position: number;
  bucket: 'improve_title' | 'content_boost' | 'new_page' | 'major_expansion';
  action: string;
}

// ─── Serper Types ─────────────────────────────────────────────────────────────

interface SerperOrganicResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
}

interface SerperPeopleAlsoAsk {
  question: string;
  snippet?: string;
}

interface SerperRelatedSearch {
  query: string;
}

export interface SerperResult {
  organic: SerperOrganicResult[];
  peopleAlsoAsk: SerperPeopleAlsoAsk[];
  relatedSearches: SerperRelatedSearch[];
  answerBox?: { answer?: string; snippet?: string; title?: string };
}

interface PageSpeedResult {
  url: string;
  mobileScore: number | null;
  lcp: number | null; // ms
  fid: number | null; // ms
  cls: number | null;
  issues: string[];
}

interface SeoReport {
  period: string;
  totalClicks: number;
  totalImpressions: number;
  avgPosition: number;
  avgCtr: number;
  topQueries: SearchAnalyticsRow[];
  opportunities: KeywordOpportunity[];
  pageSpeedResults: PageSpeedResult[];
  indexingIssues: string[];
  summary: string;
  actionItems: string[];
}

// ─── GSC Auth ─────────────────────────────────────────────────────────────────

function getGscAuth() {
  const email = process.env.GSC_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GSC_PRIVATE_KEY;
  if (!email || !key) return null;

  return new google.auth.JWT({
    email,
    key: key.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });
}

// ─── Serper.dev Search Helper ─────────────────────────────────────────────────

export async function searchSerper(query: string, num = 10): Promise<SerperResult> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) throw new Error('SERPER_API_KEY not set');

  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: query, num }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) throw new Error(`Serper API error: ${res.status} ${await res.text()}`);

  const data = await res.json() as {
    organic?: Array<{ title?: string; link?: string; snippet?: string; position?: number }>;
    peopleAlsoAsk?: Array<{ question?: string; snippet?: string }>;
    relatedSearches?: Array<{ query?: string }>;
    answerBox?: { answer?: string; snippet?: string; title?: string };
  };

  return {
    organic: (data.organic ?? []).map(r => ({
      title: r.title ?? '',
      link: r.link ?? '',
      snippet: r.snippet ?? '',
      position: r.position ?? 0,
    })),
    peopleAlsoAsk: (data.peopleAlsoAsk ?? []).map(r => ({
      question: r.question ?? '',
      snippet: r.snippet,
    })),
    relatedSearches: (data.relatedSearches ?? []).map(r => ({ query: r.query ?? '' })),
    answerBox: data.answerBox,
  };
}

// ─── GSC Data Fetching ────────────────────────────────────────────────────────

async function fetchSearchAnalytics(days = 28): Promise<SearchAnalyticsRow[]> {
  const auth = getGscAuth();
  if (!auth) {
    console.log('[SeoIntelligence] GSC credentials not configured — skipping analytics fetch');
    return [];
  }

  const webmasters = google.searchconsole({ version: 'v1', auth });
  const endDate = new Date();
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const fmt = (d: Date) => d.toISOString().split('T')[0];

  try {
    const res = await webmasters.searchanalytics.query({
      siteUrl: SITE_URL,
      requestBody: {
        startDate: fmt(startDate),
        endDate: fmt(endDate),
        dimensions: ['query', 'page'],
        rowLimit: 1000,
      },
    });

    type GscRow = { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number };
    return ((res.data.rows || []) as GscRow[]).map((row) => ({
      query: row.keys?.[0] ?? '',
      page: row.keys?.[1] ?? '',
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      ctr: row.ctr ?? 0,
      position: row.position ?? 100,
    }));
  } catch (err) {
    console.error('[SeoIntelligence] GSC fetch failed:', err);
    return [];
  }
}

// ─── Keyword Opportunities ────────────────────────────────────────────────────

async function identifyKeywordOpportunities(
  rows: SearchAnalyticsRow[],
): Promise<KeywordOpportunity[]> {
  const opps: KeywordOpportunity[] = [];

  for (const row of rows) {
    if (row.impressions < 5) continue; // ignore noise

    let bucket: KeywordOpportunity['bucket'] | null = null;
    let action = '';

    if (row.position <= 3 && row.ctr < 0.05) {
      bucket = 'improve_title';
      action = `Position ${row.position.toFixed(0)} but only ${(row.ctr * 100).toFixed(1)}% CTR — rewrite title/meta to be more compelling`;
    } else if (row.position >= 4 && row.position <= 10) {
      bucket = 'content_boost';
      action = `Position ${row.position.toFixed(0)} — add sections, FAQ, and depth to push into top 3`;
    } else if (row.position >= 11 && row.position <= 20) {
      bucket = 'major_expansion';
      action = `Position ${row.position.toFixed(0)} — create dedicated page or major content expansion`;
    } else if (row.impressions > 50 && row.clicks === 0) {
      bucket = 'new_page';
      action = `${row.impressions} impressions with no dedicated page — create targeted content`;
    }

    if (bucket) {
      opps.push({
        query: row.query,
        page: row.page || null,
        clicks: row.clicks,
        impressions: row.impressions,
        position: row.position,
        bucket,
        action,
      });
    }
  }

  // Sort by impressions desc
  return opps.sort((a, b) => b.impressions - a.impressions).slice(0, 30);
}

// ─── Niche Keyword Discovery ──────────────────────────────────────────────────

// Dispatch: Serper (real SERP data) → Gemini grounding (real Google-backed) → empty
export async function discoverNicheKeywords(niche: string): Promise<string[]> {
  if (process.env.SERPER_API_KEY) {
    return discoverNicheKeywordsSerper(niche);
  }
  return discoverNicheKeywordsGrounded(niche);
}

async function discoverNicheKeywordsSerper(niche: string): Promise<string[]> {
  const seeds = [
    niche,
    `what to wear ${niche}`,
    `${niche} outfit ideas`,
    `${niche} outfit guide`,
  ];

  const keywords = new Set<string>();

  for (const seed of seeds) {
    try {
      const result = await searchSerper(seed, 10);
      for (const r of result.relatedSearches) {
        if (r.query) keywords.add(r.query.toLowerCase());
      }
      for (const r of result.peopleAlsoAsk) {
        if (r.question) keywords.add(r.question.toLowerCase());
      }
      // Small delay to avoid rate-limiting
      await new Promise(r => setTimeout(r, 250));
    } catch (err) {
      console.error(`[SeoIntelligence] Serper seed failed for "${seed}":`, err);
    }
  }

  console.log(`[SeoIntelligence] discoverNicheKeywordsSerper: found ${keywords.size} keywords for "${niche}"`);
  return [...keywords].slice(0, 20);
}

// Fallback: Gemini with googleSearch grounding — real search-backed answers, not hallucinations
async function discoverNicheKeywordsGrounded(niche: string): Promise<string[]> {
  const budgetOk = await hasLearningBudget(3);
  if (!budgetOk) return [];

  const estimated = 1000;
  const reserved = await reserveTokens(estimated, 'seo_intelligence');
  if (!reserved) return [];

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    tools: [{ googleSearch: {} }] as any,
  });

  const prompt = `Search Google for what people are actually typing when they search for "${niche}" outfit advice in 2026.

Return ONLY a JSON array of real search queries (not topic summaries — actual queries people type):
["query one", "query two", "query three"]`;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();
    const usageMeta = result.response.usageMetadata;
    const actual = (usageMeta?.promptTokenCount ?? 0) + (usageMeta?.candidatesTokenCount ?? 0);
    await recordTokenUsage(estimated, actual || estimated, 'seo_intelligence');

    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return [];
    return JSON.parse(match[0]) as string[];
  } catch (err) {
    console.error('[SeoIntelligence] Grounded keyword discovery failed:', err);
    await recordTokenUsage(estimated, 0, 'seo_intelligence');
    return [];
  }
}

// ─── Position Tracking ────────────────────────────────────────────────────────

export async function trackKeywordPositions(): Promise<void> {
  if (!process.env.SERPER_API_KEY) {
    console.log('[SeoIntelligence] trackKeywordPositions: SERPER_API_KEY not set — skipping');
    return;
  }

  const keywords = await prisma.targetKeyword.findMany({
    where: { status: 'content_created' },
  });

  if (keywords.length === 0) {
    console.log('[SeoIntelligence] trackKeywordPositions: no keywords with content yet');
    return;
  }

  console.log(`[SeoIntelligence] Tracking positions for ${keywords.length} keyword(s)...`);

  for (const kw of keywords) {
    try {
      const result = await searchSerper(kw.keyword, 100);
      const match = result.organic.find(r => r.link.includes('orthis.app'));

      if (match) {
        await prisma.targetKeyword.update({
          where: { id: kw.id },
          data: { currentPosition: match.position },
        });
        console.log(`[SeoIntelligence] "${kw.keyword}" → position ${match.position}`);
      } else {
        await prisma.targetKeyword.update({
          where: { id: kw.id },
          data: { currentPosition: null },
        });
        console.log(`[SeoIntelligence] "${kw.keyword}" → not in top 100`);
      }

      // Small delay to avoid hammering Serper quota
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      console.error(`[SeoIntelligence] Position check failed for "${kw.keyword}":`, err);
    }
  }

  console.log('[SeoIntelligence] Position tracking complete');
}

// ─── Trending Keyword Discovery (Gemini grounding) ────────────────────────────

export async function discoverTrendingKeywords(niche: string): Promise<string[]> {
  const budgetOk = await hasLearningBudget(3);
  if (!budgetOk) return [];

  const estimated = 1200;
  const reserved = await reserveTokens(estimated, 'seo_intelligence');
  if (!reserved) return [];

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    tools: [{ googleSearch: {} }] as any,
  });

  const prompt = `Search for current trending searches related to "${niche}" in 2026.
What are people actively searching for RIGHT NOW related to this topic?
Return ONLY a JSON array of actual search queries people are typing (not topics — real queries):
["query 1", "query 2", "query 3"]`;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();
    const usageMeta = result.response.usageMetadata;
    const actual = (usageMeta?.promptTokenCount ?? 0) + (usageMeta?.candidatesTokenCount ?? 0);
    await recordTokenUsage(estimated, actual || estimated, 'seo_intelligence');

    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const queries = JSON.parse(match[0]) as string[];
    console.log(`[SeoIntelligence] discoverTrendingKeywords: found ${queries.length} trending queries for "${niche}"`);
    return queries;
  } catch (err) {
    console.error('[SeoIntelligence] Trending keyword discovery failed:', err);
    await recordTokenUsage(estimated, 0, 'seo_intelligence');
    return [];
  }
}

// ─── PageSpeed ────────────────────────────────────────────────────────────────

async function checkPageSpeed(url: string): Promise<PageSpeedResult> {
  const apiKey = process.env.PAGESPEED_API_KEY;
  const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=performance${apiKey ? `&key=${apiKey}` : ''}`;

  try {
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return { url, mobileScore: null, lcp: null, fid: null, cls: null, issues: ['API error'] };

    const data = await res.json() as {
      lighthouseResult?: {
        categories?: { performance?: { score?: number } };
        audits?: Record<string, { displayValue?: string; score?: number; numericValue?: number }>;
      };
    };

    const score = data.lighthouseResult?.categories?.performance?.score;
    const audits = data.lighthouseResult?.audits ?? {};
    const lcp = audits['largest-contentful-paint']?.numericValue ?? null;
    const cls = audits['cumulative-layout-shift']?.numericValue ?? null;
    const fid = audits['total-blocking-time']?.numericValue ?? null;

    const issues: string[] = [];
    if (score != null && score < 0.5) issues.push(`Poor mobile score: ${Math.round(score * 100)}`);
    if (lcp != null && lcp > 4000) issues.push(`Slow LCP: ${(lcp / 1000).toFixed(1)}s`);
    if (cls != null && cls > 0.1) issues.push(`High CLS: ${cls.toFixed(3)}`);

    return { url, mobileScore: score != null ? Math.round(score * 100) : null, lcp, fid, cls, issues };
  } catch (err) {
    console.error(`[SeoIntelligence] PageSpeed failed for ${url}:`, err);
    return { url, mobileScore: null, lcp: null, fid: null, cls: null, issues: ['Request failed'] };
  }
}

// ─── Report Generation ────────────────────────────────────────────────────────

async function generateSeoReport(
  rows: SearchAnalyticsRow[],
  opps: KeywordOpportunity[],
  pageSpeedResults: PageSpeedResult[],
  period: string,
): Promise<SeoReport> {
  const totalClicks = rows.reduce((s, r) => s + r.clicks, 0);
  const totalImpressions = rows.reduce((s, r) => s + r.impressions, 0);
  const avgPosition = rows.length > 0 ? rows.reduce((s, r) => s + r.position, 0) / rows.length : 0;
  const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
  const topQueries = [...rows].sort((a, b) => b.clicks - a.clicks).slice(0, 10);

  // Gemini: synthesize action items
  let summary = 'SEO data collected. See opportunities below.';
  let actionItems: string[] = [];

  const budgetOk = await hasLearningBudget(3);
  if (budgetOk && rows.length > 0) {
    const estimated = 1500;
    const reserved = await reserveTokens(estimated, 'seo_intelligence');
    if (reserved) {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash-lite',
        generationConfig: { maxOutputTokens: 800, temperature: 0.5 },
      });
      const prompt = `Analyze this SEO data for "Or This?" (AI outfit feedback app) and provide a concise summary and top 5 action items.

Period: ${period}
Total clicks: ${totalClicks}
Total impressions: ${totalImpressions}
Avg position: ${avgPosition.toFixed(1)}
Avg CTR: ${(avgCtr * 100).toFixed(2)}%
Top queries: ${topQueries.slice(0, 5).map(r => `"${r.query}" (pos ${r.position.toFixed(0)}, ${r.impressions} impr)`).join(', ')}
Top opportunities: ${opps.slice(0, 5).map(o => `"${o.query}" (${o.bucket})`).join(', ')}

Return JSON: {"summary": "2-3 sentences", "actionItems": ["item 1", "item 2", ...5 items]}`;

      try {
        const result = await model.generateContent(prompt);
        const raw = result.response.text().trim();
        const usageMeta = result.response.usageMetadata;
        const actual = (usageMeta?.promptTokenCount ?? 0) + (usageMeta?.candidatesTokenCount ?? 0);
        await recordTokenUsage(estimated, actual || estimated, 'seo_intelligence');

        const match = raw.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]) as { summary: string; actionItems: string[] };
          summary = parsed.summary || summary;
          actionItems = parsed.actionItems || [];
        }
      } catch {
        await recordTokenUsage(estimated, 0, 'seo_intelligence');
      }
    }
  }

  return {
    period,
    totalClicks,
    totalImpressions,
    avgPosition,
    avgCtr,
    topQueries,
    opportunities: opps,
    pageSpeedResults,
    indexingIssues: [],
    summary,
    actionItems,
  };
}

// ─── Email Report ─────────────────────────────────────────────────────────────

async function sendSeoReportEmail(report: SeoReport): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return;
  const resend = new Resend(resendKey);

  const bucketLabel: Record<KeywordOpportunity['bucket'], string> = {
    improve_title: '🖊 Improve Title/Meta',
    content_boost: '📈 Content Boost',
    major_expansion: '🚀 Major Expansion',
    new_page: '🆕 New Page Needed',
  };

  const psRows = report.pageSpeedResults.map(ps =>
    `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eee">${ps.url.replace('https://orthis.app', '')}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;color:${ps.mobileScore != null && ps.mobileScore >= 70 ? '#10B981' : ps.mobileScore != null && ps.mobileScore >= 50 ? '#F59E0B' : '#EF4444'};font-weight:600">${ps.mobileScore ?? '—'}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:12px;color:#666">${ps.issues.join(', ') || 'OK'}</td>
    </tr>`
  ).join('');

  const oppRows = report.opportunities.slice(0, 10).map(o =>
    `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:13px">"${o.query}"</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center">${o.impressions}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center">${o.position.toFixed(0)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:12px">${bucketLabel[o.bucket]}</td>
    </tr>`
  ).join('');

  const html = `<div style="font-family:sans-serif;max-width:700px;margin:0 auto;color:#1A1A1A">
  <div style="background:#E85D4C;padding:24px 32px">
    <h1 style="color:white;margin:0;font-size:22px">SEO Intelligence Report — ${report.period}</h1>
  </div>
  <div style="padding:32px">
    <h2 style="font-size:16px;margin:0 0 16px">Traffic Snapshot (Last 28 Days)</h2>
    <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:24px">
      <div style="background:#FBF7F4;padding:16px 20px;min-width:120px">
        <div style="font-size:28px;font-weight:700;color:#E85D4C">${report.totalClicks}</div>
        <div style="font-size:12px;color:#666;text-transform:uppercase">Clicks</div>
      </div>
      <div style="background:#FBF7F4;padding:16px 20px;min-width:120px">
        <div style="font-size:28px;font-weight:700;color:#E85D4C">${report.totalImpressions}</div>
        <div style="font-size:12px;color:#666;text-transform:uppercase">Impressions</div>
      </div>
      <div style="background:#FBF7F4;padding:16px 20px;min-width:120px">
        <div style="font-size:28px;font-weight:700;color:#E85D4C">${report.avgPosition.toFixed(1)}</div>
        <div style="font-size:12px;color:#666;text-transform:uppercase">Avg Position</div>
      </div>
      <div style="background:#FBF7F4;padding:16px 20px;min-width:120px">
        <div style="font-size:28px;font-weight:700;color:#E85D4C">${(report.avgCtr * 100).toFixed(2)}%</div>
        <div style="font-size:12px;color:#666;text-transform:uppercase">Avg CTR</div>
      </div>
    </div>

    <h2 style="font-size:16px;margin:0 0 12px">Summary</h2>
    <p style="color:#444;line-height:1.6;margin:0 0 24px">${report.summary}</p>

    <h2 style="font-size:16px;margin:0 0 12px">Action Items</h2>
    <ol style="padding-left:20px;color:#444;line-height:2;margin:0 0 24px">
      ${report.actionItems.map(a => `<li>${a}</li>`).join('')}
    </ol>

    ${oppRows ? `
    <h2 style="font-size:16px;margin:0 0 12px">Keyword Opportunities</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:13px">
      <thead><tr style="background:#f5f5f5">
        <th style="padding:8px;text-align:left">Query</th>
        <th style="padding:8px;text-align:center">Impr.</th>
        <th style="padding:8px;text-align:center">Pos.</th>
        <th style="padding:8px;text-align:left">Action</th>
      </tr></thead>
      <tbody>${oppRows}</tbody>
    </table>` : '<p style="color:#999;margin-bottom:24px">No GSC data yet — configure GSC_SERVICE_ACCOUNT_EMAIL and GSC_PRIVATE_KEY.</p>'}

    ${psRows ? `
    <h2 style="font-size:16px;margin:0 0 12px">PageSpeed (Mobile)</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:13px">
      <thead><tr style="background:#f5f5f5">
        <th style="padding:8px;text-align:left">Page</th>
        <th style="padding:8px;text-align:center">Score</th>
        <th style="padding:8px;text-align:left">Issues</th>
      </tr></thead>
      <tbody>${psRows}</tbody>
    </table>` : ''}

    ${report.topQueries.length > 0 ? `
    <h2 style="font-size:16px;margin:0 0 12px">Top Queries This Period</h2>
    <ol style="padding-left:20px;color:#444;margin:0 0 24px">
      ${report.topQueries.slice(0, 10).map(q =>
        `<li style="line-height:2">"${q.query}" — ${q.clicks} clicks, pos ${q.position.toFixed(0)}</li>`
      ).join('')}
    </ol>` : ''}
  </div>
  <div style="padding:16px 32px;background:#f9f9f9;font-size:12px;color:#999">
    Or This? SEO Engine · ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
  </div>
</div>`;

  try {
    await resend.emails.send({
      from: 'Or This? <noreply@orthis.app>',
      to: FOUNDER_EMAIL,
      subject: `SEO Report: ${report.totalClicks} clicks, ${report.totalImpressions} impressions — ${report.period}`,
      html,
    });
    console.log('[SeoIntelligence] Report email sent');
  } catch (err) {
    console.error('[SeoIntelligence] Failed to send email:', err);
  }
}

// ─── Rush Keyword Seed Management ─────────────────────────────────────────────

const RUSH_KEYWORD_SEEDS: Array<{ keyword: string; intent: 'transactional' | 'informational'; difficulty: 'low' | 'medium' | 'high' }> = [
  // Round-specific (highest intent)
  { keyword: 'what to wear to sorority rush open house', intent: 'informational', difficulty: 'low' },
  { keyword: 'philanthropy round outfit ideas', intent: 'informational', difficulty: 'low' },
  { keyword: 'sisterhood round outfit sorority rush', intent: 'informational', difficulty: 'low' },
  { keyword: 'what to wear to preference night sorority', intent: 'informational', difficulty: 'low' },
  { keyword: 'bid day outfit ideas sorority', intent: 'informational', difficulty: 'low' },
  // General rush anxiety
  { keyword: 'sorority rush outfit ideas 2026', intent: 'informational', difficulty: 'medium' },
  { keyword: 'what to wear to sorority recruitment', intent: 'informational', difficulty: 'medium' },
  { keyword: 'rush week outfits', intent: 'informational', difficulty: 'medium' },
  { keyword: 'sorority rush dress code', intent: 'informational', difficulty: 'low' },
  { keyword: 'what not to wear to sorority rush', intent: 'informational', difficulty: 'low' },
  // Specific questions (FAQ / featured snippet targets)
  { keyword: 'what does business casual mean for rush', intent: 'informational', difficulty: 'low' },
  { keyword: 'can you wear jeans to sorority rush', intent: 'informational', difficulty: 'low' },
  { keyword: 'how many outfits do you need for rush week', intent: 'informational', difficulty: 'low' },
  { keyword: 'sorority rush outfit on a budget', intent: 'transactional', difficulty: 'low' },
  // School-specific (low competition)
  { keyword: 'what to wear to rush at alabama', intent: 'informational', difficulty: 'low' },
  { keyword: 'ole miss sorority rush outfits', intent: 'informational', difficulty: 'low' },
  { keyword: 'sorority rush outfits SEC schools', intent: 'informational', difficulty: 'low' },
];

// ─── Transition Niche Keyword Seeds ───────────────────────────────────────────

type SeedEntry = { keyword: string; intent: 'transactional' | 'informational'; difficulty: 'low' | 'medium' | 'high' };

const TRANSITION_NICHE_SEEDS: Array<SeedEntry & { niche: string }> = [
  // sahm_rto — stay-at-home mom returning to work
  { niche: 'sahm_rto', keyword: 'stay at home mom returning to work outfits', intent: 'informational', difficulty: 'low' },
  { niche: 'sahm_rto', keyword: 'what to wear first day back at work after kids', intent: 'informational', difficulty: 'low' },
  { niche: 'sahm_rto', keyword: 'rebuilding professional wardrobe mom', intent: 'informational', difficulty: 'low' },
  { niche: 'sahm_rto', keyword: 'sahm to working mom style', intent: 'informational', difficulty: 'low' },

  // dating_restart — dating after divorce / breakup
  { niche: 'dating_restart', keyword: 'what to wear first date after divorce', intent: 'informational', difficulty: 'low' },
  { niche: 'dating_restart', keyword: 'dating again outfit ideas over 30', intent: 'informational', difficulty: 'low' },
  { niche: 'dating_restart', keyword: 'rebuilding confidence style after breakup', intent: 'informational', difficulty: 'low' },
  { niche: 'dating_restart', keyword: 'first date outfit single mom', intent: 'informational', difficulty: 'low' },

  // wfh_rto — return to office after remote work
  { niche: 'wfh_rto', keyword: 'return to office outfit ideas 2026', intent: 'informational', difficulty: 'medium' },
  { niche: 'wfh_rto', keyword: 'what to wear back to office after working from home', intent: 'informational', difficulty: 'low' },
  { niche: 'wfh_rto', keyword: 'business casual after years remote', intent: 'informational', difficulty: 'low' },
  { niche: 'wfh_rto', keyword: 'rto wardrobe rebuild', intent: 'informational', difficulty: 'low' },

  // postpartum — dressing after having a baby
  { niche: 'postpartum', keyword: 'postpartum outfit ideas that fit', intent: 'informational', difficulty: 'low' },
  { niche: 'postpartum', keyword: 'dressing postpartum body confidence', intent: 'informational', difficulty: 'low' },
  { niche: 'postpartum', keyword: 'stylish nursing friendly outfits', intent: 'informational', difficulty: 'low' },
  { niche: 'postpartum', keyword: 'mom style after baby', intent: 'informational', difficulty: 'low' },

  // career_change — wardrobe for a new career
  { niche: 'career_change', keyword: 'what to wear first day new career', intent: 'informational', difficulty: 'low' },
  { niche: 'career_change', keyword: 'professional wardrobe career change budget', intent: 'informational', difficulty: 'low' },
  { niche: 'career_change', keyword: 'interview outfit career pivot', intent: 'informational', difficulty: 'low' },
  { niche: 'career_change', keyword: 'dressing for a new industry', intent: 'informational', difficulty: 'low' },

  // reinvention — midlife style reset
  { niche: 'reinvention', keyword: 'finding style again after 40', intent: 'informational', difficulty: 'low' },
  { niche: 'reinvention', keyword: 'wardrobe reset new chapter', intent: 'informational', difficulty: 'low' },
  { niche: 'reinvention', keyword: 'updating wardrobe after kids leave', intent: 'informational', difficulty: 'low' },
  { niche: 'reinvention', keyword: 'style refresh midlife', intent: 'informational', difficulty: 'low' },
];

async function seedRushKeywords(): Promise<void> {
  for (const seed of RUSH_KEYWORD_SEEDS) {
    await prisma.targetKeyword.upsert({
      where: { keyword: seed.keyword },
      update: {},
      create: {
        keyword: seed.keyword,
        niche: 'rush',
        intent: seed.intent,
        difficulty: seed.difficulty,
        status: 'identified',
      },
    });
  }
  console.log(`[SeoIntelligence] Seeded ${RUSH_KEYWORD_SEEDS.length} rush keywords`);
}

async function seedTransitionNicheKeywords(): Promise<void> {
  for (const seed of TRANSITION_NICHE_SEEDS) {
    await prisma.targetKeyword.upsert({
      where: { keyword: seed.keyword },
      update: {},
      create: {
        keyword: seed.keyword,
        niche: seed.niche,
        intent: seed.intent,
        difficulty: seed.difficulty,
        status: 'identified',
      },
    });
  }
  console.log(`[SeoIntelligence] Seeded ${TRANSITION_NICHE_SEEDS.length} transition niche keywords across 6 niches`);
}

// ─── Runner ───────────────────────────────────────────────────────────────────

export async function runSeoIntelligence(): Promise<void> {
  console.log('[SeoIntelligence] Starting run...');

  const budgetOk = await hasLearningBudget(3);
  if (!budgetOk) {
    console.log('[SeoIntelligence] Insufficient token budget — skipping');
    return;
  }

  // Ensure all keyword seeds exist
  await seedRushKeywords();
  await seedTransitionNicheKeywords();

  const now = new Date();
  const year = now.getFullYear();
  const week = Math.ceil(((now.getTime() - new Date(year, 0, 1).getTime()) / 86400000 + new Date(year, 0, 1).getDay() + 1) / 7);
  const period = `${year}-W${String(week).padStart(2, '0')}`;

  // 1. Fetch GSC data
  const rows = await fetchSearchAnalytics(28);
  console.log(`[SeoIntelligence] Fetched ${rows.length} GSC rows`);

  // 1b. Write GSC performance data back to TargetKeyword rows
  if (rows.length > 0) {
    try {
      const allKeywords = await prisma.targetKeyword.findMany({ select: { id: true, keyword: true } });
      const kwMap = new Map(allKeywords.map(k => [k.keyword.toLowerCase(), k.id]));
      let updated = 0;
      for (const row of rows) {
        const kwId = kwMap.get(row.query.toLowerCase());
        if (kwId) {
          await prisma.targetKeyword.update({
            where: { id: kwId },
            data: { impressions: row.impressions, clicks: row.clicks, currentPosition: row.position },
          }).catch(() => {});
          updated++;
        }
      }
      console.log(`[SeoIntelligence] GSC writeback: ${updated} keyword(s) updated`);
    } catch (err) {
      console.error('[SeoIntelligence] GSC writeback failed:', err);
    }
  }

  // 2. Identify opportunities
  const opps = await identifyKeywordOpportunities(rows);

  // 3. Discover niche keywords — real SERP data (Serper) or Gemini grounding fallback
  const [rushKeywords, trendingKeywords] = await Promise.all([
    discoverNicheKeywords('sorority rush week outfit'),
    discoverTrendingKeywords('sorority rush outfits'),
  ]);
  const allDiscovered = [...new Set([...rushKeywords, ...trendingKeywords])];
  for (const kw of allDiscovered.slice(0, 15)) {
    await prisma.targetKeyword.create({
      data: {
        keyword: kw,
        niche: 'rush',
        intent: 'informational',
        difficulty: 'low',
        status: 'identified',
      },
    }).catch(() => {}); // ignore duplicate keyword constraint errors
  }
  console.log(`[SeoIntelligence] Discovered ${allDiscovered.length} new keyword candidates (${rushKeywords.length} SERP + ${trendingKeywords.length} trending)`);

  // 3b. Discover transition niche keywords — one Serper call per niche seed phrase
  const transitionNicheSeeds: Array<{ niche: string; seed: string }> = [
    { niche: 'sahm_rto',       seed: 'stay at home mom returning to work outfits' },
    { niche: 'dating_restart', seed: 'what to wear first date after divorce' },
    { niche: 'wfh_rto',        seed: 'return to office outfit ideas 2026' },
    { niche: 'postpartum',     seed: 'postpartum outfit ideas that fit' },
    { niche: 'career_change',  seed: 'what to wear first day new career' },
    { niche: 'reinvention',    seed: 'finding style again after 40' },
  ];
  if (process.env.SERPER_API_KEY) {
    for (const { niche, seed } of transitionNicheSeeds) {
      try {
        const result = await searchSerper(seed, 10);
        const discovered = [
          ...result.relatedSearches.map(r => r.query).filter(Boolean),
          ...result.peopleAlsoAsk.map(r => r.question).filter(Boolean),
        ];
        let added = 0;
        for (const kw of discovered.slice(0, 8)) {
          await prisma.targetKeyword.create({
            data: { keyword: kw.toLowerCase(), niche, intent: 'informational', difficulty: 'low', status: 'identified' },
          }).catch(() => {}); // ignore duplicate
          added++;
        }
        console.log(`[SeoIntelligence] ${niche}: discovered ${added} keywords via Serper`);
        await new Promise(r => setTimeout(r, 300));
      } catch (err) {
        console.error(`[SeoIntelligence] Transition niche discovery failed for ${niche}:`, err);
      }
    }
  }

  // 4. PageSpeed checks
  const pagesToCheck = [
    `${SITE_URL}/rush`,
    `${SITE_URL}/learn`,
    SITE_URL,
  ];
  const pageSpeedResults = await Promise.all(pagesToCheck.map(checkPageSpeed));

  // 5. Generate report
  const report = await generateSeoReport(rows, opps, pageSpeedResults, period);

  // 6. Store SeoSnapshot
  try {
    await prisma.seoSnapshot.upsert({
      where: { period },
      update: {
        totalClicks: report.totalClicks,
        totalImpressions: report.totalImpressions,
        avgPosition: report.avgPosition,
        avgCtr: report.avgCtr,
        topQueries: report.topQueries as any,
        opportunities: report.opportunities as any,
        pageMetrics: pageSpeedResults as any,
      },
      create: {
        period,
        totalClicks: report.totalClicks,
        totalImpressions: report.totalImpressions,
        avgPosition: report.avgPosition,
        avgCtr: report.avgCtr,
        topQueries: report.topQueries as any,
        opportunities: report.opportunities as any,
        pageMetrics: pageSpeedResults as any,
      },
    });
    console.log(`[SeoIntelligence] Snapshot saved for ${period}`);
  } catch (err) {
    console.error('[SeoIntelligence] Failed to save snapshot:', err);
  }

  // 7. Publish to intelligence bus
  try {
    await publishToIntelligenceBus('seo-intelligence', 'seo_opportunities', {
      period,
      totalClicks: report.totalClicks,
      totalImpressions: report.totalImpressions,
      avgPosition: report.avgPosition,
      opportunities: opps.slice(0, 10),
      rushKeywordsTotal: RUSH_KEYWORD_SEEDS.length,
    });
  } catch (err) {
    console.error('[SeoIntelligence] Failed to publish to bus:', err);
  }

  // 8. Send email
  await sendSeoReportEmail(report);

  console.log('[SeoIntelligence] Done');
}

// ─── Query helpers (for founder brief etc.) ───────────────────────────────────

export async function getSeoSnapshot(period?: string): Promise<{ totalClicks: number; totalImpressions: number; avgPosition: number } | null> {
  try {
    const snapshot = period
      ? await prisma.seoSnapshot.findUnique({ where: { period } })
      : await prisma.seoSnapshot.findFirst({ orderBy: { createdAt: 'desc' } });
    if (!snapshot) return null;
    return {
      totalClicks: snapshot.totalClicks,
      totalImpressions: snapshot.totalImpressions,
      avgPosition: snapshot.avgPosition,
    };
  } catch {
    return null;
  }
}

export async function getRushKeywordProgress(): Promise<{ total: number; withContent: number; ranking: number }> {
  try {
    const [total, withContent, ranking] = await Promise.all([
      prisma.targetKeyword.count({ where: { niche: 'rush' } }),
      prisma.targetKeyword.count({ where: { niche: 'rush', status: 'content_created' } }),
      prisma.targetKeyword.count({ where: { niche: 'rush', currentPosition: { lt: 20 } } }),
    ]);
    return { total, withContent, ranking };
  } catch {
    return { total: 0, withContent: 0, ranking: 0 };
  }
}
