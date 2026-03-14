/**
 * SEO Content Pipeline Diagnostic
 *
 * Checks all gates in the content generation pipeline and prints a status table.
 * Run via: railway run npx tsx scripts/diagnose-pipeline.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function pad(str: string, len: number): string {
  const s = String(str);
  return s.length >= len ? s.slice(0, len) : s + ' '.repeat(len - s.length);
}

type GateStatus = 'OK' | 'WARN' | 'FAIL' | 'SKIP';

interface Gate {
  name: string;
  status: GateStatus;
  detail: string;
}

const gates: Gate[] = [];

function gate(name: string, status: GateStatus, detail: string) {
  gates.push({ name, detail, status });
}

function icon(s: GateStatus) {
  return s === 'OK' ? '✅' : s === 'WARN' ? '⚠️ ' : s === 'SKIP' ? '⏭️ ' : '❌';
}

// ─── Gate 1: ENABLE_CRON ──────────────────────────────────────────────────────

const ENABLE_CRON = process.env.ENABLE_CRON;
if (ENABLE_CRON === 'true') {
  gate('ENABLE_CRON', 'OK', `= "${ENABLE_CRON}"`);
} else {
  gate('ENABLE_CRON', 'FAIL', `= "${ENABLE_CRON ?? 'unset'}" — master kill switch OFF. Set ENABLE_CRON=true on Railway.`);
}

// ─── Gate 2: ENABLE_LEARNING_SYSTEM ──────────────────────────────────────────

const ENABLE_LEARNING = process.env.ENABLE_LEARNING_SYSTEM;
if (ENABLE_LEARNING === 'false') {
  gate('ENABLE_LEARNING_SYSTEM', 'FAIL', `= "false" — hasLearningBudget() always returns false. Set ENABLE_LEARNING_SYSTEM=true.`);
} else {
  gate('ENABLE_LEARNING_SYSTEM', 'OK', `= "${ENABLE_LEARNING ?? 'unset (defaults to enabled)'}" — learning system enabled`);
}

// ─── Gate 3: GEMINI_API_KEY ───────────────────────────────────────────────────

const GEMINI_KEY = process.env.GEMINI_API_KEY;
if (GEMINI_KEY && GEMINI_KEY.length > 10) {
  gate('GEMINI_API_KEY', 'OK', `set (${GEMINI_KEY.slice(0, 8)}...)`);
} else {
  gate('GEMINI_API_KEY', 'FAIL', `not set — article generation will fail silently`);
}

// ─── Gate 4: SERPER_API_KEY ───────────────────────────────────────────────────

const SERPER_KEY = process.env.SERPER_API_KEY;
if (SERPER_KEY && SERPER_KEY.length > 5) {
  gate('SERPER_API_KEY', 'OK', `set (${SERPER_KEY.slice(0, 8)}...)`);
} else {
  gate('SERPER_API_KEY', 'WARN', `not set — articles generated without SERP enrichment (still works, just weaker)`);
}

// ─── Gate 5: DAILY_TOKEN_BUDGET ──────────────────────────────────────────────

const DAILY_BUDGET = parseInt(process.env.DAILY_TOKEN_BUDGET || '500000');
if (DAILY_BUDGET >= 100000) {
  gate('DAILY_TOKEN_BUDGET', 'OK', `= ${DAILY_BUDGET.toLocaleString()} tokens/day`);
} else {
  gate('DAILY_TOKEN_BUDGET', 'WARN', `= ${DAILY_BUDGET.toLocaleString()} — very low, may block article generation (4000 tokens each)`);
}

// ─── DB checks ────────────────────────────────────────────────────────────────

async function runDbChecks() {
  // Gate 6: DB connectivity
  try {
    await prisma.$queryRaw`SELECT 1`;
    gate('DB connectivity', 'OK', 'PostgreSQL connection successful');
  } catch (err) {
    gate('DB connectivity', 'FAIL', `Cannot connect to DB: ${(err as Error).message}`);
    return; // no point continuing
  }

  // Gate 7: AgentConfig — seo-content
  const seoContentConfig = await prisma.agentConfig.findFirst({
    where: { name: 'seo-content' },
  }).catch(() => null);

  if (!seoContentConfig) {
    gate('AgentConfig: seo-content', 'WARN', 'No row found — agent will use defaults (enabled=true)');
  } else if (!seoContentConfig.enabled) {
    gate('AgentConfig: seo-content', 'FAIL', `Agent disabled in DB — executeOrQueue will reject all publish_draft actions`);
  } else {
    gate('AgentConfig: seo-content', 'OK', `enabled=true, riskLevel=${seoContentConfig.defaultRiskLevel ?? 'default'}`);
  }

  // Gate 8: AgentConfig — seo-intelligence
  const seoIntelConfig = await prisma.agentConfig.findFirst({
    where: { name: 'seo-intelligence' },
  }).catch(() => null);

  if (!seoIntelConfig) {
    gate('AgentConfig: seo-intelligence', 'WARN', 'No row found — uses defaults');
  } else if (!seoIntelConfig.enabled) {
    gate('AgentConfig: seo-intelligence', 'FAIL', 'Agent disabled in DB');
  } else {
    gate('AgentConfig: seo-intelligence', 'OK', 'enabled=true');
  }

  // Gate 9: TargetKeyword — identified count
  const kwGroups = await prisma.targetKeyword.groupBy({
    by: ['status'],
    _count: { id: true },
  }).catch(() => []);

  const kwByStatus: Record<string, number> = {};
  for (const g of kwGroups) kwByStatus[g.status] = g._count.id;
  const totalKw = Object.values(kwByStatus).reduce((s, n) => s + n, 0);
  const identifiedKw = kwByStatus['identified'] ?? 0;

  if (identifiedKw === 0 && totalKw === 0) {
    gate('TargetKeyword seeds', 'FAIL', `0 keywords in DB at all — run: railway run npx tsx scripts/keyword-discovery.ts`);
  } else if (identifiedKw === 0) {
    gate('TargetKeyword seeds', 'WARN', `${totalKw} total keywords but 0 with status=identified (all used up or wrong status)`);
  } else {
    gate('TargetKeyword seeds', 'OK', `${identifiedKw} identified / ${totalKw} total (${JSON.stringify(kwByStatus)})`);
  }

  // Gate 10: BlogDraft status breakdown
  const draftGroups = await prisma.blogDraft.groupBy({
    by: ['status'],
    _count: { id: true },
  }).catch(() => []);

  const draftsByStatus: Record<string, number> = {};
  for (const g of draftGroups) draftsByStatus[g.status] = g._count.id;
  const publishedCount = draftsByStatus['published'] ?? 0;
  const pendingCount = draftsByStatus['pending_review'] ?? 0;

  if (publishedCount === 0 && pendingCount > 0) {
    gate('BlogDraft status', 'WARN', `0 published, ${pendingCount} stuck in pending_review — brand guard may be blocking, or AgentConfig disabled`);
  } else if (publishedCount === 0) {
    gate('BlogDraft status', 'WARN', `No drafts at all — pipeline never ran or all failed silently`);
  } else {
    gate('BlogDraft status', 'OK', `${publishedCount} published — ${JSON.stringify(draftsByStatus)}`);
  }

  // Gate 11: AgentAction — stuck or rejected actions
  const recentActions = await prisma.agentAction.findMany({
    where: {
      agent: { in: ['seo-content', 'seo-intelligence'] },
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { agent: true, actionType: true, status: true, createdAt: true, rejectionReason: true },
  }).catch(() => []);

  const actionsByStatus: Record<string, number> = {};
  for (const a of recentActions) actionsByStatus[a.status] = (actionsByStatus[a.status] ?? 0) + 1;
  const rejectedActions = recentActions.filter(a => a.status === 'rejected');

  if (recentActions.length === 0) {
    gate('AgentAction (7d)', 'WARN', 'No agent actions in last 7 days — cron may not be running (check ENABLE_CRON)');
  } else if (rejectedActions.length > 0) {
    const reason = rejectedActions[0].rejectionReason ?? 'no reason stored';
    gate('AgentAction (7d)', 'WARN', `${recentActions.length} actions (${JSON.stringify(actionsByStatus)}). Latest rejection: "${reason}"`);
  } else {
    gate('AgentAction (7d)', 'OK', `${recentActions.length} actions: ${JSON.stringify(actionsByStatus)}`);
  }

  // Gate 12: DailyTokenUsage — last 7 days
  const tokenRows = await prisma.dailyTokenUsage.findMany({
    orderBy: { date: 'desc' },
    take: 7,
    select: { date: true, budget: true, learningBudget: true, learningUsed: true },
  }).catch(() => []);

  if (tokenRows.length === 0) {
    gate('DailyTokenUsage', 'WARN', 'No rows — token budget tracking has not started (will self-create on first call)');
  } else {
    const today = tokenRows[0];
    const used = today.learningUsed ?? 0;
    const budget = today.learningBudget ?? DAILY_BUDGET;
    const pct = budget > 0 ? Math.round((used / budget) * 100) : 0;
    gate('DailyTokenUsage', 'OK', `Today: ${used.toLocaleString()} / ${budget.toLocaleString()} tokens used (${pct}%)`);
  }

  // Gate 13: hasLearningBudget check — priority 3 needed for blitz
  if (ENABLE_LEARNING !== 'false' && tokenRows.length > 0) {
    const today = tokenRows[0];
    const learningBudget = today.learningBudget ?? 0;
    const learningUsed = today.learningUsed ?? 0;
    const remaining = learningBudget - learningUsed;
    const THRESHOLD_P3 = 180_000;

    if (remaining >= THRESHOLD_P3) {
      gate('Budget gate (priority 3)', 'OK', `${remaining.toLocaleString()} tokens remaining ≥ threshold of ${THRESHOLD_P3.toLocaleString()}`);
    } else {
      gate('Budget gate (priority 3)', 'WARN', `Only ${remaining.toLocaleString()} tokens remaining — below priority-3 threshold of ${THRESHOLD_P3.toLocaleString()}. Blitz will skip.`);
    }
  } else if (ENABLE_LEARNING === 'false') {
    gate('Budget gate (priority 3)', 'SKIP', 'ENABLE_LEARNING_SYSTEM=false — hasLearningBudget always returns false');
  } else {
    gate('Budget gate (priority 3)', 'WARN', 'No DailyTokenUsage rows — cannot verify budget');
  }

  // Gate 14: Recent published articles (confirmation pipeline ever worked)
  const recentPublished = await prisma.blogDraft.findMany({
    where: { status: 'published' },
    orderBy: { publishedAt: 'desc' },
    take: 5,
    select: { title: true, slug: true, publishedAt: true, category: true },
  }).catch(() => []);

  if (recentPublished.length === 0) {
    gate('Published articles (recent)', 'FAIL', 'Zero published articles — pipeline has never successfully completed end-to-end');
  } else {
    const latest = recentPublished[0];
    const age = latest.publishedAt ? Math.round((Date.now() - new Date(latest.publishedAt).getTime()) / (1000 * 60 * 60 * 24)) : '?';
    gate('Published articles (recent)', 'OK', `${recentPublished.length} found. Latest: "${latest.title}" (${age} days ago)`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🔍 Or This? — SEO Content Pipeline Diagnostic');
  console.log('━'.repeat(80));

  await runDbChecks();

  const COL1 = 38;
  const COL2 = 7;

  console.log('\n' + pad('Gate', COL1) + pad('Status', COL2) + 'Detail');
  console.log('─'.repeat(80));

  let failCount = 0;
  let warnCount = 0;

  for (const g of gates) {
    if (g.status === 'FAIL') failCount++;
    if (g.status === 'WARN') warnCount++;
    console.log(pad(g.name, COL1) + pad(icon(g.status), COL2) + g.detail);
  }

  console.log('─'.repeat(80));

  if (failCount === 0 && warnCount === 0) {
    console.log('\n✅ All gates GREEN — pipeline should be running normally.\n');
  } else {
    console.log(`\n${failCount > 0 ? `❌ ${failCount} FAIL` : ''}${failCount > 0 && warnCount > 0 ? ', ' : ''}${warnCount > 0 ? `⚠️  ${warnCount} WARN` : ''} — fix the above issues to unblock content generation.\n`);
  }

  // Quick fix suggestions
  if (gates.find(g => g.name === 'ENABLE_CRON' && g.status === 'FAIL')) {
    console.log('  FIX: railway variables set ENABLE_CRON=true');
  }
  if (gates.find(g => g.name === 'ENABLE_LEARNING_SYSTEM' && g.status === 'FAIL')) {
    console.log('  FIX: railway variables set ENABLE_LEARNING_SYSTEM=true');
  }
  if (gates.find(g => g.name === 'GEMINI_API_KEY' && g.status === 'FAIL')) {
    console.log('  FIX: railway variables set GEMINI_API_KEY=<your-key>');
  }
  if (gates.find(g => g.name === 'TargetKeyword seeds' && g.status === 'FAIL')) {
    console.log('  FIX: railway run npx tsx scripts/keyword-discovery.ts');
  }
  if (gates.find(g => g.name === 'Published articles (recent)' && g.status === 'FAIL')) {
    console.log('  FIX: railway run npx tsx scripts/generate-content-now.ts');
  }
  console.log('');
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
