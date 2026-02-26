import { Resend } from 'resend';
import { prisma } from '../utils/prisma.js';
import { executeOrQueue } from './agent-manager.service.js';
import { publishToIntelligenceBus } from './intelligence-bus.service.js';

// ─── Sequence Definitions ─────────────────────────────────────────────────────

interface EmailStep {
  delayMs: number; // delay from previous step (0 for first step)
  subject: string;
  buildHtml: (user: { email: string; name?: string | null }, extraData?: unknown) => string;
}

interface SequenceDef {
  steps: EmailStep[];
}

const SEQUENCES: Record<string, SequenceDef> = {
  welcome: {
    steps: [
      {
        delayMs: 0,
        subject: 'Welcome to Or This? 👗',
        buildHtml: (u) => buildEmail(
          'Welcome to Or This?',
          u.name ? `Hey ${u.name}! 👋` : 'Hey there! 👋',
          `<p style="color:#2D2D2D;font-size:15px;line-height:1.6;margin:0 0 16px;">You've just joined the app that gives you <strong>real AI style feedback</strong> in seconds. Think of it as having a personal stylist in your pocket.</p>
          <p style="color:#2D2D2D;font-size:15px;line-height:1.6;margin:0 0 16px;">Here's how it works:</p>
          <ol style="color:#2D2D2D;font-size:15px;line-height:1.8;margin:0 0 16px;padding-left:20px;">
            <li>Snap a photo of your outfit</li>
            <li>Tell us the occasion</li>
            <li>Get your score + personalized tips</li>
          </ol>
          <p style="color:#2D2D2D;font-size:15px;line-height:1.6;margin:0 0 24px;">Ready to see how your outfits stack up?</p>
          <div style="text-align:center;margin:24px 0;">
            <a href="https://orthis.app" style="display:inline-block;background:linear-gradient(135deg,#E85D4C,#FF7A6B);color:#fff;text-decoration:none;padding:14px 32px;border-radius:50px;font-size:15px;font-weight:600;">Check My First Outfit</a>
          </div>`,
        ),
      },
      {
        delayMs: 2 * 24 * 60 * 60 * 1000,
        subject: 'See what the Or This? community is wearing',
        buildHtml: (u) => buildEmail(
          'Community Highlights',
          `What's trending this week${u.name ? `, ${u.name}` : ''}`,
          `<p style="color:#2D2D2D;font-size:15px;line-height:1.6;margin:0 0 16px;">The Or This? community has been busy! Members are getting feedback on everything from weekend brunch looks to job interview outfits.</p>
          <p style="color:#2D2D2D;font-size:15px;line-height:1.6;margin:0 0 16px;">The most popular occasions this week? <strong>Date nights, casual Fridays, and job interviews</strong>.</p>
          <p style="color:#2D2D2D;font-size:15px;line-height:1.6;margin:0 0 24px;">What's your next big outfit moment? Let's make sure it's perfect. ✨</p>
          <div style="text-align:center;margin:24px 0;">
            <a href="https://orthis.app" style="display:inline-block;background:linear-gradient(135deg,#E85D4C,#FF7A6B);color:#fff;text-decoration:none;padding:14px 32px;border-radius:50px;font-size:15px;font-weight:600;">Get Outfit Feedback</a>
          </div>`,
        ),
      },
      {
        delayMs: 5 * 24 * 60 * 60 * 1000,
        subject: 'Your style story starts here',
        buildHtml: (u) => buildEmail(
          'Your Style Journey',
          `Ready to start your style story${u.name ? `, ${u.name}` : ''}?`,
          `<p style="color:#2D2D2D;font-size:15px;line-height:1.6;margin:0 0 16px;">Every great style journey starts with one outfit. Our AI gives you a score from 1-10 plus specific, actionable tips — not vague compliments.</p>
          <p style="color:#2D2D2D;font-size:15px;line-height:1.6;margin:0 0 16px;"><strong>What you'll get:</strong></p>
          <ul style="color:#2D2D2D;font-size:15px;line-height:1.8;margin:0 0 24px;padding-left:20px;">
            <li>An outfit score with clear reasoning</li>
            <li>What's working (and what to keep)</li>
            <li>Specific suggestions to level up</li>
            <li>Quick wins you can do right now</li>
          </ul>
          <div style="text-align:center;margin:24px 0;">
            <a href="https://orthis.app" style="display:inline-block;background:linear-gradient(135deg,#E85D4C,#FF7A6B);color:#fff;text-decoration:none;padding:14px 32px;border-radius:50px;font-size:15px;font-weight:600;">Start My First Check</a>
          </div>`,
        ),
      },
    ],
  },

  onboarding: {
    steps: [
      {
        delayMs: 60 * 60 * 1000, // 1 hour after first check
        subject: 'Your outfit results + pro styling tips',
        buildHtml: (u) => buildEmail(
          'Styling Tips',
          `Nice work${u.name ? `, ${u.name}` : ''}! Here are some pro tips`,
          `<p style="color:#2D2D2D;font-size:15px;line-height:1.6;margin:0 0 16px;">You've gotten your first AI outfit score — that's a big deal! Here are some styling tips our community loves:</p>
          <div style="background:#F5EDE7;border-radius:12px;padding:16px 20px;margin:0 0 16px;">
            <p style="color:#E85D4C;font-weight:600;margin:0 0 8px;font-size:14px;">💡 The 3-Color Rule</p>
            <p style="color:#2D2D2D;font-size:14px;margin:0;line-height:1.5;">Stick to 3 colors max per outfit. More tends to look busy. Neutrals (black, white, beige, navy) don't count!</p>
          </div>
          <div style="background:#F5EDE7;border-radius:12px;padding:16px 20px;margin:0 0 16px;">
            <p style="color:#E85D4C;font-weight:600;margin:0 0 8px;font-size:14px;">💡 The Tuck Trick</p>
            <p style="color:#2D2D2D;font-size:14px;margin:0;line-height:1.5;">A half-tuck transforms any outfit instantly. Tuck just the front of your shirt to add shape and intention.</p>
          </div>
          <div style="background:#F5EDE7;border-radius:12px;padding:16px 20px;margin:0 0 24px;">
            <p style="color:#E85D4C;font-weight:600;margin:0 0 8px;font-size:14px;">💡 Fit First, Always</p>
            <p style="color:#2D2D2D;font-size:14px;margin:0;line-height:1.5;">A $20 shirt that fits well looks better than a $200 shirt that doesn't. Fit is everything.</p>
          </div>
          <div style="text-align:center;margin:24px 0;">
            <a href="https://orthis.app" style="display:inline-block;background:linear-gradient(135deg,#E85D4C,#FF7A6B);color:#fff;text-decoration:none;padding:14px 32px;border-radius:50px;font-size:15px;font-weight:600;">Check Another Outfit</a>
          </div>`,
        ),
      },
      {
        delayMs: 2 * 24 * 60 * 60 * 1000,
        subject: 'Meet the Or This? community',
        buildHtml: (u) => buildEmail(
          'Join the Community',
          `There's more to Or This? than AI${u.name ? `, ${u.name}` : ''}`,
          `<p style="color:#2D2D2D;font-size:15px;line-height:1.6;margin:0 0 16px;">Beyond AI feedback, Or This? has a real community of style-minded people. You can:</p>
          <ul style="color:#2D2D2D;font-size:15px;line-height:1.8;margin:0 0 24px;padding-left:20px;">
            <li><strong>Share your outfits publicly</strong> and get community feedback</li>
            <li><strong>Browse the community feed</strong> for style inspiration</li>
            <li><strong>Enter weekly style challenges</strong> to win features</li>
            <li><strong>Post "Or This?"</strong> — side-by-side outfit comparisons for the community to vote</li>
          </ul>
          <div style="text-align:center;margin:24px 0;">
            <a href="https://orthis.app" style="display:inline-block;background:linear-gradient(135deg,#E85D4C,#FF7A6B);color:#fff;text-decoration:none;padding:14px 32px;border-radius:50px;font-size:15px;font-weight:600;">Explore the Community</a>
          </div>`,
        ),
      },
    ],
  },

  reengagement: {
    steps: [
      {
        delayMs: 0,
        subject: 'We miss your style! ✨',
        buildHtml: (u) => buildEmail(
          'We Miss You',
          `It\'s been a while${u.name ? `, ${u.name}` : ''}`,
          `<p style="color:#2D2D2D;font-size:15px;line-height:1.6;margin:0 0 16px;">Your style journey isn't over — it's just on pause. Come back and see how your current outfits score with our updated AI.</p>
          <p style="color:#2D2D2D;font-size:15px;line-height:1.6;margin:0 0 24px;">Whether you're dressing for work, a special occasion, or just want to feel great today — we're here for it.</p>
          <div style="text-align:center;margin:24px 0;">
            <a href="https://orthis.app" style="display:inline-block;background:linear-gradient(135deg,#E85D4C,#FF7A6B);color:#fff;text-decoration:none;padding:14px 32px;border-radius:50px;font-size:15px;font-weight:600;">Get Back in the Game</a>
          </div>`,
        ),
      },
      {
        delayMs: 3 * 24 * 60 * 60 * 1000,
        subject: 'Top looks this week — get inspired',
        buildHtml: (u, topStyles?: Array<{ archetype: string; avgScore: number }>) => buildEmail(
          'Style Inspiration',
          `Fresh styles from the community${u.name ? `, ${u.name}` : ''}`,
          `<p style="color:#2D2D2D;font-size:15px;line-height:1.6;margin:0 0 16px;">The Or This? community has been posting some amazing looks. The top-scoring styles this week are:</p>
          <ul style="color:#2D2D2D;font-size:15px;line-height:1.8;margin:0 0 16px;padding-left:20px;">
            ${topStyles && topStyles.length > 0
              ? topStyles.map(s => `<li>${s.archetype.charAt(0).toUpperCase() + s.archetype.slice(1)} (scoring ${s.avgScore.toFixed(1)} avg)</li>`).join('')
              : '<li>Minimalist monochrome</li><li>Smart casual with a pop of color</li><li>Elevated streetwear layering</li>'}
          </ul>
          <p style="color:#2D2D2D;font-size:15px;line-height:1.6;margin:0 0 24px;">Ready to see where your outfits land?</p>
          <div style="text-align:center;margin:24px 0;">
            <a href="https://orthis.app" style="display:inline-block;background:linear-gradient(135deg,#E85D4C,#FF7A6B);color:#fff;text-decoration:none;padding:14px 32px;border-radius:50px;font-size:15px;font-weight:600;">Check My Outfit</a>
          </div>`,
        ),
      },
    ],
  },

  upgrade: {
    steps: [
      {
        delayMs: 0,
        subject: 'You\'re getting the most out of Or This? — here\'s more',
        buildHtml: (u) => buildEmail(
          'Upgrade to Pro',
          `You\'re a power user${u.name ? `, ${u.name}` : ''}`,
          `<p style="color:#2D2D2D;font-size:15px;line-height:1.6;margin:0 0 16px;">You've been using Or This? like a pro — which means you're probably hitting the free tier limits. Here's what you unlock with Or This? Pro:</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border-collapse:collapse;">
            <thead>
              <tr style="background:#F5EDE7;">
                <th style="padding:10px 12px;text-align:left;font-size:13px;color:#2D2D2D;">Feature</th>
                <th style="padding:10px 12px;text-align:center;font-size:13px;color:#2D2D2D;">Free</th>
                <th style="padding:10px 12px;text-align:center;font-size:13px;color:#E85D4C;">Pro</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style="padding:10px 12px;font-size:14px;border-bottom:1px solid #F5EDE7;">Daily outfit checks</td><td style="padding:10px 12px;text-align:center;font-size:14px;border-bottom:1px solid #F5EDE7;">3</td><td style="padding:10px 12px;text-align:center;font-size:14px;border-bottom:1px solid #F5EDE7;color:#E85D4C;font-weight:600;">Unlimited</td></tr>
              <tr><td style="padding:10px 12px;font-size:14px;border-bottom:1px solid #F5EDE7;">AI follow-up questions</td><td style="padding:10px 12px;text-align:center;font-size:14px;border-bottom:1px solid #F5EDE7;">3/outfit</td><td style="padding:10px 12px;text-align:center;font-size:14px;border-bottom:1px solid #F5EDE7;color:#E85D4C;font-weight:600;">Unlimited</td></tr>
              <tr><td style="padding:10px 12px;font-size:14px;border-bottom:1px solid #F5EDE7;">Detailed style analysis</td><td style="padding:10px 12px;text-align:center;font-size:14px;border-bottom:1px solid #F5EDE7;">Basic</td><td style="padding:10px 12px;text-align:center;font-size:14px;border-bottom:1px solid #F5EDE7;color:#E85D4C;font-weight:600;">Full report</td></tr>
              <tr><td style="padding:10px 12px;font-size:14px;">Outfit history</td><td style="padding:10px 12px;text-align:center;font-size:14px;">Last 30</td><td style="padding:10px 12px;text-align:center;font-size:14px;color:#E85D4C;font-weight:600;">Unlimited</td></tr>
            </tbody>
          </table>
          <div style="text-align:center;margin:24px 0;">
            <a href="https://orthis.app" style="display:inline-block;background:linear-gradient(135deg,#E85D4C,#FF7A6B);color:#fff;text-decoration:none;padding:14px 32px;border-radius:50px;font-size:15px;font-weight:600;">Upgrade to Pro</a>
          </div>`,
        ),
      },
    ],
  },

  churn_prevention: {
    steps: [
      {
        delayMs: 0,
        subject: 'Your Pro benefits are waiting 💎',
        buildHtml: (u) => buildEmail(
          'Your Benefits Are Active',
          `Don\'t let your Pro subscription go to waste${u.name ? `, ${u.name}` : ''}`,
          `<p style="color:#2D2D2D;font-size:15px;line-height:1.6;margin:0 0 16px;">You have an active Or This? Pro subscription — which means unlimited outfit checks, detailed analysis, and all the good stuff. It's just waiting for you.</p>
          <p style="color:#2D2D2D;font-size:15px;line-height:1.6;margin:0 0 24px;">What outfit has been sitting in your head lately? Let's get it checked. ✨</p>
          <div style="text-align:center;margin:24px 0;">
            <a href="https://orthis.app" style="display:inline-block;background:linear-gradient(135deg,#E85D4C,#FF7A6B);color:#fff;text-decoration:none;padding:14px 32px;border-radius:50px;font-size:15px;font-weight:600;">Use My Pro Benefits</a>
          </div>`,
        ),
      },
      {
        delayMs: 3 * 24 * 60 * 60 * 1000,
        subject: 'Here\'s what\'s new in Or This?',
        buildHtml: (u) => buildEmail(
          'What\'s New',
          `We\'ve been busy improving Or This?${u.name ? `, ${u.name}` : ''}`,
          `<p style="color:#2D2D2D;font-size:15px;line-height:1.6;margin:0 0 16px;">Since your last visit, we've been making Or This? even better:</p>
          <ul style="color:#2D2D2D;font-size:15px;line-height:1.8;margin:0 0 16px;padding-left:20px;">
            <li><strong>Improved AI feedback</strong> — more specific, more actionable</li>
            <li><strong>Weekly style challenges</strong> — compete with the community</li>
            <li><strong>Outfit comparison</strong> — "Or This?" side-by-side voting</li>
            <li><strong>Wardrobe tracker</strong> — catalogue your closet</li>
          </ul>
          <div style="text-align:center;margin:24px 0;">
            <a href="https://orthis.app" style="display:inline-block;background:linear-gradient(135deg,#E85D4C,#FF7A6B);color:#fff;text-decoration:none;padding:14px 32px;border-radius:50px;font-size:15px;font-weight:600;">Explore What\'s New</a>
          </div>`,
        ),
      },
    ],
  },
};

