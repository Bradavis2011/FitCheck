import { Resend } from 'resend';
import { prisma } from '../utils/prisma.js';
import { executeOrQueue } from './agent-manager.service.js';
import { publishToIntelligenceBus, getLatestBusEntry } from './intelligence-bus.service.js';

// ─── Sequence Definitions ─────────────────────────────────────────────────────

interface EmailStep {
  delayMs: number; // delay from previous step (0 for first step)
  subject: string;
  buildHtml: (user: { email: string; name?: string | null; unsubscribeToken?: string; referralCode?: string }, extraData?: unknown) => string;
}

interface SequenceDef {
  steps: EmailStep[];
}

const SEQUENCES: Record<string, SequenceDef> = {
  welcome: {
    steps: [
      {
        delayMs: 0,
        subject: 'Your first outfit verdict',
        buildHtml: (u) => buildEmail(
          'Your first outfit verdict',
          u.name ? `${u.name},` : '',
          `<p style="color:#2D2D2D;font-size:16px;line-height:1.7;margin:0 0 20px;">You'll know in 30 seconds if what you're wearing works — and exactly what to change if it doesn't. No flattery. No vague compliments. Just a score and specific notes.</p>
          <div style="margin:28px 0;">
            <a href="https://orthis.app" style="display:inline-block;background:#E85D4C;color:#fff;text-decoration:none;padding:14px 32px;border-radius:0;font-size:13px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">Check Your Outfit</a>
          </div>`,
        ),
      },
      {
        delayMs: 2 * 24 * 60 * 60 * 1000,
        subject: 'What\'s scoring highest this week',
        buildHtml: (_u, extraData?: unknown) => {
          const topStyles = extraData as Array<{ archetype: string; avgScore: number }> | undefined;
          return buildEmail(
            'What\'s scoring highest this week',
            '',
            `<p style="color:#2D2D2D;font-size:16px;line-height:1.7;margin:0 0 16px;">This week's community averages:</p>
          <ul style="color:#2D2D2D;font-size:15px;line-height:1.9;margin:0 0 16px;padding-left:20px;">
            ${topStyles && topStyles.length > 0
              ? topStyles.map(s => `<li>${s.archetype.charAt(0).toUpperCase() + s.archetype.slice(1)}: averaging ${s.avgScore.toFixed(1)}</li>`).join('')
              : '<li>Monochrome neutrals: averaging 8.2</li><li>Layered streetwear: 7.8</li><li>Smart casual: 7.5</li>'}
          </ul>
          <p style="color:#2D2D2D;font-size:16px;line-height:1.7;margin:0 0 24px;">Where does your style land?</p>
          <div style="margin:28px 0;">
            <a href="https://orthis.app" style="display:inline-block;background:#E85D4C;color:#fff;text-decoration:none;padding:14px 32px;border-radius:0;font-size:13px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">Get Your Score</a>
          </div>`,
          );
        },
      },
      {
        delayMs: 5 * 24 * 60 * 60 * 1000,
        subject: 'The closet you\'re building without trying',
        buildHtml: (_u) => buildEmail(
          'The closet you\'re building without trying',
          '',
          `<p style="color:#2D2D2D;font-size:16px;line-height:1.7;margin:0 0 16px;">Every outfit you check builds a digital wardrobe. After 10 checks, the AI starts suggesting outfits from pieces you already own. After 20, it knows your weak spots.</p>
          <p style="color:#2D2D2D;font-size:16px;line-height:1.7;margin:0 0 24px;">The closet intelligence builds in the background every time you get scored.</p>
          <div style="margin:28px 0;">
            <a href="https://orthis.app" style="display:inline-block;background:#E85D4C;color:#fff;text-decoration:none;padding:14px 32px;border-radius:0;font-size:13px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">Check an Outfit</a>
          </div>`,
        ),
      },
    ],
  },

  onboarding: {
    steps: [
      {
        delayMs: 60 * 60 * 1000, // 1 hour after first check
        subject: 'Three rules the highest-scoring outfits share',
        buildHtml: (_u) => buildEmail(
          'Three rules the highest-scoring outfits share',
          '',
          `<p style="color:#2D2D2D;font-size:16px;line-height:1.7;margin:0 0 20px;">You just got scored. Here's what separates an 8 from a 6.</p>
          <div style="background:#F5EDE7;border-radius:8px;padding:16px 20px;margin:0 0 12px;">
            <p style="color:#E85D4C;font-weight:600;margin:0 0 6px;font-size:13px;letter-spacing:1px;text-transform:uppercase;">The 3-Color Rule</p>
            <p style="color:#2D2D2D;font-size:14px;margin:0;line-height:1.6;">Stick to 3 colors max. Neutrals (black, white, beige, navy) don't count against you.</p>
          </div>
          <div style="background:#F5EDE7;border-radius:8px;padding:16px 20px;margin:0 0 12px;">
            <p style="color:#E85D4C;font-weight:600;margin:0 0 6px;font-size:13px;letter-spacing:1px;text-transform:uppercase;">The Tuck Trick</p>
            <p style="color:#2D2D2D;font-size:14px;margin:0;line-height:1.6;">A half-tuck adds shape and intention instantly. Tuck just the front.</p>
          </div>
          <div style="background:#F5EDE7;border-radius:8px;padding:16px 20px;margin:0 0 24px;">
            <p style="color:#E85D4C;font-weight:600;margin:0 0 6px;font-size:13px;letter-spacing:1px;text-transform:uppercase;">Fit First</p>
            <p style="color:#2D2D2D;font-size:14px;margin:0;line-height:1.6;">A $20 shirt that fits beats a $200 shirt that doesn't. Every time.</p>
          </div>
          <div style="margin:28px 0;">
            <a href="https://orthis.app" style="display:inline-block;background:#E85D4C;color:#fff;text-decoration:none;padding:14px 32px;border-radius:0;font-size:13px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">Check Another Outfit</a>
          </div>`,
        ),
      },
      {
        delayMs: 2 * 24 * 60 * 60 * 1000,
        subject: 'The other side of Or This?',
        buildHtml: (_u) => buildEmail(
          'The other side of Or This?',
          '',
          `<p style="color:#2D2D2D;font-size:16px;line-height:1.7;margin:0 0 16px;">Can't decide between two outfits? Two photos. One verdict. The community weighs in.</p>
          <p style="color:#2D2D2D;font-size:16px;line-height:1.7;margin:0 0 16px;">That's the "Or This?" feature — the reason for the name. Post both looks and let real people tell you which one actually works.</p>
          <p style="color:#2D2D2D;font-size:16px;line-height:1.7;margin:0 0 24px;">Your outfits can also be visible to the community, so other people can score your looks and you can score theirs.</p>
          <div style="margin:28px 0;">
            <a href="https://orthis.app" style="display:inline-block;background:#E85D4C;color:#fff;text-decoration:none;padding:14px 32px;border-radius:0;font-size:13px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">Try Or This?</a>
          </div>`,
        ),
      },
    ],
  },

  reengagement: {
    steps: [
      {
        delayMs: 0,
        subject: 'Your wardrobe is still here',
        buildHtml: (_u) => buildEmail(
          'Your wardrobe is still here',
          '',
          `<p style="color:#2D2D2D;font-size:16px;line-height:1.7;margin:0 0 16px;">The AI has gotten sharper since your last check. Your digital wardrobe hasn't changed.</p>
          <p style="color:#2D2D2D;font-size:16px;line-height:1.7;margin:0 0 24px;">See where your current rotation lands now.</p>
          <div style="margin:28px 0;">
            <a href="https://orthis.app" style="display:inline-block;background:#E85D4C;color:#fff;text-decoration:none;padding:14px 32px;border-radius:0;font-size:13px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">Check an Outfit</a>
          </div>`,
        ),
      },
      {
        delayMs: 3 * 24 * 60 * 60 * 1000,
        subject: 'What\'s working right now',
        buildHtml: (_u, extraData?: unknown) => {
          const topStyles = extraData as Array<{ archetype: string; avgScore: number }> | undefined;
          const topStyle = topStyles && topStyles.length > 0
            ? topStyles[0].archetype.charAt(0).toUpperCase() + topStyles[0].archetype.slice(1)
            : 'Minimalist';
          return buildEmail(
            'What\'s working right now',
            '',
            `<p style="color:#2D2D2D;font-size:16px;line-height:1.7;margin:0 0 16px;">The data says ${topStyle} outfits are scoring highest this week. You might already own the pieces.</p>
          <p style="color:#2D2D2D;font-size:16px;line-height:1.7;margin:0 0 24px;">One check. 30 seconds. See where you land.</p>
          <div style="margin:28px 0;">
            <a href="https://orthis.app" style="display:inline-block;background:#E85D4C;color:#fff;text-decoration:none;padding:14px 32px;border-radius:0;font-size:13px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">Get Your Score</a>
          </div>`,
          );
        },
      },
    ],
  },

  upgrade: {
    steps: [
      {
        delayMs: 0,
        subject: 'You\'ve hit the ceiling',
        buildHtml: (_u) => buildEmail(
          'You\'ve hit the ceiling',
          '',
          `<p style="color:#2D2D2D;font-size:16px;line-height:1.7;margin:0 0 16px;">3 checks a day. 3 follow-ups per outfit. 30-day history. Here's what changes with Plus:</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border-collapse:collapse;">
            <thead>
              <tr style="background:#F5EDE7;">
                <th style="padding:10px 12px;text-align:left;font-size:13px;color:#2D2D2D;letter-spacing:0.5px;">Feature</th>
                <th style="padding:10px 12px;text-align:center;font-size:13px;color:#2D2D2D;">Free</th>
                <th style="padding:10px 12px;text-align:center;font-size:13px;color:#E85D4C;">Plus</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style="padding:10px 12px;font-size:14px;border-bottom:1px solid #F5EDE7;">Daily outfit checks</td><td style="padding:10px 12px;text-align:center;font-size:14px;border-bottom:1px solid #F5EDE7;">3</td><td style="padding:10px 12px;text-align:center;font-size:14px;border-bottom:1px solid #F5EDE7;color:#E85D4C;font-weight:600;">Unlimited</td></tr>
              <tr><td style="padding:10px 12px;font-size:14px;border-bottom:1px solid #F5EDE7;">AI follow-up questions</td><td style="padding:10px 12px;text-align:center;font-size:14px;border-bottom:1px solid #F5EDE7;">3/outfit</td><td style="padding:10px 12px;text-align:center;font-size:14px;border-bottom:1px solid #F5EDE7;color:#E85D4C;font-weight:600;">Unlimited</td></tr>
              <tr><td style="padding:10px 12px;font-size:14px;border-bottom:1px solid #F5EDE7;">AI wardrobe suggestions</td><td style="padding:10px 12px;text-align:center;font-size:14px;border-bottom:1px solid #F5EDE7;">—</td><td style="padding:10px 12px;text-align:center;font-size:14px;border-bottom:1px solid #F5EDE7;color:#E85D4C;font-weight:600;">Daily pick</td></tr>
              <tr><td style="padding:10px 12px;font-size:14px;">Outfit history</td><td style="padding:10px 12px;text-align:center;font-size:14px;">30 days</td><td style="padding:10px 12px;text-align:center;font-size:14px;color:#E85D4C;font-weight:600;">Unlimited</td></tr>
            </tbody>
          </table>
          <div style="margin:28px 0;">
            <a href="https://orthis.app" style="display:inline-block;background:#E85D4C;color:#fff;text-decoration:none;padding:14px 32px;border-radius:0;font-size:13px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">See Plans</a>
          </div>`,
        ),
      },
    ],
  },

  churn_prevention: {
    steps: [
      {
        delayMs: 0,
        subject: 'Your Pro subscription is active',
        buildHtml: (_u) => buildEmail(
          'Your Pro subscription is active',
          '',
          `<p style="color:#2D2D2D;font-size:16px;line-height:1.7;margin:0 0 16px;">Unlimited outfit checks. AI wardrobe suggestions from your actual closet. Personalized style articles. All active.</p>
          <p style="color:#2D2D2D;font-size:16px;line-height:1.7;margin:0 0 24px;">What's the next outfit on your mind?</p>
          <div style="margin:28px 0;">
            <a href="https://orthis.app" style="display:inline-block;background:#E85D4C;color:#fff;text-decoration:none;padding:14px 32px;border-radius:0;font-size:13px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">Check an Outfit</a>
          </div>`,
        ),
      },
      {
        delayMs: 3 * 24 * 60 * 60 * 1000,
        subject: 'What changed while you were away',
        buildHtml: (_u) => buildEmail(
          'What changed while you were away',
          '',
          `<p style="color:#2D2D2D;font-size:16px;line-height:1.7;margin:0 0 16px;">Since your last check, we've shipped:</p>
          <ul style="color:#2D2D2D;font-size:15px;line-height:1.9;margin:0 0 16px;padding-left:20px;">
            <li><strong>Noa, your AI stylist</strong> — chat directly about your wardrobe and style</li>
            <li><strong>Daily outfit picks</strong> — Noa suggests outfits from your actual wardrobe each morning</li>
            <li><strong>Style Journal</strong> — 5 personalized articles based on your data</li>
            <li><strong>Smarter AI</strong> — feedback improves as your check history grows</li>
          </ul>
          <div style="margin:28px 0;">
            <a href="https://orthis.app" style="display:inline-block;background:#E85D4C;color:#fff;text-decoration:none;padding:14px 32px;border-radius:0;font-size:13px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">See What's New</a>
          </div>`,
        ),
      },
    ],
  },
};

