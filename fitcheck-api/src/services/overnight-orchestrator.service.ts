/**
 * Overnight Orchestrator
 *
 * Replaces implicit time-based ordering of learning crons with an explicit DAG.
 * Gated by ENABLE_ORCHESTRATOR=true (falls back to legacy individual crons if unset).
 *
 * Pipeline (midnight UTC):
 *   Budget Reset → Bus Purge → Piggyback Judge →
 *   [Learning Memory ∥ Critic] → Surgeon → FQI Check →
 *   Emergency Revert (if FQI dropped) → Multi-Loop Mutations → A/B Eval → Morning Brief
 *
 * Key improvements over individual crons:
 * - Explicit dependency graph (Critic waits for Piggyback, etc.)
 * - Retry on failure (each step retried once before proceeding)
 * - Multi-loop mutations — keeps experimenting until budget/time runs out
 * - FQI before/after — detects regressions and auto-reverts
 * - Morning brief email — wake up to a full summary of what happened
 */

import { Resend } from 'resend';
import { prisma } from '../utils/prisma.js';
import { resetDailyBudget, getTodayUsage, hasLearningBudget } from './token-budget.service.js';
import { purgeExpiredBusEntries, publishToIntelligenceBus, readFromIntelligenceBus } from './intelligence-bus.service.js';
import { runPiggybackJudge } from './arena.service.js';
import { distillLearningMemory } from './prompt-assembly.service.js';
import { runCriticAgent } from './critic-agent.service.js';
import { runSurgeonAgent, runProactiveMutationExported } from './surgeon-agent.service.js';
import { evaluateABTests, computeFQI, measurePromptPerformance, runStylistImprovementCycle } from './recursive-improvement.service.js';
import { getAgentHealth, isAgentEnabled, recordAgentRun } from './agent-manager.service.js';
import { measureRedditGrowthMetrics, measureCreatorFunnelMetrics } from './ops-learning.service.js';

// ─── Types ────────────────────────────────────────────────────────────────────

type StepStatus = 'success' | 'failed' | 'skipped';

interface StepResult {
  stepId: string;
  status: StepStatus;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  error: string | null;
  retried: boolean;
  output: Record<string, unknown>;
}

