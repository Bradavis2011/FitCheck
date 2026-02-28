/**
 * Ops Learning Agent — Unified Ops Learning Cycle
 *
 * Runs weekly (Sunday 7am UTC). Applies the measure → critique → improve
 * pattern to 4 product systems: email, nudges, social content, conversion signals.
 *
 * Token budget: ~12K tokens/week (~2K/day avg). Cheap by design.
 *
 * Flow:
 *  1. Collect measurements from all 4 domains (DB only, $0)
 *  2. One batched Gemini critique covering all domains (~5K tokens)
 *  3. One targeted improvement call for the weakest domain (~5K tokens)
 *  4. Conversion signal recalibration (pure math, $0)
 *  5. Challenge prompt improvement (monthly, ~2K tokens)
 *  6. Publish results to Intelligence Bus
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { publishToIntelligenceBus, readFromIntelligenceBus } from './intelligence-bus.service.js';
import { measureNudgeMetrics, promoteNudgeWinners } from './nudge.service.js';
import { measureFollowUpMetrics } from './event-followup.service.js';
import { measureMilestoneMetrics } from './milestone-message.service.js';
import { publishBrandGuardMetrics } from './brand-guard.service.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ─── Email Metrics Measurer ───────────────────────────────────────────────────

interface EmailMetrics {
  sequence: string;
  step: number;
  sent: number;
  opened: number;
  clicked: number;
  converted: number;
  openRate: number;
  clickRate: number;
  conversionRate: number;
}

async function measureEmailMetrics(): Promise<EmailMetrics[]> {
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  // Aggregate events by sequence+step
  const events = await prisma.emailEvent.findMany({
    where: { sentAt: { gte: fourteenDaysAgo } },
    select: { sequence: true, step: true, status: true, userId: true, sentAt: true },
  });

  const byKey = new Map<string, { sent: number; opened: number; clicked: number; converted: number; userIds: string[] }>();

  for (const e of events) {
    const key = `${e.sequence}:${e.step}`;
    if (!byKey.has(key)) byKey.set(key, { sent: 0, opened: 0, clicked: 0, converted: 0, userIds: [] });
    const m = byKey.get(key)!;
    m.sent++;
    if (e.status === 'opened' || e.status === 'clicked') m.opened++;
    if (e.status === 'clicked') m.clicked++;
    m.userIds.push(e.userId);
  }

  const results: EmailMetrics[] = [];

  for (const [key, m] of byKey) {
    const [sequence, stepStr] = key.split(':');
    const step = parseInt(stepStr, 10);

    // Count conversions: outfit checks within 48h of send
    let converted = 0;
    const sentEventsForKey = events.filter(e => e.sequence === sequence && e.step === step);
    for (const e of sentEventsForKey) {
      const fortyEightHoursAfter = new Date(e.sentAt.getTime() + 48 * 60 * 60 * 1000);
      const check = await prisma.outfitCheck.findFirst({
        where: {
          userId: e.userId,
          isDeleted: false,
          createdAt: { gte: e.sentAt, lte: fortyEightHoursAfter },
        },
      });
      if (check) converted++;
    }

    results.push({
      sequence,
      step,
      sent: m.sent,
      opened: m.opened,
      clicked: m.clicked,
      converted,
      openRate: m.sent > 0 ? m.opened / m.sent : 0,
      clickRate: m.sent > 0 ? m.clicked / m.sent : 0,
      conversionRate: m.sent > 0 ? converted / m.sent : 0,
    });
  }

  // Publish to bus
  await publishToIntelligenceBus('ops-learning', 'email_metrics', {
    measuredAt: new Date().toISOString(),
    metrics: results,
    worstStep: results
      .filter(m => m.sent >= 5)
      .sort((a, b) => a.openRate - b.openRate)[0] || null,
  });

  return results;
}

// ─── Social Metrics Measurer ──────────────────────────────────────────────────

interface SocialMetrics {
  contentType: string;
  postsCount: number;
  avgLikes: number;
  avgRetweets: number;
  avgImpressions: number;
  engagementRate: number;
}

async function measureSocialMetrics(): Promise<SocialMetrics[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const posts = await prisma.socialPost.findMany({
    where: {
      status: 'posted',
      contentType: { not: null },
      postedAt: { gte: thirtyDaysAgo },
    },
    select: { contentType: true, engagement: true },
  });

  const byType = new Map<string, { likes: number[]; retweets: number[]; impressions: number[] }>();

  for (const post of posts) {
    const ct = post.contentType!;
    if (!byType.has(ct)) byType.set(ct, { likes: [], retweets: [], impressions: [] });
    const m = byType.get(ct)!;

    const eng = post.engagement as Record<string, unknown> | null;
    if (eng) {
      const metrics = (eng.public_metrics || eng) as Record<string, number>;
      if (metrics.like_count != null) m.likes.push(metrics.like_count);
      if (metrics.retweet_count != null) m.retweets.push(metrics.retweet_count);
      if (metrics.impression_count != null) m.impressions.push(metrics.impression_count);
    }
  }

  const results: SocialMetrics[] = [];
  for (const [contentType, m] of byType) {
    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
    const avgLikes = avg(m.likes);
    const avgImpressions = avg(m.impressions);
    const engagementRate = avgImpressions > 0 ? (avgLikes + avg(m.retweets)) / avgImpressions : 0;

    results.push({
      contentType,
      postsCount: m.likes.length || posts.filter(p => p.contentType === contentType).length,
      avgLikes,
      avgRetweets: avg(m.retweets),
      avgImpressions,
      engagementRate,
    });
  }

  const worstType = results
    .filter(m => m.postsCount >= 2)
    .sort((a, b) => a.engagementRate - b.engagementRate)[0] || null;

  await publishToIntelligenceBus('ops-learning', 'social_metrics', {
    measuredAt: new Date().toISOString(),
    metrics: results,
    worstContentType: worstType?.contentType || null,
  });

  return results;
}

// ─── Conversion Signal Recalibration (Pure Math) ─────────────────────────────

interface ConversionMetrics {
  signalType: string;
  totalSignals: number;
  conversions: number;
  conversionRate: number;
  currentStrength: number;
  newStrength: number;
}

async function recalibrateConversionSignals(): Promise<ConversionMetrics[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const signalTypes = ['hit_daily_limit', 'high_engagement', 'loyal_free', 'power_user'];

  // Current calibration strengths (from DB or defaults)
  const calibrationMap = new Map<string, number>();
  const currentCalibrations = await prisma.conversionCalibration.findMany({
    where: { isActive: true },
  });
  for (const c of currentCalibrations) {
    calibrationMap.set(c.signalType, c.strength);
  }

  const defaults: Record<string, number> = {
    hit_daily_limit: 0.8,
    high_engagement: 0.7,
    loyal_free: 0.5,
    power_user: 0.6,
  };

  const metrics: ConversionMetrics[] = [];
  const conversionRates: number[] = [];

  for (const signalType of signalTypes) {
    const signals = await prisma.conversionSignal.findMany({
      where: { signalType, createdAt: { gte: thirtyDaysAgo } },
      select: { userId: true, createdAt: true, outcome: true },
    });

    // Count how many signal users actually converted (tier changed to paid within 14 days)
    let conversions = 0;
    for (const s of signals) {
      const fourteenDaysAfter = new Date(s.createdAt.getTime() + 14 * 24 * 60 * 60 * 1000);
      const upgraded = await prisma.user.findFirst({
        where: {
          id: s.userId,
          tier: { in: ['plus', 'pro'] },
          updatedAt: { gte: s.createdAt, lte: fourteenDaysAfter },
        },
      });
      if (upgraded) conversions++;
    }

    const conversionRate = signals.length > 0 ? conversions / signals.length : 0;
    conversionRates.push(conversionRate);

    metrics.push({
      signalType,
      totalSignals: signals.length,
      conversions,
      conversionRate,
      currentStrength: calibrationMap.get(signalType) ?? defaults[signalType] ?? 0.5,
      newStrength: 0, // calculated below
    });
  }

  // Calculate average conversion rate for relative adjustment
  const avgConversionRate = conversionRates.reduce((s, r) => s + r, 0) / (conversionRates.length || 1);

  const results: ConversionMetrics[] = [];
  for (const m of metrics) {
    // Adjust strength based on performance vs average
    // Only adjust if we have enough data (5+ signals)
    let newStrength = m.currentStrength;
    if (m.totalSignals >= 5) {
      const adjustment = 1 + (m.conversionRate - avgConversionRate) * 2;
      newStrength = Math.max(0.3, Math.min(1.0, m.currentStrength * adjustment));
    }

    results.push({ ...m, newStrength });

    // Store calibration
    await prisma.conversionCalibration.updateMany({
      where: { signalType: m.signalType, isActive: true },
      data: { isActive: false },
    });

    await prisma.conversionCalibration.create({
      data: {
        signalType: m.signalType,
        strength: newStrength,
        conversionRate: m.conversionRate,
        sampleSize: m.totalSignals,
        isActive: true,
      },
    });
  }

  await publishToIntelligenceBus('ops-learning', 'conversion_metrics', {
    measuredAt: new Date().toISOString(),
    metrics: results,
    avgConversionRate,
  });

  console.log('[OpsLearning] Conversion signals recalibrated');
  return results;
}

// ─── Gemini Critique (batched, all domains) ───────────────────────────────────

async function runOpsLearningCritique(
  emailMetrics: EmailMetrics[],
  socialMetrics: SocialMetrics[],
  conversionMetrics: ConversionMetrics[],
  nudgePayload: Record<string, unknown>,
  followUpPayload: Record<string, unknown>,
  milestonePayload: Record<string, unknown>,
  asoPayload: Record<string, unknown>,
  attrPayload: Record<string, unknown>,
): Promise<string> {
  if (!process.env.GEMINI_API_KEY) return 'Gemini not configured';

  const worstEmail = emailMetrics
    .filter(m => m.sent >= 5)
    .sort((a, b) => a.openRate - b.openRate)[0];

  const worstSocial = socialMetrics
    .filter(m => m.postsCount >= 2)
    .sort((a, b) => a.engagementRate - b.engagementRate)[0];

  const nudgeSegments = nudgePayload.segments as Record<string, { rate: number }> || {};
  const worstNudge = Object.entries(nudgeSegments)
    .filter(([, m]) => m.rate !== undefined)
    .sort((a, b) => a[1].rate - b[1].rate)[0]?.[0];

  const prompt = `You are an ops learning agent for "Or This?", an AI outfit feedback app.
Review the following performance metrics across 6 systems and identify the single biggest improvement opportunity.

EMAIL METRICS (last 14 days):
${worstEmail
  ? `Worst step: ${worstEmail.sequence} step ${worstEmail.step} — open rate ${(worstEmail.openRate * 100).toFixed(1)}%, click rate ${(worstEmail.clickRate * 100).toFixed(1)}%, conversion rate ${(worstEmail.conversionRate * 100).toFixed(1)}%`
  : 'Insufficient data'}

NUDGE METRICS (last 14 days):
${worstNudge
  ? `Worst segment: ${worstNudge} — conversion rate ${((nudgeSegments[worstNudge]?.rate || 0) * 100).toFixed(1)}%`
  : 'Insufficient data'}

SOCIAL CONTENT METRICS (last 30 days):
${worstSocial
  ? `Worst content type: ${worstSocial.contentType} — engagement rate ${(worstSocial.engagementRate * 100).toFixed(2)}%, avg likes ${worstSocial.avgLikes.toFixed(1)}, posts ${worstSocial.postsCount}`
  : 'Insufficient data'}

CONVERSION SIGNAL RECALIBRATION:
${conversionMetrics.map(m => `${m.signalType}: ${(m.conversionRate * 100).toFixed(1)}% conversion rate, strength ${m.currentStrength.toFixed(2)} → ${m.newStrength.toFixed(2)}`).join('\n')}

EVENT FOLLOW-UP METRICS (last 30 days):
${followUpPayload.worstOccasion
  ? `Worst occasion: ${followUpPayload.worstOccasion} — response rate ${((followUpPayload.worstResponseRate as number || 0) * 100).toFixed(1)}%`
  : 'Insufficient data'}

MILESTONE MESSAGE METRICS (last 30 days):
${milestonePayload.worstMilestone
  ? `Worst milestone: ${milestonePayload.worstMilestone} — conversion rate ${((milestonePayload.worstConversionRate as number || 0) * 100).toFixed(1)}%`
  : 'Insufficient data'}

ASO KEYWORD TRENDS (latest weekly snapshot):
${asoPayload.keywords
  ? `Top keywords: ${(asoPayload.keywords as Array<{keyword: string; store: string; traffic: number; difficulty: number; rankChange: number | null}>)
      .slice(0, 4).map(k => `"${k.keyword}" (${k.store}): traffic ${(k.traffic || 0).toFixed(0)}, difficulty ${(k.difficulty || 0).toFixed(0)}, rank ${k.rankChange != null ? (k.rankChange > 0 ? `▼${k.rankChange}` : `▲${Math.abs(k.rankChange)}`) : 'new'}`).join('; ')}`
  : 'No ASO data yet — first snapshot runs Tuesday 6am UTC'}

ATTRIBUTION (signups by source, last 7d):
${attrPayload.bySource
  ? (attrPayload.bySource as Array<{source: string; count: number; firstOutfitRate: number}>)
      .slice(0, 5).map(s => `${s.source}: ${s.count} signups, ${s.firstOutfitRate}% first-outfit`).join(' | ')
  : 'No attribution data yet — ensure UTM links are in use'}

Return JSON only (no markdown):
{
  "weakestDomain": "email" | "nudge" | "social" | "conversion" | "followup" | "milestone" | "aso" | "attribution",
  "criticalIssue": "one sentence describing the biggest problem",
  "recommendation": "one specific, actionable improvement",
  "urgency": "low" | "medium" | "high"
}`;

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
    });
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const match = raw.match(/\{[\s\S]*\}/);
    return match ? match[0] : raw;
  } catch (err) {
    console.error('[OpsLearning] Critique failed:', err);
    return '{}';
  }
}

// ─── Email Variant Generation ──────────────────────────────────────────────────

async function generateEmailVariant(worstStep: EmailMetrics): Promise<void> {
  if (!process.env.GEMINI_API_KEY) return;

  const prompt = `You are writing an A/B test variant for an email in the "Or This?" AI outfit app lifecycle sequence.

Current email:
- Sequence: ${worstStep.sequence}
- Step: ${worstStep.step}
- Open rate: ${(worstStep.openRate * 100).toFixed(1)}%
- Click rate: ${(worstStep.clickRate * 100).toFixed(1)}%

The subject line and CTA text need improvement. Write one alternative for each.

Brand voice: Casual, confident, fashion-forward. Like a friend who knows style.
Never: "excited to announce", "game-changer". Keep it short and human.

Return JSON only (no markdown):
{
  "subject": "alternative subject line (max 60 chars)",
  "ctaText": "alternative CTA button text (max 30 chars)"
}`;

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      generationConfig: { temperature: 0.7, maxOutputTokens: 256 },
    });
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return;

    const parsed = JSON.parse(match[0]) as { subject?: string; ctaText?: string };

    if (parsed.subject) {
      await prisma.emailTemplateVariant.upsert({
        where: {
          sequence_step_field_isControl: {
            sequence: worstStep.sequence,
            step: worstStep.step,
            field: 'subject',
            isControl: false,
          },
        },
        update: { variant: parsed.subject },
        create: {
          sequence: worstStep.sequence,
          step: worstStep.step,
          field: 'subject',
          variant: parsed.subject,
          isControl: false,
        },
      });
    }

    if (parsed.ctaText) {
      await prisma.emailTemplateVariant.upsert({
        where: {
          sequence_step_field_isControl: {
            sequence: worstStep.sequence,
            step: worstStep.step,
            field: 'ctaText',
            isControl: false,
          },
        },
        update: { variant: parsed.ctaText },
        create: {
          sequence: worstStep.sequence,
          step: worstStep.step,
          field: 'ctaText',
          variant: parsed.ctaText,
          isControl: false,
        },
      });
    }

    console.log(`[OpsLearning] Email variant generated for ${worstStep.sequence} step ${worstStep.step}`);
  } catch (err) {
    console.error('[OpsLearning] Email variant generation failed:', err);
  }
}

// ─── Nudge Variant Generation ─────────────────────────────────────────────────

async function generateNudgeVariants(worstSegment: string): Promise<void> {
  if (!process.env.GEMINI_API_KEY) return;

  const segmentDescriptions: Record<string, string> = {
    new_no_outfit: 'new users who signed up 24-48h ago but haven\'t checked their first outfit',
    inactive_3d: 'users who were active but haven\'t submitted an outfit in 3+ days',
    streak_risk: 'users with an active streak who haven\'t checked in today (sent at 10pm)',
    churning_paid: 'paying subscribers who haven\'t used the app in 5+ days',
  };

  const prompt = `You are writing push notification variants for the "Or This?" AI outfit app.

Target segment: ${worstSegment}
Description: ${segmentDescriptions[worstSegment] || worstSegment}

Brand voice: Casual, encouraging, fashion-forward. Like a friend, not a marketing bot.
Max: title 50 chars, body 100 chars.

Write 2 alternative push notification variants. Return JSON only (no markdown):
{
  "variants": [
    { "title": "...", "body": "..." },
    { "title": "...", "body": "..." }
  ]
}`;

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      generationConfig: { temperature: 0.8, maxOutputTokens: 512 },
    });
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return;

    const parsed = JSON.parse(match[0]) as { variants?: Array<{ title: string; body: string }> };

    for (const v of (parsed.variants || [])) {
      if (!v.title || !v.body) continue;
      await prisma.nudgeVariant.create({
        data: { segment: worstSegment, title: v.title, body: v.body, isControl: false },
      });
    }

    console.log(`[OpsLearning] Nudge variants generated for segment "${worstSegment}"`);
  } catch (err) {
    console.error('[OpsLearning] Nudge variant generation failed:', err);
  }
}

// ─── Social Prompt Improvement ────────────────────────────────────────────────

async function improveSocialPrompt(worstContentType: string): Promise<void> {
  if (!process.env.GEMINI_API_KEY) return;

  // Get top 3 highest-performing posts of any type as positive examples
  const topPosts = await prisma.socialPost.findMany({
    where: { status: 'posted', engagement: { not: Prisma.JsonNull } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  // Sort by likes
  const sortedByEng = topPosts
    .map(p => ({
      content: p.content,
      contentType: p.contentType,
      likes: ((p.engagement as Record<string, unknown>)?.like_count as number) || 0,
    }))
    .sort((a, b) => b.likes - a.likes)
    .slice(0, 3);

  const prompt = `You are improving the content generation prompt for the "Or This?" AI outfit app social media strategy.

Content type to improve: ${worstContentType}
(This content type has the lowest engagement among posted content)

Top performing posts (any type) for reference:
${sortedByEng.map((p, i) => `${i + 1}. [${p.contentType}] (${p.likes} likes): ${p.content.slice(0, 200)}`).join('\n\n')}

Write an improved prompt for generating ${worstContentType} posts. The prompt should:
1. Incorporate lessons from the high-performing examples
2. Be specific about tone, structure, and what makes posts engaging
3. Be a complete prompt (not a diff — write the whole thing)

Return JSON only (no markdown):
{
  "improvedPrompt": "the full improved generation prompt (max 800 chars)"
}`;

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      generationConfig: { temperature: 0.5, maxOutputTokens: 1024 },
    });
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return;

    const parsed = JSON.parse(match[0]) as { improvedPrompt?: string };
    if (!parsed.improvedPrompt) return;

    await prisma.socialPromptVariant.upsert({
      where: { contentType: worstContentType },
      update: { promptText: parsed.improvedPrompt, isActive: true },
      create: {
        contentType: worstContentType,
        promptText: parsed.improvedPrompt,
        isActive: true,
      },
    });

    console.log(`[OpsLearning] Social prompt improved for "${worstContentType}"`);
  } catch (err) {
    console.error('[OpsLearning] Social prompt improvement failed:', err);
  }
}

// ─── Auto-promote Email Winners ───────────────────────────────────────────────

async function promoteEmailWinners(): Promise<void> {
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const variants = await prisma.emailTemplateVariant.findMany({
    where: { isWinner: null, createdAt: { lte: twoWeeksAgo }, impressions: { gte: 10 } },
  });

  // Group by sequence+step+field
  const groups = new Map<string, typeof variants>();
  for (const v of variants) {
    const key = `${v.sequence}:${v.step}:${v.field}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(v);
  }

  for (const [, group] of groups) {
    if (group.length < 2) continue; // Need control + variant

    const winner = group.reduce((best, v) => {
      const rateV = v.impressions > 0 ? (v.field === 'subject' ? v.opens : v.clicks) / v.impressions : 0;
      const rateBest = best.impressions > 0 ? (best.field === 'subject' ? best.opens : best.clicks) / best.impressions : 0;
      return rateV > rateBest ? v : best;
    }, group[0]);

    for (const v of group) {
      await prisma.emailTemplateVariant.update({
        where: { id: v.id },
        data: { isWinner: v.id === winner.id },
      });
    }

    console.log(`[OpsLearning] Email winner promoted: ${winner.sequence} step ${winner.step} field ${winner.field}`);
  }
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export async function runOpsLearning(): Promise<void> {
  console.log('[OpsLearning] Starting weekly ops learning cycle...');

  // Phase 1: Measure everything (DB only, $0)
  const [emailMetrics, socialMetrics, conversionMetrics] = await Promise.all([
    measureEmailMetrics().catch(err => { console.error('[OpsLearning] Email metrics failed:', err); return []; }),
    measureSocialMetrics().catch(err => { console.error('[OpsLearning] Social metrics failed:', err); return []; }),
    recalibrateConversionSignals().catch(err => { console.error('[OpsLearning] Conversion recalibration failed:', err); return []; }),
  ]);

  // Measure nudges (also publishes to bus)
  await measureNudgeMetrics().catch(err => console.error('[OpsLearning] Nudge metrics failed:', err));

  // B2: Event follow-up response learning
  await measureFollowUpMetrics().catch(err => console.error('[OpsLearning] Follow-up metrics failed:', err));

  // B3: Milestone effectiveness
  await measureMilestoneMetrics().catch(err => console.error('[OpsLearning] Milestone metrics failed:', err));

  // B5: Brand guard calibration — monthly only (skip if not first run of the month)
  const isFirstRunOfMonth = new Date().getDate() <= 7; // Approximate: Sunday 7am only fires ~once/month
  if (isFirstRunOfMonth) {
    await publishBrandGuardMetrics().catch(err => console.error('[OpsLearning] Brand guard metrics failed:', err));
  }

  // Read metrics back from bus
  const nudgeEntry = await readFromIntelligenceBus('ops-learning', 'nudge_metrics', { limit: 1 });
  const nudgePayload = nudgeEntry[0]?.payload || {};
  const followUpEntry = await readFromIntelligenceBus('ops-learning', 'followup_metrics', { limit: 1 });
  const followUpPayload = followUpEntry[0]?.payload || {};
  const milestoneEntry = await readFromIntelligenceBus('ops-learning', 'milestone_metrics', { limit: 1 });
  const milestonePayload = milestoneEntry[0]?.payload || {};
  const asoEntry = await readFromIntelligenceBus('ops-learning', 'aso_metrics', { limit: 1 });
  const asoPayload = asoEntry[0]?.payload || {};
  const attrEntry = await readFromIntelligenceBus('ops-learning', 'attribution_metrics', { limit: 1 });
  const attrPayload = attrEntry[0]?.payload || {};

  // Phase 2: Batched Gemini critique (~5K tokens)
  let critiqueResult = '{}';
  if (process.env.GEMINI_API_KEY) {
    critiqueResult = await runOpsLearningCritique(emailMetrics, socialMetrics, conversionMetrics, nudgePayload, followUpPayload, milestonePayload, asoPayload, attrPayload);

    await publishToIntelligenceBus('ops-learning', 'ops_critique', {
      critique: critiqueResult,
      timestamp: new Date().toISOString(),
    });
  }

  // Phase 3: Targeted improvement for weakest domain (~5K tokens)
  let critique: { weakestDomain?: string } = {};
  try { critique = JSON.parse(critiqueResult); } catch { /* use empty */ }

  const worstEmailStep = emailMetrics.filter(m => m.sent >= 5).sort((a, b) => a.openRate - b.openRate)[0];
  const worstSocialType = socialMetrics.filter(m => m.postsCount >= 2).sort((a, b) => a.engagementRate - b.engagementRate)[0]?.contentType;
  const worstNudgeSegment = nudgePayload.worstSegment as string | null;

  switch (critique.weakestDomain) {
    case 'email':
      if (worstEmailStep) await generateEmailVariant(worstEmailStep);
      break;
    case 'nudge':
      if (worstNudgeSegment) await generateNudgeVariants(worstNudgeSegment);
      break;
    case 'social':
      if (worstSocialType) await improveSocialPrompt(worstSocialType);
      break;
    default:
      // If no clear winner, improve email (most impactful)
      if (worstEmailStep) await generateEmailVariant(worstEmailStep);
  }

  // Phase 4: Auto-promote winners (A/B test graduation)
  await promoteEmailWinners().catch(err => console.error('[OpsLearning] Email winner promotion failed:', err));
  await promoteNudgeWinners().catch(err => console.error('[OpsLearning] Nudge winner promotion failed:', err));

  await publishToIntelligenceBus('ops-learning', 'ops_improvement', {
    completedAt: new Date().toISOString(),
    weakestDomain: critique.weakestDomain || 'unknown',
    criticalIssue: (critique as { criticalIssue?: string }).criticalIssue || null,
    emailMetricsSample: emailMetrics.length,
    socialMetricsSample: socialMetrics.length,
    conversionMetricsSample: conversionMetrics.length,
  });

  console.log('[OpsLearning] Weekly ops learning cycle complete');
}