// ─── Email HTML Builder ───────────────────────────────────────────────────────

function buildEmail(title: string, headline: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FBF7F4;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FBF7F4;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#E85D4C,#FF7A6B);padding:28px 40px;text-align:center;">
            <div style="font-size:26px;font-weight:700;color:#fff;letter-spacing:-0.5px;">Or This?</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.8);margin-top:4px;">Confidence in every choice</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <h2 style="color:#1A1A1A;font-size:20px;font-weight:700;margin:0 0 20px;line-height:1.3;">${headline}</h2>
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px 28px;border-top:1px solid #F5EDE7;">
            <p style="color:#6B7280;font-size:12px;margin:0;line-height:1.5;">
              You're receiving this because you signed up for Or This?.<br>
              Questions? Reply to this email or visit <a href="https://orthis.app" style="color:#E85D4C;text-decoration:none;">orthis.app</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Sequence Triggering ──────────────────────────────────────────────────────

async function triggerNewSequences(): Promise<void> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sevenToFourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

  // ── Welcome: users signed up < 7 days ago with no welcome sequence ──
  try {
    const newUsers = await prisma.user.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo },
        email: { not: undefined },
      },
      select: { id: true, email: true },
    });

    for (const user of newUsers) {
      const existing = await prisma.emailSequence.findUnique({
        where: { userId_sequence: { userId: user.id, sequence: 'welcome' } },
      });
      if (!existing) {
        await prisma.emailSequence.create({
          data: {
            userId: user.id,
            sequence: 'welcome',
            currentStep: 0,
            status: 'active',
            nextSendAt: now,
          },
        });
      }
    }
  } catch (err) {
    console.error('[LifecycleEmail] Failed to trigger welcome sequences:', err);
  }

  // ── Onboarding: users with 1+ outfit checks, no onboarding sequence ──
  try {
    const usersWithChecks = await prisma.outfitCheck.findMany({
      where: { isDeleted: false },
      select: { userId: true, createdAt: true },
      distinct: ['userId'],
      orderBy: { createdAt: 'asc' },
    });

    for (const { userId, createdAt } of usersWithChecks) {
      const existing = await prisma.emailSequence.findUnique({
        where: { userId_sequence: { userId, sequence: 'onboarding' } },
      });
      if (!existing) {
        const oneHourAfterFirstCheck = new Date(createdAt.getTime() + 60 * 60 * 1000);
        const nextSendAt = oneHourAfterFirstCheck < now ? now : oneHourAfterFirstCheck;
        await prisma.emailSequence.create({
          data: { userId, sequence: 'onboarding', currentStep: 0, status: 'active', nextSendAt },
        });
      }
    }
  } catch (err) {
    console.error('[LifecycleEmail] Failed to trigger onboarding sequences:', err);
  }

  // ── Reengagement: users with last check 7-14 days ago, no active reengagement ──
  try {
    const inactiveUsers = await prisma.outfitCheck.findMany({
      where: {
        isDeleted: false,
        createdAt: { gte: sevenToFourteenDaysAgo, lt: sevenDaysAgo },
      },
      select: { userId: true },
      distinct: ['userId'],
    });

    for (const { userId } of inactiveUsers) {
      const hasRecentCheck = await prisma.outfitCheck.findFirst({
        where: { userId, isDeleted: false, createdAt: { gte: sevenDaysAgo } },
      });
      if (hasRecentCheck) continue;

      const existing = await prisma.emailSequence.findUnique({
        where: { userId_sequence: { userId, sequence: 'reengagement' } },
      });
      if (!existing) {
        await prisma.emailSequence.create({
          data: { userId, sequence: 'reengagement', currentStep: 0, status: 'active', nextSendAt: now },
        });
      }
    }
  } catch (err) {
    console.error('[LifecycleEmail] Failed to trigger reengagement sequences:', err);
  }

  // ── Churn prevention: paid users inactive 5+ days ──
  try {
    const paidUsers = await prisma.user.findMany({
      where: { tier: { in: ['plus', 'pro'] } },
      select: { id: true },
    });

    for (const { id } of paidUsers) {
      const recentCheck = await prisma.outfitCheck.findFirst({
        where: { userId: id, isDeleted: false, createdAt: { gte: fiveDaysAgo } },
      });
      if (recentCheck) continue;

      const hasOutfit = await prisma.outfitCheck.findFirst({
        where: { userId: id, isDeleted: false },
      });
      if (!hasOutfit) continue;

      const existing = await prisma.emailSequence.findUnique({
        where: { userId_sequence: { userId: id, sequence: 'churn_prevention' } },
      });
      if (!existing) {
        await prisma.emailSequence.create({
          data: { userId: id, sequence: 'churn_prevention', currentStep: 0, status: 'active', nextSendAt: now },
        });
      }
    }
  } catch (err) {
    console.error('[LifecycleEmail] Failed to trigger churn_prevention sequences:', err);
  }
}