interface PipelineRun {
  runId: string;
  startedAt: Date;
  completedAt: Date | null;
  steps: StepResult[];
  fqiBefore: number | null;
  fqiAfter: number | null;
  fqiDelta: number | null;
  tokensConsumed: number;
  multiLoopCount: number;
  emergencyRevert: boolean;
  loopStopReason: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** UTC hour at which multi-loop mutations stop (protect user-traffic hours) */
const OVERNIGHT_DEADLINE_HOUR = 7;

/** FQI drop that triggers emergency revert */
const FQI_EMERGENCY_DROP = 0.05;

/** Token budget priority required for multi-loop mutations */
const MULTI_LOOP_PRIORITY = 2;

// ─── Step runner ─────────────────────────────────────────────────────────────

async function runStep(
  stepId: string,
  fn: () => Promise<Record<string, unknown>>,
  opts: { retryOnce?: boolean; agentName?: string } = {},
): Promise<StepResult> {
  const startedAt = new Date();
  let error: string | null = null;
  let retried = false;
  let output: Record<string, unknown> = {};
  let status: StepStatus = 'success';

  // Agent kill-switch check
  if (opts.agentName && !(await isAgentEnabled(opts.agentName).catch(() => true))) {
    const completedAt = new Date();
    return {
      stepId, status: 'skipped', startedAt, completedAt,
      durationMs: completedAt.getTime() - startedAt.getTime(),
      error: null, retried: false, output: { reason: 'agent_disabled' },
    };
  }

  const attempt = async () => { output = await fn(); };

  try {
    await attempt();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Orchestrator] Step "${stepId}" failed: ${msg}`);

    if (opts.retryOnce) {
      retried = true;
      console.log(`[Orchestrator] Retrying "${stepId}"...`);
      try {
        await attempt();
      } catch (retryErr) {
        error = retryErr instanceof Error ? retryErr.message : String(retryErr);
        status = 'failed';
      }
    } else {
      error = msg;
      status = 'failed';
    }
  }

  const completedAt = new Date();

  if (opts.agentName) {
    await recordAgentRun(opts.agentName, error ?? undefined).catch(() => {});
  }

  return {
    stepId, status, startedAt, completedAt,
    durationMs: completedAt.getTime() - startedAt.getTime(),
    error, retried, output,
  };
}

function skippedStep(stepId: string, reason: string): StepResult {
  const now = new Date();
  return {
    stepId, status: 'skipped', startedAt: now, completedAt: now,
    durationMs: 0, error: reason, retried: false, output: {},
  };
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

export async function runOvernightPipeline(): Promise<PipelineRun> {
  const pipeline: PipelineRun = {
    runId: crypto.randomUUID(),
    startedAt: new Date(),
    completedAt: null,
    steps: [],
    fqiBefore: null,
    fqiAfter: null,
    fqiDelta: null,
    tokensConsumed: 0,
    multiLoopCount: 0,
    emergencyRevert: false,
    loopStopReason: null,
  };

  console.log(`[Orchestrator] Pipeline started (${pipeline.runId})`);

  // Snapshot FQI and token usage before pipeline
  let tokensBefore = 0;
  try {
    const [metrics, usage] = await Promise.all([
      measurePromptPerformance(),
      getTodayUsage(),
    ]);
    pipeline.fqiBefore = computeFQI(metrics);
    tokensBefore = usage.learningTokens;
    console.log(`[Orchestrator] FQI before: ${pipeline.fqiBefore.toFixed(4)}`);
  } catch (err) {
    console.error('[Orchestrator] Pre-snapshot failed:', err);
  }

  // ── Step 1: Budget Reset ──────────────────────────────────────────────────
  pipeline.steps.push(await runStep('budget_reset', async () => {
    await resetDailyBudget();
    return { ok: true };
  }, { retryOnce: true }));

  // ── Step 2: Bus Purge ─────────────────────────────────────────────────────
  pipeline.steps.push(await runStep('bus_purge', async () => {
    const count = await purgeExpiredBusEntries();
    return { purgedCount: count };
  }, { retryOnce: true }));

  // ── Step 3: Piggyback Judge ───────────────────────────────────────────────
  const piggybackStep = await runStep('piggyback_judge', async () => {
    await runPiggybackJudge();
    return { ok: true };
  }, { retryOnce: true, agentName: 'piggyback-judge' });
  pipeline.steps.push(piggybackStep);
  const piggybackOk = piggybackStep.status === 'success';

  // ── Steps 4a + 4b: Learning Memory ∥ Critic (parallel) ───────────────────
  let criticOk = false;
  if (piggybackOk) {
    const [memoryStep, criticStep] = await Promise.all([
      runStep('learning_memory', async () => {
        const text = await distillLearningMemory();
        return { chars: text.length };
      }, { retryOnce: true, agentName: 'learning-memory' }),

      runStep('critic', async () => {
        const result = await runCriticAgent();
        return result
          ? { topSection: result.topSection, weaknesses: result.weaknesses.length }
          : { message: 'no weaknesses found or budget exhausted' };
      }, { retryOnce: true, agentName: 'critic-agent' }),
    ]);
    pipeline.steps.push(memoryStep, criticStep);
    criticOk = criticStep.status === 'success';
    const memoryOk = memoryStep.status === 'success';

    // ── Step 5: Surgeon (depends on critic + memory) ──────────────────────
    if (criticOk || memoryOk) {
      pipeline.steps.push(await runStep('surgeon', async () => {
        await runSurgeonAgent();
        return { ok: true };
      }, { retryOnce: true, agentName: 'surgeon' }));
    } else {
      pipeline.steps.push(skippedStep('surgeon', 'both critic and learning_memory failed'));
    }
  } else {
    // Piggyback failed — run memory with stale data, skip critic + surgeon
    pipeline.steps.push(await runStep('learning_memory', async () => {
      const text = await distillLearningMemory();
      return { chars: text.length, note: 'stale piggyback data' };
    }, { retryOnce: true, agentName: 'learning-memory' }));
    pipeline.steps.push(skippedStep('critic',  'piggyback_judge failed'));
    pipeline.steps.push(skippedStep('surgeon', 'piggyback_judge failed'));
  }

  // ── Step 6: FQI Check ─────────────────────────────────────────────────────
  try {
    const metricsAfter = await measurePromptPerformance();
    pipeline.fqiAfter = computeFQI(metricsAfter);
    pipeline.fqiDelta = pipeline.fqiBefore !== null ? pipeline.fqiAfter - pipeline.fqiBefore : null;
    const sign = pipeline.fqiDelta !== null && pipeline.fqiDelta >= 0 ? '+' : '';
    console.log(`[Orchestrator] FQI after: ${pipeline.fqiAfter.toFixed(4)} (${sign}${pipeline.fqiDelta?.toFixed(4) ?? 'N/A'})`);
    pipeline.steps.push({
      stepId: 'fqi_check', status: 'success',
      startedAt: new Date(), completedAt: new Date(), durationMs: 0,
      error: null, retried: false,
      output: { fqiBefore: pipeline.fqiBefore, fqiAfter: pipeline.fqiAfter, fqiDelta: pipeline.fqiDelta },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    pipeline.steps.push({
      stepId: 'fqi_check', status: 'failed',
      startedAt: new Date(), completedAt: new Date(), durationMs: 0,
      error: msg, retried: false, output: {},
    });
  }

  // ── Step 7: Emergency Revert (conditional) ────────────────────────────────
  if (pipeline.fqiDelta !== null && pipeline.fqiDelta < -FQI_EMERGENCY_DROP) {
    console.log(`[Orchestrator] FQI dropped ${pipeline.fqiDelta.toFixed(4)} — emergency revert`);
    pipeline.emergencyRevert = true;
    pipeline.steps.push(await runStep('emergency_revert', async () => {
      await evaluateABTests();
      return { fqiDrop: pipeline.fqiDelta };
    }, { retryOnce: true }));
  }

  // ── Step 8: Multi-Loop Mutations ──────────────────────────────────────────
  // Keep running proactive mutations until budget depletes or 7am UTC deadline.
  // C4: Interleave outfit mutations with stylist improvements — every 3rd loop
  // Phase 4: Growth interleave — every 4th loop runs Reddit+creator funnel metrics
  if (!pipeline.emergencyRevert) {
    let loopCount = 0;
    let stylistRun = false;
    let growthMeasured = false;
    while (true) {
      if (new Date().getUTCHours() >= OVERNIGHT_DEADLINE_HOUR) {
        pipeline.loopStopReason = 'deadline';
        break;
      }
      if (!(await hasLearningBudget(MULTI_LOOP_PRIORITY as any).catch(() => false))) {
        pipeline.loopStopReason = 'budget_exhausted';
        break;
      }
      loopCount++;
      console.log(`[Orchestrator] Multi-loop mutation #${loopCount}`);
      try {
        // Phase 4: Every 4th iteration — run growth channel metrics instead of outfit mutation
        if (loopCount % 4 === 0 && !growthMeasured) {
          console.log('[Orchestrator] Multi-loop: measuring growth channels');
          await Promise.allSettled([
            measureRedditGrowthMetrics(),
            measureCreatorFunnelMetrics(),
          ]);
          growthMeasured = true; // Run growth metrics once per night
        }
        // C4: On 3rd loop (and every 3rd thereafter), run stylist improvement instead of outfit mutation
        else if (loopCount % 3 === 0 && !stylistRun) {
          console.log('[Orchestrator] Multi-loop: running stylist improvement cycle');
          await runStylistImprovementCycle();
          stylistRun = true; // Only run once per night to avoid over-spending
        } else {
          await runProactiveMutationExported();
        }
      } catch (err) {
        console.error(`[Orchestrator] Multi-loop #${loopCount} failed:`, err);
        pipeline.loopStopReason = 'error';
        break;
      }
    }
    pipeline.multiLoopCount = loopCount;
    pipeline.steps.push({
      stepId: 'multi_loop', status: loopCount > 0 ? 'success' : 'skipped',
      startedAt: new Date(), completedAt: new Date(), durationMs: 0,
      error: null, retried: false,
      output: { loopCount, stylistRun, growthMeasured, stopReason: pipeline.loopStopReason ?? 'none' },
    });
  }

  // ── Step 9: A/B Eval ──────────────────────────────────────────────────────
  pipeline.steps.push(await runStep('ab_eval', async () => {
    await evaluateABTests();
    return { ok: true };
  }, { retryOnce: true }));

  // Token usage delta
  try {
    const usageAfter = await getTodayUsage();
    pipeline.tokensConsumed = usageAfter.learningTokens - tokensBefore;
  } catch {}

  pipeline.completedAt = new Date();

  // Publish summary to intelligence bus
  await publishToIntelligenceBus('orchestrator', 'orchestrator_run', {
    runId: pipeline.runId,
    fqiBefore: pipeline.fqiBefore,
    fqiAfter: pipeline.fqiAfter,
    fqiDelta: pipeline.fqiDelta,
    tokensConsumed: pipeline.tokensConsumed,
    multiLoopCount: pipeline.multiLoopCount,
    emergencyRevert: pipeline.emergencyRevert,
    stepSummary: pipeline.steps.map(s => ({ step: s.stepId, status: s.status, durationMs: s.durationMs, retried: s.retried })),
  }).catch(() => {});

  // Record in agent health system
  const failures = pipeline.steps.filter(s => s.status === 'failed');
  await recordAgentRun('orchestrator', failures.length > 0 ? `${failures.length} step(s) failed: ${failures.map(s => s.stepId).join(', ')}` : undefined).catch(() => {});

  // ── Step 10: Morning Brief ─────────────────────────────────────────────────
  pipeline.steps.push(await runStep('morning_brief', async () => {
    await sendMorningBrief(pipeline);
    return { sent: true };
  }, { retryOnce: true }));

  const totalMs = pipeline.completedAt.getTime() - pipeline.startedAt.getTime();
  console.log(`[Orchestrator] Complete in ${Math.round(totalMs / 1000)}s — FQI ${pipeline.fqiBefore?.toFixed(4)} → ${pipeline.fqiAfter?.toFixed(4)}, ${pipeline.multiLoopCount} extra mutations`);

  return pipeline;
}

