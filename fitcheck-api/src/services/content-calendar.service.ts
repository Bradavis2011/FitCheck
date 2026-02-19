import { GoogleGenerativeAI } from '@google/generative-ai';
import { Resend } from 'resend';
import { prisma } from '../utils/prisma.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface PostIdea {
  day: string;
  platform: string;
  caption: string;
  hashtags: string[];
  imageDescription: string;
  postTime: string;
}

async function getTrendData(): Promise<{ topStyles: string[]; popularOccasions: string[]; colorTrends: string[] }> {
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [recentDNA, recentChecks] = await Promise.all([
      prisma.styleDNA.findMany({
        where: { createdAt: { gte: weekAgo } },
        select: { styleArchetypes: true, dominantColors: true },
        take: 100,
      }),
      prisma.outfitCheck.findMany({
        where: { createdAt: { gte: weekAgo }, isDeleted: false },
        select: { occasions: true },
        take: 100,
      }),
    ]);

    const archetypeCounts = new Map<string, number>();
    const colorCounts = new Map<string, number>();
    for (const dna of recentDNA) {
      for (const a of dna.styleArchetypes) archetypeCounts.set(a, (archetypeCounts.get(a) || 0) + 1);
      for (const c of dna.dominantColors) colorCounts.set(c, (colorCounts.get(c) || 0) + 1);
    }

    const topStyles = [...archetypeCounts.entries()]
      .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([s]) => s);

    const colorTrends = [...colorCounts.entries()]
      .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c]) => c);

    const occasionCounts = new Map<string, number>();
    for (const check of recentChecks) {
      for (const occ of check.occasions) occasionCounts.set(occ, (occasionCounts.get(occ) || 0) + 1);
    }
    const popularOccasions = [...occasionCounts.entries()]
      .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([o]) => o);

    return {
      topStyles: topStyles.length > 0 ? topStyles : ['casual', 'minimalist', 'classic'],
      popularOccasions: popularOccasions.length > 0 ? popularOccasions : ['Work', 'Casual', 'Date night'],
      colorTrends: colorTrends.length > 0 ? colorTrends : ['navy', 'white', 'black', 'beige'],
    };
  } catch {
    return {
      topStyles: ['casual', 'minimalist', 'classic', 'streetwear', 'preppy'],
      popularOccasions: ['Work', 'Casual', 'Date night', 'Weekend brunch'],
      colorTrends: ['navy', 'white', 'black', 'beige', 'olive'],
    };
  }
}

function buildContentCalendarEmail(posts: PostIdea[], weekStart: string): string {
  const postRows = posts.map(post => `
    <div style="margin-bottom:24px;padding:20px;background:#FBF7F4;border-radius:12px;border-left:4px solid #E85D4C;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span style="font-weight:700;color:#1A1A1A;font-size:15px;">${post.day}</span>
        <span style="background:#E85D4C;color:#fff;padding:2px 10px;border-radius:20px;font-size:12px;font-weight:600;">${post.platform}</span>
      </div>
      <div style="font-size:12px;color:#6B7280;margin-bottom:8px;">Best time: ${post.postTime}</div>
      <div style="color:#2D2D2D;font-size:14px;line-height:1.6;margin-bottom:10px;">${post.caption}</div>
      <div style="font-size:12px;color:#A8B5A0;margin-bottom:8px;">${post.hashtags.join(' ')}</div>
      <div style="font-size:12px;color:#6B7280;font-style:italic;">📸 ${post.imageDescription}</div>
    </div>
  `).join('');

  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#FBF7F4;padding:40px;">
    <div style="max-width:700px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
      <div style="background:linear-gradient(135deg,#E85D4C,#FF7A6B);padding:32px 40px;text-align:center;">
        <div style="font-size:28px;font-weight:700;color:#fff;">Or This?</div>
        <div style="font-size:14px;color:rgba(255,255,255,0.85);margin-top:4px;">Content Calendar — Week of ${weekStart}</div>
      </div>
      <div style="padding:32px 40px;">
        <p style="color:#2D2D2D;font-size:14px;margin-bottom:24px;">Your AI-generated content plan for this week. Each post is based on real trends from your user base.</p>
        ${postRows}
      </div>
      <div style="background:#F5EDE7;padding:20px 40px;text-align:center;">
        <div style="font-size:12px;color:#6B7280;">Or This? · Content Calendar Agent · ${new Date().toISOString()}</div>
      </div>
    </div>
  </body></html>`;
}

export async function runContentCalendar(): Promise<void> {
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  const recipient = process.env.REPORT_RECIPIENT_EMAIL;

  if (!resend || !recipient) {
    console.log('[ContentCalendar] RESEND_API_KEY or REPORT_RECIPIENT_EMAIL not set — skipping');
    return;
  }

  const trendData = await getTrendData();
  const weekStart = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const prompt = `You are a social media strategist for "Or This?" — an AI-powered outfit feedback app where users get style scores and personalized fashion advice.

App data from the past week:
- Top style archetypes users wear: ${trendData.topStyles.join(', ')}
- Most popular occasions: ${trendData.popularOccasions.join(', ')}
- Trending colors: ${trendData.colorTrends.join(', ')}

Brand voice: Warm, confident, aspirational. Tagline: "Confidence in every choice."
Target audience: Fashion-curious people aged 18-35 who want to look their best.

Generate exactly 5 social media post ideas for this week. Return a JSON array of exactly 5 objects, each with:
- day: day of week (Monday through Friday)
- platform: "Instagram", "TikTok", or "Twitter/X"
- caption: engaging post caption (2-4 sentences, include hook + value + CTA)
- hashtags: array of 5-8 relevant hashtags
- imageDescription: brief description of the ideal image/video (1-2 sentences)
- postTime: best posting time (e.g., "7:00 PM ET")

Return ONLY a JSON array. No markdown, no explanation.`;

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { temperature: 0.8, maxOutputTokens: 2048 },
    });

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array found in Gemini response');

    const posts: PostIdea[] = JSON.parse(jsonMatch[0]);
    const from = process.env.REPORT_FROM_EMAIL || 'growth@orthis.app';

    await resend.emails.send({
      from,
      to: recipient,
      subject: `Or This? Content Calendar — Week of ${weekStart}`,
      html: buildContentCalendarEmail(posts, weekStart),
    });

    console.log(`✅ [ContentCalendar] Sent content calendar for week of ${weekStart}`);
  } catch (err) {
    console.error('[ContentCalendar] Failed:', err);
  }
}