// ─── Real Data: Top Styles for Reengagement Email ────────────────────────────

async function getTopStylesForEmail(): Promise<Array<{ archetype: string; avgScore: number }>> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const recentDNA = await prisma.styleDNA.findMany({
    where: { createdAt: { gte: weekAgo } },
    select: {
      styleArchetypes: true,
      outfitCheck: { select: { aiScore: true } },
    },
    take: 500,
  });

  const archetypeScores = new Map<string, number[]>();
  for (const dna of recentDNA) {
    const score = dna.outfitCheck?.aiScore;
    if (!score) continue;
    for (const archetype of dna.styleArchetypes) {
      if (!archetypeScores.has(archetype)) archetypeScores.set(archetype, []);
      archetypeScores.get(archetype)!.push(score);
    }
  }

  return [...archetypeScores.entries()]
    .map(([archetype, scores]) => ({
      archetype,
      avgScore: scores.reduce((s, v) => s + v, 0) / scores.length,
    }))
    .filter(s => s.avgScore >= 7.5)
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 3);
}

// ─── Variant Subject Selection ────────────────────────────────────────────────

async function getVariantSubject(
  sequence: string,
  step: number,
  defaultSubject: string,
): Promise<string> {
  // 50/50 A/B split: if no variants, use default
  const variants = await prisma.emailTemplateVariant.findMany({
    where: { sequence, step, field: 'subject', isWinner: null },
  });

  if (variants.length === 0) return defaultSubject;

  // Find winner if one has been promoted
  const winner = await prisma.emailTemplateVariant.findFirst({
    where: { sequence, step, field: 'subject', isWinner: true },
  });
  if (winner) return winner.variant;

  // 50/50 split between control and best variant
  const nonControl = variants.find(v => !v.isControl);
  if (!nonControl) return defaultSubject;

  const useVariant = Math.random() < 0.5;
  if (useVariant) {
    await prisma.emailTemplateVariant.update({
      where: { id: nonControl.id },
      data: { impressions: { increment: 1 } },
    });
    return nonControl.variant;
  }

  return defaultSubject;
}