// ─── Morning Brief Email ──────────────────────────────────────────────────────

async function sendMorningBrief(pipeline: PipelineRun): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const recipient = process.env.REPORT_RECIPIENT_EMAIL;
  if (!apiKey || !recipient) {
    console.log('[Orchestrator] No RESEND_API_KEY or REPORT_RECIPIENT_EMAIL — skipping morning brief');
    return;
  }
  const resend = new Resend(apiKey);

  // Gather supporting data
  const [agentHealth, activeABTests, tokenUsage, recentOrchRuns, redditGrowthEntry, creatorFunnelEntry] = await Promise.all([
    getAgentHealth().catch(() => []),
    prisma.promptVersion.findMany({
      where: { isCandidate: true, isActive: true },
      select: { version: true, trafficPct: true, sampleSize: true, avgUserRating: true },
    }).catch(() => []),
    getTodayUsage().catch(() => null),
    // A6: Read last 3 orchestrator_run entries for FQI trend comparison
    readFromIntelligenceBus('morning-brief', 'orchestrator_run', { limit: 3 }).catch(() => []),
    // Phase 4: Growth channel performance
    readFromIntelligenceBus('morning-brief', 'reddit_growth_metrics', { limit: 1 }).catch(() => []),
    readFromIntelligenceBus('morning-brief', 'creator_funnel_metrics', { limit: 1 }).catch(() => []),
  ]);

  const redAgents   = agentHealth.filter(a => a.status === 'red');
  const yellowAgents = agentHealth.filter(a => a.status === 'yellow');
  const greenCount  = agentHealth.filter(a => a.status === 'green').length;

  const totalDurationMs = pipeline.completedAt
    ? pipeline.completedAt.getTime() - pipeline.startedAt.getTime()
    : 0;
  const totalSec = Math.round(totalDurationMs / 1000);

  const dateStr = pipeline.startedAt.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  });

  // Step rows
  const stepIcon = (s: StepResult) =>
    s.status === 'success' ? '✅' : s.status === 'failed' ? '❌' : '⏭️';

  const stepRows = pipeline.steps
    .filter(s => s.stepId !== 'morning_brief') // skip self
    .map(s => {
      const dur = s.durationMs > 0 ? `${(s.durationMs / 1000).toFixed(1)}s` : '—';
      const retry = s.retried ? ' <span style="color:#F59E0B;font-size:10px;">(retried)</span>' : '';
      const err = s.error && s.status === 'failed'
        ? `<br><span style="font-size:11px;color:#EF4444;">${s.error.slice(0, 120)}</span>` : '';
      const extra = s.stepId === 'multi_loop' && s.output.loopCount
        ? ` — ${s.output.loopCount} mutations` : '';
      return `<tr style="border-bottom:1px solid #F5EDE7;">
        <td style="padding:6px 12px;font-size:13px;">${stepIcon(s)} <code style="font-size:12px;">${s.stepId}</code>${retry}</td>
        <td style="padding:6px 12px;font-size:13px;text-align:right;color:#6B7280;">${dur}</td>
        <td style="padding:6px 12px;font-size:13px;">${s.status}${extra}${err}</td>
      </tr>`;
    }).join('');

  // FQI display
  const fqiDelta = pipeline.fqiDelta;
  const fqiColor = fqiDelta === null ? '#6B7280' : fqiDelta >= 0 ? '#10B981' : '#EF4444';
  const fqiSign  = fqiDelta !== null && fqiDelta >= 0 ? '▲' : '▼';
  const fqiLabel = fqiDelta !== null ? `${fqiSign} ${Math.abs(fqiDelta).toFixed(4)}` : '—';

  // Emergency revert banner
  const emergencyBanner = pipeline.emergencyRevert ? `
  <div style="background:#FEF2F2;border:2px solid #EF4444;border-radius:8px;padding:14px 16px;margin-bottom:16px;">
    <div style="font-weight:700;color:#EF4444;font-size:13px;">⚠️ EMERGENCY REVERT TRIGGERED</div>
    <div style="color:#1A1A1A;font-size:13px;margin-top:4px;">FQI dropped ${Math.abs(fqiDelta ?? 0).toFixed(4)} below baseline — evaluateABTests() invoked to revert degrading changes.</div>
  </div>` : '';

  // Agent health block
  const agentHealthBlock = redAgents.length > 0 ? `
  <div style="margin-top:20px;">
    <div style="font-size:11px;font-weight:700;color:#E85D4C;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Agent Health</div>
    <div style="font-size:13px;">🟢 ${greenCount} healthy &nbsp; 🟡 ${yellowAgents.length} stale &nbsp; 🔴 ${redAgents.length} failing</div>
    ${redAgents.map(a => `<div style="font-size:12px;color:#EF4444;margin-top:3px;">❌ ${a.agent}${a.lastError ? `: ${String(a.lastError).slice(0, 80)}` : ''}</div>`).join('')}
  </div>` : `
  <div style="margin-top:20px;">
    <div style="font-size:11px;font-weight:700;color:#10B981;text-transform:uppercase;letter-spacing:1px;">Agent Health — All ${agentHealth.length} agents healthy 🟢</div>
  </div>`;

  // Phase 4: Growth Channels block
  const redditGrowthPayload = redditGrowthEntry[0]?.payload as Record<string, unknown> | undefined;
  const creatorFunnelPayload = creatorFunnelEntry[0]?.payload as Record<string, unknown> | undefined;
  const growthChannelsBlock = (redditGrowthPayload || creatorFunnelPayload) ? `
  <div style="margin-top:20px;">
    <div style="font-size:11px;font-weight:700;color:#FF6314;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Growth Channels</div>
    ${redditGrowthPayload ? `<div style="font-size:13px;color:#2D2D2D;margin-bottom:4px;">
      Reddit: ${(redditGrowthPayload.totalPosted as number) ?? 0} posts · avg karma ${((redditGrowthPayload.overallAvgKarma as number) ?? 0).toFixed(1)} ·
      OP replied ${(((redditGrowthPayload.overallAuthorRepliedRate as number) ?? 0) * 100).toFixed(0)}% ·
      image analysis avg karma ${((redditGrowthPayload.imageAnalysis as any)?.avgKarma ?? 0).toFixed(1)} vs generic ${((redditGrowthPayload.generic as any)?.avgKarma ?? 0).toFixed(1)}
    </div>` : ''}
    ${creatorFunnelPayload ? `<div style="font-size:13px;color:#2D2D2D;">
      Creator funnel: ${(creatorFunnelPayload.total as number) ?? 0} prospects ·
      warming→contact ${((((creatorFunnelPayload.funnel as any)?.warmingToContactRate ?? 0) * 100).toFixed(0))}% ·
      contact→response ${((((creatorFunnelPayload.funnel as any)?.contactToResponseRate ?? 0) * 100).toFixed(0))}% ·
      warmed response rate ${((((creatorFunnelPayload.warming as any)?.warmedResponseRate ?? 0) * 100).toFixed(0))}% vs cold ${((((creatorFunnelPayload.warming as any)?.coldResponseRate ?? 0) * 100).toFixed(0))}%
    </div>` : ''}
  </div>` : '';

  // Active A/B tests block
  const abBlock = activeABTests.length > 0 ? `
  <div style="margin-top:20px;">
    <div style="font-size:11px;font-weight:700;color:#E85D4C;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Active A/B Tests</div>
    ${activeABTests.map(t =>
      `<div style="font-size:13px;">• <code>${t.version}</code> — ${t.trafficPct}% traffic, ${t.sampleSize} samples${t.avgUserRating ? `, avg rating ${t.avgUserRating.toFixed(2)}` : ''}</div>`
    ).join('')}
  </div>` : `
  <div style="margin-top:20px;font-size:13px;color:#6B7280;">No active A/B tests.</div>`;

  // Token budget block
  const budgetBlock = tokenUsage ? `
  <div style="margin-top:12px;font-size:13px;">
    <strong>Pipeline tokens:</strong> ${pipeline.tokensConsumed.toLocaleString()} consumed this run &nbsp;|&nbsp;
    <strong>Day total:</strong> ${tokenUsage.learningTokens.toLocaleString()} / ${tokenUsage.learningBudget.toLocaleString()} (${Math.round(tokenUsage.learningTokens / Math.max(tokenUsage.learningBudget, 1) * 100)}%)
  </div>` : '';

  // A6: FQI trend from previous runs
  const fqiTrendBlock = recentOrchRuns.length > 1 ? (() => {
    const prevRuns = recentOrchRuns
      .filter(r => r.payload.runId !== pipeline.runId)
      .slice(0, 2)
      .map(r => ({ fqi: r.payload.fqiAfter as number | null, date: r.createdAt }));
    if (prevRuns.length === 0) return '';
    const rows = prevRuns.map(r =>
      `<div style="font-size:12px;color:#6B7280;">${r.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: FQI ${r.fqi != null ? r.fqi.toFixed(4) : '—'}</div>`
    ).join('');
    return `
  <div style="margin-top:16px;">
    <div style="font-size:11px;font-weight:700;color:#E85D4C;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">FQI History (Previous Runs)</div>
    ${rows}
  </div>`;
  })() : '';

  const failCount = pipeline.steps.filter(s => s.status === 'failed').length;
  const subjectEmoji = pipeline.emergencyRevert ? '🚨' : failCount > 0 ? '⚠️' : '✅';
  const subject = `${subjectEmoji} Or This? Overnight — FQI ${pipeline.fqiAfter?.toFixed(4) ?? '?'} (${fqiLabel}) · ${pipeline.multiLoopCount} mutations · ${totalSec}s`;

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#FBF7F4;font-family:Arial,sans-serif;">
<div style="max-width:660px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);">

  <div style="background:#1A1A1A;padding:28px 36px;">
    <div style="font-size:22px;font-weight:700;color:#fff;">Overnight Learning Report</div>
    <div style="font-size:12px;color:rgba(255,255,255,0.55);margin-top:4px;">${dateStr} · ${totalSec}s · ${pipeline.tokensConsumed.toLocaleString()} tokens consumed</div>
  </div>

  <div style="padding:28px 36px;">
    ${emergencyBanner}

    <!-- FQI Headline -->
    <div style="display:flex;align-items:flex-end;justify-content:space-between;padding-bottom:16px;border-bottom:1px solid #F5EDE7;">
      <div>
        <div style="font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Feedback Quality Index</div>
        <div style="font-size:36px;font-weight:700;color:${fqiColor};line-height:1;">${pipeline.fqiAfter?.toFixed(4) ?? '—'}</div>
        <div style="font-size:14px;color:${fqiColor};margin-top:4px;">${fqiLabel}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:11px;color:#6B7280;margin-bottom:2px;">Before</div>
        <div style="font-size:20px;font-weight:600;color:#2D2D2D;">${pipeline.fqiBefore?.toFixed(4) ?? '—'}</div>
        <div style="font-size:11px;color:#6B7280;margin-top:8px;">Multi-loop mutations</div>
        <div style="font-size:20px;font-weight:600;color:#2D2D2D;">${pipeline.multiLoopCount}${pipeline.loopStopReason ? ` <span style="font-size:12px;color:#6B7280;">(${pipeline.loopStopReason})</span>` : ''}</div>
      </div>
    </div>

    <!-- Pipeline Steps -->
    <div style="margin-top:20px;">
      <div style="font-size:11px;font-weight:700;color:#E85D4C;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Pipeline Steps</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #F5EDE7;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#F5EDE7;">
            <th style="padding:6px 12px;text-align:left;font-size:11px;color:#6B7280;font-weight:600;">Step</th>
            <th style="padding:6px 12px;text-align:right;font-size:11px;color:#6B7280;font-weight:600;">Duration</th>
            <th style="padding:6px 12px;text-align:left;font-size:11px;color:#6B7280;font-weight:600;">Result</th>
          </tr>
        </thead>
        <tbody>${stepRows}</tbody>
      </table>
    </div>

    ${budgetBlock}
    ${fqiTrendBlock}
    ${growthChannelsBlock}
    ${abBlock}
    ${agentHealthBlock}
  </div>

  <div style="background:#F5EDE7;padding:16px 36px;text-align:center;">
    <div style="font-size:11px;color:#6B7280;">Or This? · Overnight Orchestrator · ${pipeline.startedAt.toISOString()}</div>
  </div>
</div>
</body></html>`;

  const from = process.env.REPORT_FROM_EMAIL || 'learning@orthis.app';
  await resend.emails.send({ from, to: recipient, subject, html });
  console.log('[Orchestrator] Morning brief sent');
}

// ─── Guard ────────────────────────────────────────────────────────────────────

export function isOrchestratorEnabled(): boolean {
  return process.env.ENABLE_ORCHESTRATOR === 'true';
}