// ─── Twitter Engagement Poll ──────────────────────────────────────────────────

/** Poll Twitter API for engagement metrics on recently posted tweets. */
export async function pollTwitterEngagement(): Promise<void> {
  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) return;

  // Find posted tweets with externalId from the last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const posts = await prisma.socialPost.findMany({
    where: {
      status: 'posted',
      externalId: { not: null },
      postedAt: { gte: thirtyDaysAgo },
    },
    select: { id: true, externalId: true },
    take: 100,
  });

  if (posts.length === 0) return;

  const tweetIds = posts.map(p => p.externalId!).filter(Boolean);
  const batches: string[][] = [];
  for (let i = 0; i < tweetIds.length; i += 100) {
    batches.push(tweetIds.slice(i, i + 100));
  }

  for (const batch of batches) {
    try {
      const url = `https://api.twitter.com/2/tweets?ids=${batch.join(',')}&tweet.fields=public_metrics`;

      // Build bearer token header (simpler for read-only endpoints)
      // For user-auth reads we'd use OAuth 1.0a, but for public metrics
      // a Bearer token (app-only auth) is sufficient if we have one.
      // We reuse the existing access token as bearer if available.
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        console.warn(`[OpsLearning] Twitter poll returned ${response.status}`);
        continue;
      }

      const data = (await response.json()) as {
        data?: Array<{ id: string; public_metrics: Record<string, number> }>;
      };

      for (const tweet of data.data || []) {
        const post = posts.find(p => p.externalId === tweet.id);
        if (!post) continue;

        await prisma.socialPost.update({
          where: { id: post.id },
          data: { engagement: tweet.public_metrics },
        });
      }

      console.log(`[OpsLearning] Twitter engagement polled for ${batch.length} tweets`);
    } catch (err) {
      console.error('[OpsLearning] Twitter engagement poll batch failed:', err);
    }
  }
}
