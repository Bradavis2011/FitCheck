/**
 * ASO Intelligence Agent
 *
 * Runs weekly (Tuesday 6am UTC). Analyzes keyword difficulty/traffic scores,
 * discovers competitors, and publishes results to the Intelligence Bus so all
 * downstream agents (founder-brief, social-content-engine, appstore-manager,
 * ops-learning) get smarter automatically.
 *
 * Library: aso-v2 (MIT, pure TypeScript, no API key needed)
 * Cost: $0/month — calls public store APIs directly
 */

import { ASO, ASOAnalyzer, type AppInfo, type ScoreResult } from 'aso-v2';
import { Resend } from 'resend';
import { prisma } from '../utils/prisma.js';
import { publishToIntelligenceBus, getLatestBusEntry } from './intelligence-bus.service.js';

// ─── Target Keywords ──────────────────────────────────────────────────────────

const TARGET_KEYWORDS = [
  'outfit feedback',
  'AI stylist',
  'style check',
  'fashion AI',
  'outfit rating',
  'what to wear',
  'personal stylist',
  'outfit ideas',
  'wardrobe helper',
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface AsoKeywordResult {
  keyword: string;
  store: string;
  difficulty: number;
  traffic: number;
  currentRank: number | null;
  rankChange: number | null;
}

interface AsoSummary {
  keywords: AsoKeywordResult[];
  topKeywords: string[];
  biggestMovers: { keyword: string; store: string; change: number }[];
  competitors: { appId: string; title: string; score?: number }[];
  measuredAt: string;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Read the latest ASO summary from the bus — used by founder-brief, social-content-engine, etc. */
export async function getAsoSummary(): Promise<AsoSummary | null> {
  const entry = await getLatestBusEntry('aso_metrics');
  if (!entry) return null;
  return entry.payload as unknown as AsoSummary;
}

/** Get top-traffic keywords as a hint string for prompt injection */
export async function getAsoKeywordHint(): Promise<string | null> {
  const summary = await getAsoSummary();
  if (!summary || summary.topKeywords.length === 0) return null;
  return summary.topKeywords.slice(0, 5).join(', ');
}

// ─── Main Runner ──────────────────────────────────────────────────────────────

export async function runAsoIntelligence(): Promise<void> {
  console.log('[AsoIntelligence] Starting weekly ASO intelligence run...');

  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  const recipient = process.env.REPORT_RECIPIENT_EMAIL;

  // App IDs for competitor discovery — optional, skip if not configured
  const gplayAppId = process.env.GOOGLE_PLAY_PACKAGE_NAME;
  const appleAppId = process.env.APPSTORE_APP_ID;

  const stores: Array<{ store: 'gplay' | 'itunes'; name: string; storeKey: string; appId?: string }> = [
    { store: 'gplay', name: 'Google Play', storeKey: 'google', appId: gplayAppId },
    { store: 'itunes', name: 'Apple App Store', storeKey: 'apple', appId: appleAppId },
  ];

  const results: AsoKeywordResult[] = [];
  const allCompetitors: AppInfo[] = [];

  for (const { store, name, storeKey, appId } of stores) {
    console.log(`[AsoIntelligence] Analyzing ${name}...`);
    const aso = new ASO(store);

    for (const keyword of TARGET_KEYWORDS) {
      try {
        const score: ScoreResult = await aso.analyzeKeyword(keyword);

        const difficultyScore = score.difficulty.score;
        const trafficScore = score.traffic.score;
        const currentRank = score.traffic.ranked.avgRank != null
          ? Math.round(score.traffic.ranked.avgRank)
          : null;

        // Look up prior snapshot for rank change calculation
        const prior = await prisma.asoSnapshot.findFirst({
          where: { keyword, store: storeKey },
          orderBy: { createdAt: 'desc' },
        });

        const rankChange = prior?.currentRank != null && currentRank != null
          ? currentRank - prior.currentRank  // positive = rank dropped, negative = improved
          : null;

        await prisma.asoSnapshot.create({
          data: {
            store: storeKey,
            keyword,
            difficulty: difficultyScore,
            traffic: trafficScore,
            currentRank,
            rankChange,
            competitors: undefined,
          },
        });

        results.push({ keyword, store: storeKey, difficulty: difficultyScore, traffic: trafficScore, currentRank, rankChange });

        console.log(`[AsoIntelligence] ${name} "${keyword}": difficulty=${difficultyScore.toFixed(1)}, traffic=${trafficScore.toFixed(1)}`);
      } catch (err) {
        console.error(`[AsoIntelligence] Failed to analyze keyword "${keyword}" on ${name}:`, err);
      }

      // Small delay between store API calls to avoid rate limits
      await new Promise(r => setTimeout(r, 800));
    }

    // Competitor discovery — only if app is live (has app ID configured)
    if (appId) {
      try {
        const similar = await aso.getSimilarApps(appId, false);
        allCompetitors.push(...similar.slice(0, 5));

        // Competitive gap analysis vs top 3 similar apps
        if (similar.length >= 3) {
          // Use top search result as proxy for our app in the keyword space
          const ownSearchResults = await aso.search({ term: 'outfit AI feedback', num: 1 });
          if (ownSearchResults.length > 0) {
            const gap = ASOAnalyzer.analyzeCompetitiveGap(ownSearchResults[0], similar.slice(0, 3));
            console.log(`[AsoIntelligence] ${name} competitive gap — advantages: ${gap.advantages.length}, opportunities: ${gap.opportunities.length}`);
          }
        }
      } catch (err) {
        console.error(`[AsoIntelligence] Failed to get similar apps on ${name}:`, err);
      }
    }
  }

  // Biggest rank changes (positive = dropped, negative = improved)
  const biggestMovers = results
    .filter(r => r.rankChange != null)
    .sort((a, b) => Math.abs(b.rankChange!) - Math.abs(a.rankChange!))
    .slice(0, 5)
    .map(r => ({ keyword: r.keyword, store: r.store, change: r.rankChange! }));

  // Top keywords by traffic score (deduplicated across stores)
  const seen = new Set<string>();
  const topKeywords = [...results]
    .sort((a, b) => b.traffic - a.traffic)
    .filter(r => { if (seen.has(r.keyword)) return false; seen.add(r.keyword); return true; })
    .slice(0, 5)
    .map(r => r.keyword);

  const competitorsSummary = allCompetitors.slice(0, 10).map(c => ({
    appId: c.appId,
    title: c.title,
    score: c.score,
  }));

  const payload: AsoSummary = {
    keywords: results,
    topKeywords,
    biggestMovers,
    competitors: competitorsSummary,
    measuredAt: new Date().toISOString(),
  };

  // Publish to Intelligence Bus (14-day TTL)
  await publishToIntelligenceBus('aso-intelligence', 'aso_metrics', payload as unknown as Record<string, unknown>);
  console.log(`[AsoIntelligence] Published aso_metrics to bus — ${results.length} keyword scores`);

  // Send founder email report
  if (resend && recipient) {
    try {
      const html = buildAsoEmail(results, topKeywords, biggestMovers, allCompetitors);
      await resend.emails.send({
        from: process.env.REPORT_FROM_EMAIL || 'aso@orthis.app',
        to: recipient,
        subject: `Or This? ASO Intelligence — ${results.length} keywords analyzed (${topKeywords[0] || 'no data'} is top traffic)`,
        html,
      });
      console.log('[AsoIntelligence] ASO report email sent');
    } catch (err) {
      console.error('[AsoIntelligence] Failed to send ASO email:', err);
    }
  }

  console.log(`[AsoIntelligence] Done — ${results.length} keyword scores, ${allCompetitors.length} competitors discovered`);
}

// ─── Email Builder ────────────────────────────────────────────────────────────

function buildAsoEmail(
  results: AsoKeywordResult[],
  topKeywords: string[],
  biggestMovers: { keyword: string; store: string; change: number }[],
  competitors: AppInfo[],
): string {
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const keywordRows = results.map(r => {
    const changeHtml = r.rankChange != null
      ? r.rankChange < 0
        ? `<span style="color:#10B981;font-size:12px;">▲ ${Math.abs(r.rankChange)} positions</span>`
        : r.rankChange > 0
          ? `<span style="color:#EF4444;font-size:12px;">▼ ${r.rankChange} positions</span>`
          : `<span style="color:#6B7280;font-size:12px;">— flat</span>`
      : '<span style="color:#6B7280;font-size:12px;">new</span>';

    const diffColor = r.difficulty < 40 ? '#10B981' : r.difficulty < 70 ? '#F59E0B' : '#EF4444';
    const trafficColor = r.traffic >= 60 ? '#10B981' : r.traffic >= 30 ? '#F59E0B' : '#6B7280';

    return `<tr>
      <td style="padding:7px 10px;font-size:13px;color:#1A1A1A;">${r.keyword}</td>
      <td style="padding:7px 10px;font-size:12px;color:#6B7280;">${r.store === 'google' ? 'Play' : 'iOS'}</td>
      <td style="padding:7px 10px;text-align:center;font-size:13px;color:${diffColor};font-weight:600;">${r.difficulty.toFixed(0)}</td>
      <td style="padding:7px 10px;text-align:center;font-size:13px;color:${trafficColor};font-weight:600;">${r.traffic.toFixed(0)}</td>
      <td style="padding:7px 10px;text-align:center;font-size:12px;">${changeHtml}</td>
    </tr>`;
  }).join('');

  const moverBlock = biggestMovers.length > 0
    ? `<div style="margin-bottom:24px;">
        <div style="font-size:13px;font-weight:600;color:#E85D4C;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Biggest Rank Movers</div>
        <div style="background:#FBF7F4;border-radius:8px;padding:12px 16px;">
          ${biggestMovers.map(m => {
            const dir = m.change < 0 ? '▲ improved' : '▼ dropped';
            const col = m.change < 0 ? '#10B981' : '#EF4444';
            return `<div style="font-size:13px;margin-bottom:4px;">${m.keyword} (${m.store === 'google' ? 'Play' : 'iOS'}): <span style="color:${col};">${dir} ${Math.abs(m.change)} positions</span></div>`;
          }).join('')}
        </div>
      </div>`
    : '';

  const competitorBlock = competitors.length > 0
    ? `<div>
        <div style="font-size:13px;font-weight:600;color:#E85D4C;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Competitors Discovered</div>
        <table width="100%" style="border-collapse:collapse;">
          <thead><tr style="background:#F5EDE7;">
            <th style="padding:7px 10px;text-align:left;font-size:12px;color:#6B7280;">App</th>
            <th style="padding:7px 10px;text-align:left;font-size:12px;color:#6B7280;">Rating</th>
          </tr></thead>
          <tbody>${competitors.slice(0, 6).map(c => `
            <tr>
              <td style="padding:7px 10px;font-size:13px;">${c.title}</td>
              <td style="padding:7px 10px;font-size:13px;color:#6B7280;">${c.score != null ? `${c.score.toFixed(1)} ⭐` : '—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`
    : '';

  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#FBF7F4;padding:40px;">
    <div style="max-width:660px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
      <div style="background:linear-gradient(135deg,#E85D4C,#FF7A6B);padding:28px 40px;text-align:center;">
        <div style="font-size:26px;font-weight:700;color:#fff;">Or This?</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.8);margin-top:4px;">Weekly ASO Intelligence Report</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:6px;">${dateStr}</div>
      </div>
      <div style="padding:32px 40px;">

        ${topKeywords.length > 0 ? `
        <div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:10px;padding:14px 18px;margin-bottom:24px;">
          <div style="font-size:12px;font-weight:600;color:#10B981;margin-bottom:6px;">TOP TRAFFIC KEYWORDS</div>
          <div style="font-size:14px;color:#1A1A1A;">${topKeywords.join(' · ')}</div>
        </div>` : ''}

        <div style="font-size:13px;font-weight:600;color:#E85D4C;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Keyword Analysis</div>
        <table width="100%" style="border-collapse:collapse;margin-bottom:24px;">
          <thead><tr style="background:#F5EDE7;">
            <th style="padding:7px 10px;text-align:left;font-size:12px;color:#6B7280;">Keyword</th>
            <th style="padding:7px 10px;text-align:left;font-size:12px;color:#6B7280;">Store</th>
            <th style="padding:7px 10px;text-align:center;font-size:12px;color:#6B7280;">Difficulty</th>
            <th style="padding:7px 10px;text-align:center;font-size:12px;color:#6B7280;">Traffic</th>
            <th style="padding:7px 10px;text-align:center;font-size:12px;color:#6B7280;">Rank Δ</th>
          </tr></thead>
          <tbody>${keywordRows}</tbody>
        </table>

        ${moverBlock}
        ${competitorBlock}

      </div>
      <div style="background:#F5EDE7;padding:16px 40px;text-align:center;">
        <p style="color:#6B7280;font-size:12px;margin:0;">Or This? · ASO Intelligence Agent · ${new Date().toISOString()}</p>
      </div>
    </div>
  </body></html>`;
}
