/**
 * Keyword Discovery Script
 *
 * Seeds all niche keyword lists, runs Serper.dev discovery for each niche,
 * writes discovered keywords to the DB, and prints a verdict table.
 *
 * Usage:
 *   npm run keywords:discover
 *   # or directly:
 *   npx tsx scripts/keyword-discovery.ts
 *
 * Requires SERPER_API_KEY in fitcheck-api/.env
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Types ────────────────────────────────────────────────────────────────────

interface SerperResult {
  peopleAlsoAsk: Array<{ question: string }>;
  relatedSearches: Array<{ query: string }>;
}

// ─── Serper helper ────────────────────────────────────────────────────────────

async function serper(query: string): Promise<SerperResult> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) throw new Error('SERPER_API_KEY not set in .env');

  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query, num: 10 }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Serper ${res.status}: ${await res.text()}`);

  const data = await res.json() as {
    peopleAlsoAsk?: Array<{ question?: string }>;
    relatedSearches?: Array<{ query?: string }>;
  };

  return {
    peopleAlsoAsk: (data.peopleAlsoAsk ?? []).map(r => ({ question: r.question ?? '' })).filter(r => r.question),
    relatedSearches: (data.relatedSearches ?? []).map(r => ({ query: r.query ?? '' })).filter(r => r.query),
  };
}

// ─── Seed data ────────────────────────────────────────────────────────────────

type Seed = { keyword: string; intent: 'transactional' | 'informational'; difficulty: 'low' | 'medium' | 'high' };
type NicheConfig = {
  niche: string;
  label: string;
  seeds: Seed[];
  discoveryQuery: string; // primary query sent to Serper for discovery
};

const NICHES: NicheConfig[] = [
  {
    niche: 'rush',
    label: 'Sorority Rush',
    discoveryQuery: 'sorority rush outfit ideas 2026',
    seeds: [
      { keyword: 'what to wear to sorority rush open house',      intent: 'informational', difficulty: 'low' },
      { keyword: 'philanthropy round outfit ideas',               intent: 'informational', difficulty: 'low' },
      { keyword: 'sisterhood round outfit sorority rush',         intent: 'informational', difficulty: 'low' },
      { keyword: 'what to wear to preference night sorority',     intent: 'informational', difficulty: 'low' },
      { keyword: 'bid day outfit ideas sorority',                 intent: 'informational', difficulty: 'low' },
      { keyword: 'sorority rush outfit ideas 2026',              intent: 'informational', difficulty: 'medium' },
      { keyword: 'what to wear to sorority recruitment',         intent: 'informational', difficulty: 'medium' },
      { keyword: 'rush week outfits',                            intent: 'informational', difficulty: 'medium' },
      { keyword: 'sorority rush dress code',                     intent: 'informational', difficulty: 'low' },
      { keyword: 'what not to wear to sorority rush',            intent: 'informational', difficulty: 'low' },
      { keyword: 'what does business casual mean for rush',      intent: 'informational', difficulty: 'low' },
      { keyword: 'can you wear jeans to sorority rush',          intent: 'informational', difficulty: 'low' },
      { keyword: 'how many outfits do you need for rush week',   intent: 'informational', difficulty: 'low' },
      { keyword: 'sorority rush outfit on a budget',             intent: 'transactional', difficulty: 'low' },
      { keyword: 'what to wear to rush at alabama',              intent: 'informational', difficulty: 'low' },
      { keyword: 'ole miss sorority rush outfits',               intent: 'informational', difficulty: 'low' },
      { keyword: 'sorority rush outfits SEC schools',            intent: 'informational', difficulty: 'low' },
    ],
  },
  {
    niche: 'sahm_rto',
    label: 'SAHM → Back to Work',
    discoveryQuery: 'stay at home mom returning to work outfits',
    seeds: [
      { keyword: 'stay at home mom returning to work outfits',          intent: 'informational', difficulty: 'low' },
      { keyword: 'what to wear first day back at work after kids',      intent: 'informational', difficulty: 'low' },
      { keyword: 'rebuilding professional wardrobe mom',                intent: 'informational', difficulty: 'low' },
      { keyword: 'sahm to working mom style',                           intent: 'informational', difficulty: 'low' },
    ],
  },
  {
    niche: 'dating_restart',
    label: 'Dating After Divorce',
    discoveryQuery: 'what to wear first date after divorce',
    seeds: [
      { keyword: 'what to wear first date after divorce',       intent: 'informational', difficulty: 'low' },
      { keyword: 'dating again outfit ideas over 30',           intent: 'informational', difficulty: 'low' },
      { keyword: 'rebuilding confidence style after breakup',   intent: 'informational', difficulty: 'low' },
      { keyword: 'first date outfit single mom',                intent: 'informational', difficulty: 'low' },
    ],
  },
  {
    niche: 'wfh_rto',
    label: 'WFH → Return to Office',
    discoveryQuery: 'return to office outfit ideas 2026',
    seeds: [
      { keyword: 'return to office outfit ideas 2026',                          intent: 'informational', difficulty: 'medium' },
      { keyword: 'what to wear back to office after working from home',          intent: 'informational', difficulty: 'low' },
      { keyword: 'business casual after years remote',                           intent: 'informational', difficulty: 'low' },
      { keyword: 'rto wardrobe rebuild',                                         intent: 'informational', difficulty: 'low' },
    ],
  },
  {
    niche: 'postpartum',
    label: 'Postpartum Style',
    discoveryQuery: 'postpartum outfit ideas that fit',
    seeds: [
      { keyword: 'postpartum outfit ideas that fit',           intent: 'informational', difficulty: 'low' },
      { keyword: 'dressing postpartum body confidence',        intent: 'informational', difficulty: 'low' },
      { keyword: 'stylish nursing friendly outfits',           intent: 'informational', difficulty: 'low' },
      { keyword: 'mom style after baby',                       intent: 'informational', difficulty: 'low' },
    ],
  },
  {
    niche: 'career_change',
    label: 'Career Change',
    discoveryQuery: 'what to wear first day new career',
    seeds: [
      { keyword: 'what to wear first day new career',                  intent: 'informational', difficulty: 'low' },
      { keyword: 'professional wardrobe career change budget',          intent: 'informational', difficulty: 'low' },
      { keyword: 'interview outfit career pivot',                       intent: 'informational', difficulty: 'low' },
      { keyword: 'dressing for a new industry',                         intent: 'informational', difficulty: 'low' },
    ],
  },
  {
    niche: 'reinvention',
    label: 'Midlife Reinvention',
    discoveryQuery: 'finding style again after 40',
    seeds: [
      { keyword: 'finding style again after 40',       intent: 'informational', difficulty: 'low' },
      { keyword: 'wardrobe reset new chapter',         intent: 'informational', difficulty: 'low' },
      { keyword: 'updating wardrobe after kids leave', intent: 'informational', difficulty: 'low' },
      { keyword: 'style refresh midlife',              intent: 'informational', difficulty: 'low' },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pad(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : str + ' '.repeat(len - str.length);
}

function verdict(paaCount: number, relatedCount: number): string {
  const score = paaCount + relatedCount;
  if (score >= 12) return '✅ PROCEED';
  if (score >= 6)  return '⚠️  REVIEW';
  return '❌ SPARSE';
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n🔍 Or This? Keyword Discovery\n' + '─'.repeat(70));

  if (!process.env.SERPER_API_KEY) {
    console.error('❌ SERPER_API_KEY not set in fitcheck-api/.env — add it and retry');
    process.exit(1);
  }

  const results: Array<{
    niche: string;
    label: string;
    seeded: number;
    paa: number;
    related: number;
    discovered: number;
    verdict: string;
  }> = [];

  for (const config of NICHES) {
    process.stdout.write(`\n[${config.label}] Seeding ${config.seeds.length} keywords...`);

    // Seed hardcoded keywords
    for (const seed of config.seeds) {
      await prisma.targetKeyword.upsert({
        where: { keyword: seed.keyword },
        update: {},
        create: {
          keyword: seed.keyword,
          niche: config.niche,
          intent: seed.intent,
          difficulty: seed.difficulty,
          status: 'identified',
        },
      });
    }

    process.stdout.write(` done. Running Serper...`);

    // Serper discovery
    let paaCount = 0;
    let relatedCount = 0;
    let newKeywords = 0;

    try {
      const serperResult = await serper(config.discoveryQuery);
      paaCount = serperResult.peopleAlsoAsk.length;
      relatedCount = serperResult.relatedSearches.length;

      const discovered = [
        ...serperResult.peopleAlsoAsk.map(r => r.question),
        ...serperResult.relatedSearches.map(r => r.query),
      ];

      for (const kw of discovered) {
        const created = await prisma.targetKeyword.upsert({
          where: { keyword: kw.toLowerCase() },
          update: {},
          create: {
            keyword: kw.toLowerCase(),
            niche: config.niche,
            intent: 'informational',
            difficulty: 'low',
            status: 'identified',
          },
        });
        // upsert always returns the record; check if it was created by checking createdAt ≈ now
        const age = Date.now() - new Date(created.createdAt).getTime();
        if (age < 5000) newKeywords++;
      }

      process.stdout.write(` ${paaCount} PAA, ${relatedCount} related, ${newKeywords} new.\n`);
    } catch (err) {
      process.stdout.write(` FAILED: ${(err as Error).message}\n`);
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 400));

    results.push({
      niche: config.niche,
      label: config.label,
      seeded: config.seeds.length,
      paa: paaCount,
      related: relatedCount,
      discovered: newKeywords,
      verdict: verdict(paaCount, relatedCount),
    });
  }

  // ── Summary table ────────────────────────────────────────────────────────

  console.log('\n\n' + '─'.repeat(70));
  console.log('VERDICT TABLE\n');
  console.log(
    pad('Niche', 22) +
    pad('PAA', 6) +
    pad('Related', 9) +
    pad('New KWs', 9) +
    'Verdict'
  );
  console.log('─'.repeat(70));

  for (const r of results) {
    console.log(
      pad(r.label, 22) +
      pad(String(r.paa), 6) +
      pad(String(r.related), 9) +
      pad(String(r.discovered), 9) +
      r.verdict
    );
  }

  console.log('─'.repeat(70));
  console.log('\nPAA = People Also Ask questions (richness signal)');
  console.log('Related = Related Searches returned by Google');
  console.log('✅ PROCEED (≥12 signals) · ⚠️  REVIEW (6-11) · ❌ SPARSE (<6)\n');

  // Total counts in DB
  const totals = await prisma.targetKeyword.groupBy({
    by: ['niche'],
    _count: { id: true },
    where: { niche: { in: NICHES.map(n => n.niche) } },
  });
  console.log('DB totals after discovery:');
  for (const t of totals) {
    console.log(`  ${pad(t.niche, 20)} ${t._count.id} keywords`);
  }
  console.log('');

  await prisma.$disconnect();
}

run().catch(err => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