// ─── Email HTML Builder ───────────────────────────────────────────────────────

function buildEmail(_title: string, headline: string, bodyHtml: string, unsubscribeToken?: string, referralCode?: string): string {
  const baseUrl = process.env.API_BASE_URL || 'https://fitcheck-production-0f92.up.railway.app';
  const unsubscribeUrl = unsubscribeToken
    ? `${baseUrl}/api/email/unsubscribe/${unsubscribeToken}`
    : `https://orthis.app/unsubscribe`;

  const referralBaseUrl = process.env.REFERRAL_BASE_URL || 'https://orthis.app/invite';
  const referralSection = referralCode ? `
        <tr>
          <td style="padding:0 40px 20px;">
            <div style="background:#F5EDE7;border-radius:8px;padding:16px 20px;text-align:center;">
              <p style="color:#2D2D2D;font-size:13px;margin:0 0 8px;font-weight:600;">Invite a friend, earn bonus checks</p>
              <p style="color:#6B7280;font-size:12px;margin:0 0 10px;">Share your link and get +1 daily check when they sign up:</p>
              <a href="${referralBaseUrl}/${referralCode}" style="color:#E85D4C;font-size:13px;font-weight:600;text-decoration:none;word-break:break-all;">${referralBaseUrl}/${referralCode}</a>
            </div>
          </td>
        </tr>` : '';

  const headlineHtml = headline
    ? `<p style="color:#6B7280;font-size:13px;margin:0 0 20px;">${headline}</p>`
    : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FBF7F4;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FBF7F4;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;">
        <tr>
          <td style="background:#E85D4C;padding:24px 40px;">
            <div style="font-size:20px;font-weight:500;color:#fff;letter-spacing:-0.3px;font-family:'DM Sans',Arial,sans-serif;">Or <span style="font-style:italic;font-family:Georgia,serif;">This?</span></div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px 24px;">
            ${headlineHtml}
            ${bodyHtml}
          </td>
        </tr>
        ${referralSection}
        <tr>
          <td style="padding:20px 40px 28px;border-top:1px solid #F5EDE7;">
            <p style="color:#9CA3AF;font-size:12px;margin:0;line-height:1.6;">
              You're receiving this because you signed up for Or This?. Questions? Reply to this email or visit <a href="https://orthis.app" style="color:#E85D4C;text-decoration:none;">orthis.app</a><br>
              <a href="${unsubscribeUrl}" style="color:#9CA3AF;text-decoration:underline;font-size:11px;">Unsubscribe from marketing emails</a>
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
        select: { id: true, email: true, name: true, emailOptOut: true, unsubscribeToken: true, referralCode: true },
      });

      if (!user || !user.email) {
        await prisma.emailSequence.update({
          where: { id: seq.id },
          data: { status: 'cancelled' },
        });
        continue;
      }

      // GDPR/CAN-SPAM: skip opted-out users
      if (user.emailOptOut) {
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

      const baseHtmlBody = step.buildHtml({ ...user, unsubscribeToken: user.unsubscribeToken ?? undefined, referralCode: user.referralCode ?? undefined }, extraData);
      // Inject referral section into the email HTML (buildEmail already handles this via the referralCode param, but
      // since individual step lambdas don't pass it, we inject it via string replacement as a clean catch-all)
      const htmlBody = user.referralCode
        ? baseHtmlBody.replace(
            /<td style="padding:20px 40px 28px;border-top/,
            `<td style="padding:0 40px 20px;"><div style="background:#F5EDE7;border-radius:8px;padding:16px 20px;text-align:center;"><p style="color:#2D2D2D;font-size:13px;margin:0 0 8px;font-weight:600;letter-spacing:0.5px;">Invite a friend, earn bonus checks</p><p style="color:#6B7280;font-size:12px;margin:0 0 10px;">Share your link and get +1 daily check when they sign up:</p><a href="${(process.env.REFERRAL_BASE_URL || 'https://orthis.app/invite')}/${user.referralCode}" style="color:#E85D4C;font-size:13px;font-weight:600;text-decoration:none;">${(process.env.REFERRAL_BASE_URL || 'https://orthis.app/invite')}/${user.referralCode}</a></div></td></tr><tr><td style="padding:20px 40px 28px;border-top`
          )
        : baseHtmlBody;
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

  // A4: Read churn_metrics from bus — prioritize churn_prevention for high-risk users
  try {
    const churnEntry = await getLatestBusEntry('churn_metrics');
    const churnPayload = churnEntry?.payload as Record<string, unknown> | null;
    if (churnPayload && (churnPayload.highRiskCount as number) > 0) {
      console.log(`[LifecycleEmail] churn_metrics: ${churnPayload.highRiskCount} high-risk users — triggering churn_prevention for scored users without active sequence`);
      await triggerChurnPreventionForRiskyUsers();
    }
  } catch (err) {
    console.error('[LifecycleEmail] churn_metrics read failed:', err);
  }

  await triggerNewSequences();
  await processDueSequences();
  // Publish email metrics to bus every run (cheap DB aggregation)
  await publishEmailMetrics().catch(err => console.error('[LifecycleEmail] Metrics publish failed:', err));
  console.log('[LifecycleEmail] Run complete');
}

/** A4: Trigger churn_prevention for any user (any tier) with riskScore >= 0.6 and no active sequence */
async function triggerChurnPreventionForRiskyUsers(): Promise<void> {
  const now = new Date();
  try {
    const highRiskUsers = await prisma.churnRiskScore.findMany({
      where: { riskScore: { gte: 0.6 } },
      select: { userId: true },
    });

    let triggered = 0;
    for (const { userId } of highRiskUsers) {
      const existing = await prisma.emailSequence.findUnique({
        where: { userId_sequence: { userId, sequence: 'churn_prevention' } },
      });
      if (!existing) {
        await prisma.emailSequence.create({
          data: { userId, sequence: 'churn_prevention', currentStep: 0, status: 'active', nextSendAt: now },
        });
        triggered++;
      }
    }
    if (triggered > 0) {
      console.log(`[LifecycleEmail] Triggered churn_prevention for ${triggered} high-risk user(s)`);
    }
  } catch (err) {
    console.error('[LifecycleEmail] triggerChurnPreventionForRiskyUsers failed:', err);
  }
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