// ─── Publish Email Metrics to Bus ────────────────────────────────────────────

async function publishEmailMetrics(): Promise<void> {
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const events = await prisma.emailEvent.groupBy({
    by: ['sequence', 'step', 'status'],
    where: { sentAt: { gte: fourteenDaysAgo } },
    _count: { id: true },
  });

  const summary: Record<string, Record<string, number>> = {};
  for (const e of events) {
    const key = `${e.sequence}:${e.step}`;
    if (!summary[key]) summary[key] = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 };
    summary[key][e.status] = (summary[key][e.status] || 0) + e._count.id;
  }

  await publishToIntelligenceBus('lifecycle-email', 'email_metrics', {
    measuredAt: new Date().toISOString(),
    summary,
  });
}

// ─── Process Due Steps ────────────────────────────────────────────────────────

async function processDueSequences(): Promise<void> {
  const now = new Date();
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  const fromEmail = process.env.REPORT_FROM_EMAIL || 'hello@orthis.app';

  if (!resend) {
    console.log('[LifecycleEmail] RESEND_API_KEY not set — skipping email sends');
    return;
  }

  const dueSequences = await prisma.emailSequence.findMany({
    where: { status: 'active', nextSendAt: { lte: now } },
    take: 100,
  });

  if (dueSequences.length === 0) return;
  console.log(`[LifecycleEmail] Processing ${dueSequences.length} due sequence(s)...`);

  // Pre-fetch real top styles for reengagement step 1
  let topStyles: Array<{ archetype: string; avgScore: number }> = [];
  const hasReengagementStep1 = dueSequences.some(s => s.sequence === 'reengagement' && s.currentStep === 1);
  if (hasReengagementStep1) {
    topStyles = await getTopStylesForEmail().catch(() => []);
  }

  for (const seq of dueSequences) {
    try {
      const seqDef = SEQUENCES[seq.sequence];
      if (!seqDef) {
        await prisma.emailSequence.update({
          where: { id: seq.id },
          data: { status: 'cancelled' },
        });
        continue;
      }

      const step = seqDef.steps[seq.currentStep];
      if (!step) {
        await prisma.emailSequence.update({
          where: { id: seq.id },
          data: { status: 'completed', completedAt: now },
        });
        continue;
      }

      const user = await prisma.user.findUnique({
        where: { id: seq.userId },
        select: { id: true, email: true, name: true },
      });

      if (!user || !user.email) {
        await prisma.emailSequence.update({
          where: { id: seq.id },
          data: { status: 'cancelled' },
        });
        continue;
      }

      // A/B variant subject selection
      const subject = await getVariantSubject(seq.sequence, seq.currentStep, step.subject);

      // Inject real data into reengagement step 1
      const extraData = (seq.sequence === 'reengagement' && seq.currentStep === 1)
        ? topStyles
        : undefined;

      const htmlBody = step.buildHtml(user, extraData);
      const payload = {
        seqId: seq.id,
        userId: seq.userId,
        userEmail: user.email,
        sequence: seq.sequence,
        step: seq.currentStep,
        subject,
      };

      await executeOrQueue(
        'lifecycle-email',
        'send_email',
        'medium',
        payload as unknown as Record<string, unknown>,
        async (p) => {
          const data = p as typeof payload;
          await resend.emails.send({
            from: fromEmail,
            to: data.userEmail,
            subject: data.subject,
            html: htmlBody,
          });

          await prisma.emailEvent.create({
            data: {
              userId: data.userId,
              sequence: data.sequence,
              step: data.step,
              subject: data.subject,
              status: 'sent',
            },
          });

          const nextStepIndex = data.step + 1;
          const nextStep = seqDef.steps[nextStepIndex];
          if (!nextStep) {
            await prisma.emailSequence.update({
              where: { id: data.seqId },
              data: { status: 'completed', completedAt: new Date(), currentStep: nextStepIndex },
            });
          } else {
            await prisma.emailSequence.update({
              where: { id: data.seqId },
              data: {
                currentStep: nextStepIndex,
                nextSendAt: new Date(Date.now() + nextStep.delayMs),
              },
            });
          }

          return { sent: true, to: data.userEmail, step: data.step };
        },
        step.subject,
      );
    } catch (err) {
      console.error(`[LifecycleEmail] Failed to process sequence ${seq.id}:`, err);
    }
  }
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export async function runLifecycleEmail(): Promise<void> {
  console.log('[LifecycleEmail] Starting run...');
  await triggerNewSequences();
  await processDueSequences();
  // Publish email metrics to bus every run (cheap DB aggregation)
  await publishEmailMetrics().catch(err => console.error('[LifecycleEmail] Metrics publish failed:', err));
  console.log('[LifecycleEmail] Run complete');
}

// Allow external trigger of upgrade sequence for a specific user
export async function triggerUpgradeSequence(userId: string): Promise<void> {
  const existing = await prisma.emailSequence.findUnique({
    where: { userId_sequence: { userId, sequence: 'upgrade' } },
  });
  if (!existing) {
    await prisma.emailSequence.create({
      data: { userId, sequence: 'upgrade', currentStep: 0, status: 'active', nextSendAt: new Date() },
    });
  }
}
