/**
 * Founder Content Digest Service
 *
 * Weekly email to the founder with ready-to-use TikTok scripts,
 * the trend report summary, new data-backed style tips, and
 * any social posts pending review.
 *
 * Sent Tuesday 10am UTC (after learning content agent runs at 8am).
 */

import { Resend } from 'resend';
import { prisma } from '../utils/prisma.js';

function section(title: string): string {
  return `<tr>
    <td colspan="2" style="padding:20px 0 8px;font-size:12px;font-weight:700;color:#E85D4C;
      text-transform:uppercase;letter-spacing:1.5px;border-top:1px solid #F5EDE7;">
      ${title}
    </td>
  </tr>`;
}

function buildScriptCard(script: {
  hook: string;
  body: string;
  cta: string;
  visualDirections: string;
  estimatedDuration: string;
  dataPoint: string;
  caption: string;
}, index: number): string {
  return `
  <div style="background:#F5EDE7;padding:20px;margin-bottom:16px;">
    <p style="font-size:11px;font-weight:700;color:#E85D4C;text-transform:uppercase;
      letter-spacing:1px;margin:0 0 12px;">Script ${index + 1} · ${script.estimatedDuration}</p>

    <p style="font-size:12px;font-weight:600;color:#9B9B9B;text-transform:uppercase;
      letter-spacing:1px;margin:0 0 4px;">HOOK (first 3s)</p>
    <p style="font-size:16px;font-weight:700;color:#1A1A1A;margin:0 0 16px;line-height:1.4;">
      "${script.hook}"
    </p>

    <p style="font-size:12px;font-weight:600;color:#9B9B9B;text-transform:uppercase;
      letter-spacing:1px;margin:0 0 4px;">BODY (15–25s)</p>
    <p style="font-size:14px;color:#2D2D2D;margin:0 0 16px;line-height:1.6;">${script.body}</p>

    <p style="font-size:12px;font-weight:600;color:#9B9B9B;text-transform:uppercase;
      letter-spacing:1px;margin:0 0 4px;">CTA</p>
    <p style="font-size:14px;color:#2D2D2D;margin:0 0 16px;line-height:1.6;">${script.cta}</p>

    <p style="font-size:12px;font-weight:600;color:#9B9B9B;text-transform:uppercase;
      letter-spacing:1px;margin:0 0 4px;">VISUAL DIRECTIONS</p>
    <p style="font-size:13px;color:#2D2D2D;margin:0 0 16px;line-height:1.6;font-style:italic;">
      ${script.visualDirections}
    </p>

    <div style="background:#fff;padding:12px;border-left:3px solid #E85D4C;">
      <p style="font-size:12px;font-weight:600;color:#E85D4C;margin:0 0 4px;">📊 DATA POINT</p>
      <p style="font-size:13px;color:#1A1A1A;margin:0;">${script.dataPoint}</p>
    </div>

    <p style="font-size:12px;color:#9B9B9B;margin:12px 0 0;">
      <strong style="color:#1A1A1A;">Caption:</strong> ${script.caption}
    </p>
  </div>`;
}

// ─── Daily Script Email ───────────────────────────────────────────────────────

export async function sendDailyScriptEmail(): Promise<void> {
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  const recipient = process.env.REPORT_RECIPIENT_EMAIL;

  if (!resend || !recipient) {
    console.log('[DailyScriptEmail] RESEND_API_KEY or REPORT_RECIPIENT_EMAIL not set — skipping');
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const from = process.env.REPORT_FROM_EMAIL || 'alerts@orthis.app';

  const scripts = await prisma.blogDraft.findMany({
    where: {
      contentType: { in: ['series_episode', 'data_drop', 'trend_take', 'style_tip'] },
      trendPeriod: today,
    },
    orderBy: { createdAt: 'asc' },
    take: 10,
  });

  if (scripts.length === 0) {
    console.log(`[DailyScriptEmail] No scripts found for ${today} — skipping`);
    return;
  }

  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const scriptCards = scripts.map((s, i) => {
    const data = s.scriptData as Record<string, unknown> | null;
    const cold = data?.coldOpen as { exactWords?: string; duration?: string } | undefined;
    const cta = data?.callToAction as { exactWords?: string } | undefined;
    const sects = data?.sections as Array<{ label?: string; exactWords?: string; duration?: string; cameraDirection?: string }> | undefined;
    const seriesInfo = data?.seriesInfo as { seriesTitle?: string; episodeNumber?: number } | undefined;

    const typeLabel = s.contentType === 'series_episode'
      ? `Series: ${seriesInfo?.seriesTitle || ''} — Ep. ${seriesInfo?.episodeNumber || ''}`
      : s.contentType.replace('_', ' ').toUpperCase();

    const sectionsHtml = (sects || []).map(sec =>
      `<div style="margin-bottom:12px;">
        <p style="font-size:11px;font-weight:700;color:#9B9B9B;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">
          ${sec.label || 'Section'} (${sec.duration || ''})
        </p>
        <p style="font-size:14px;color:#1A1A1A;margin:0 0 4px;line-height:1.6;">${sec.exactWords || ''}</p>
        <p style="font-size:12px;color:#9B9B9B;font-style:italic;margin:0;">Camera: ${sec.cameraDirection || ''}</p>
      </div>`,
    ).join('');

    return `
    <div style="background:#F5EDE7;padding:24px;margin-bottom:20px;">
      <p style="font-size:11px;font-weight:700;color:#E85D4C;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 4px;">
        Script ${i + 1} · ${typeLabel}
      </p>
      <h3 style="font-size:18px;font-weight:700;color:#1A1A1A;margin:0 0 16px;">${s.title}</h3>

      <p style="font-size:11px;font-weight:700;color:#9B9B9B;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">
        COLD OPEN (${cold?.duration || '5s'})
      </p>
      <p style="font-size:15px;font-weight:600;color:#1A1A1A;margin:0 0 16px;line-height:1.5;border-left:3px solid #E85D4C;padding-left:12px;">
        "${cold?.exactWords || ''}"
      </p>

      ${sectionsHtml}

      <p style="font-size:11px;font-weight:700;color:#9B9B9B;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">CALL TO ACTION</p>
      <p style="font-size:14px;color:#1A1A1A;margin:0 0 16px;line-height:1.6;">${cta?.exactWords || ''}</p>

      <div style="background:#fff;padding:12px;border-top:2px solid #E85D4C;">
        <p style="font-size:12px;color:#2D2D2D;margin:0;line-height:1.6;">
          <strong>Caption:</strong> ${String(data?.caption || '')}<br>
          <strong>Hashtags:</strong> ${(data?.hashtags as string[] | undefined || []).join(' ')}<br>
          <strong>Duration:</strong> ${String(data?.totalDuration || '')}
        </p>
      </div>
    </div>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;background:#FBF7F4;padding:40px;margin:0;">
  <div style="max-width:680px;margin:0 auto;background:#fff;padding:40px;">
    <p style="font-size:11px;font-weight:700;color:#E85D4C;text-transform:uppercase;letter-spacing:2px;margin:0 0 8px;">
      Or This? · Daily Script Queue
    </p>
    <h1 style="font-size:28px;color:#1A1A1A;margin:0 0 4px;font-weight:700;">Today's ${scripts.length} Scripts</h1>
    <p style="font-size:14px;color:#9B9B9B;margin:0 0 32px;">${dateStr}</p>

    ${scriptCards}

    <div style="margin-top:32px;padding-top:24px;border-top:1px solid #F5EDE7;">
      <p style="font-size:12px;color:#9B9B9B;margin:0;">
        Or This? · Daily Script Email · ${new Date().toISOString()}
      </p>
    </div>
  </div>
</body>
</html>`;

  try {
    await resend.emails.send({
      from,
      to: recipient,
      subject: `Or This? ${scripts.length} scripts ready to film — ${today}`,
      html,
    });
    console.log(`✅ [DailyScriptEmail] Sent ${scripts.length} scripts to ${recipient}`);
  } catch (err) {
    console.error('[DailyScriptEmail] Failed to send:', err);
  }
}

// ─── Weekly Founder Content Digest ───────────────────────────────────────────

export async function sendFounderContentDigest(): Promise<void> {
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  const recipient = process.env.REPORT_RECIPIENT_EMAIL;

  if (!resend || !recipient) {
    console.log('[FounderContentDigest] RESEND_API_KEY or REPORT_RECIPIENT_EMAIL not set — skipping');
    return;
  }

  const from = process.env.REPORT_FROM_EMAIL || 'alerts@orthis.app';
  const ago7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Fetch all content created this week
  const [tiktokScripts, trendReport, newTips, pendingPosts] = await Promise.all([
    prisma.blogDraft.findMany({
      where: {
        contentType: 'tiktok_script',
        createdAt: { gte: ago7d },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.blogDraft.findFirst({
      where: {
        contentType: 'trend_report',
        createdAt: { gte: ago7d },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.blogDraft.findMany({
      where: {
        contentType: 'style_tip',
        createdAt: { gte: ago7d },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.socialPost.findMany({
      where: { status: 'draft' },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

  // Build TikTok scripts HTML
  let scriptsHtml = '';
  if (tiktokScripts.length > 0) {
    const cards = tiktokScripts
      .filter(s => s.scriptData)
      .map((s, i) => buildScriptCard(s.scriptData as Parameters<typeof buildScriptCard>[0], i))
      .join('');
    scriptsHtml = cards || '<p style="color:#9B9B9B;font-size:14px;">No scripts generated this week.</p>';
  } else {
    scriptsHtml = '<p style="color:#9B9B9B;font-size:14px;">No scripts generated this week.</p>';
  }

  // Build trend summary
  let trendHtml = '';
  if (trendReport) {
    const preview = trendReport.content.slice(0, 500).replace(/##\s*/g, '');
    trendHtml = `
      <div style="background:#F5EDE7;padding:20px;margin-bottom:8px;">
        <p style="font-size:12px;color:#9B9B9B;margin:0 0 8px;">${trendReport.trendPeriod || ''} · Published</p>
        <a href="https://orthis.app/learn/${trendReport.slug}"
           style="font-size:16px;font-weight:700;color:#E85D4C;text-decoration:none;">
          ${trendReport.title}
        </a>
        <p style="font-size:14px;color:#2D2D2D;margin:12px 0 0;line-height:1.6;">${preview}…</p>
      </div>`;
  } else {
    trendHtml = '<p style="color:#9B9B9B;font-size:14px;">No trend report generated this week.</p>';
  }

  // Build tips table
  let tipsHtml = '';
  if (newTips.length > 0) {
    const rows = newTips.map(tip => {
      return `<tr>
        <td style="padding:10px 0;font-size:14px;color:#2D2D2D;border-bottom:1px solid #F5EDE7;">
          ${tip.title}
        </td>
        <td style="padding:10px 0;font-size:12px;color:#9B9B9B;text-align:right;border-bottom:1px solid #F5EDE7;">
          ${tip.category || '—'}
        </td>
      </tr>`;
    }).join('');
    tipsHtml = `<table width="100%" style="border-collapse:collapse;">${rows}</table>`;
  } else {
    tipsHtml = '<p style="color:#9B9B9B;font-size:14px;">No new style tips this week.</p>';
  }

  // Build pending posts summary
  let pendingPostsHtml = '';
  if (pendingPosts.length > 0) {
    const rows = pendingPosts.map(post => `
      <tr>
        <td style="padding:8px 0;font-size:14px;color:#2D2D2D;border-bottom:1px solid #F5EDE7;">
          ${post.content.slice(0, 80)}…
        </td>
        <td style="padding:8px 0;font-size:12px;color:#9B9B9B;text-align:right;border-bottom:1px solid #F5EDE7;">
          ${post.platform}
        </td>
      </tr>`).join('');
    pendingPostsHtml = `
      <table width="100%" style="border-collapse:collapse;">${rows}</table>
      <p style="font-size:12px;color:#9B9B9B;margin:12px 0 0;">
        Review at:
        <a href="${process.env.ADMIN_URL || 'https://fitcheck-production-0f92.up.railway.app'}/dashboard"
           style="color:#E85D4C;">Admin Dashboard →</a>
      </p>`;
  } else {
    pendingPostsHtml = '<p style="color:#9B9B9B;font-size:14px;">No posts pending approval.</p>';
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const html = `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;background:#FBF7F4;padding:40px;margin:0;">
  <div style="max-width:680px;margin:0 auto;background:#fff;padding:40px;">

    <!-- Header -->
    <div style="margin-bottom:32px;">
      <p style="font-size:11px;font-weight:700;color:#E85D4C;text-transform:uppercase;
        letter-spacing:2px;margin:0 0 8px;">Or This? · Founder Content Digest</p>
      <h1 style="font-size:28px;color:#1A1A1A;margin:0 0 8px;font-weight:700;">
        This Week's Content
      </h1>
      <p style="font-size:14px;color:#9B9B9B;margin:0;">${dateStr}</p>
    </div>

    <!-- Summary bar -->
    <div style="display:flex;gap:16px;margin-bottom:32px;background:#F5EDE7;padding:16px;">
      <div style="flex:1;text-align:center;">
        <p style="font-size:24px;font-weight:700;color:#1A1A1A;margin:0;">${tiktokScripts.length}</p>
        <p style="font-size:11px;color:#9B9B9B;text-transform:uppercase;letter-spacing:1px;margin:4px 0 0;">TikTok Scripts</p>
      </div>
      <div style="flex:1;text-align:center;">
        <p style="font-size:24px;font-weight:700;color:#1A1A1A;margin:0;">${trendReport ? 1 : 0}</p>
        <p style="font-size:11px;color:#9B9B9B;text-transform:uppercase;letter-spacing:1px;margin:4px 0 0;">Trend Report</p>
      </div>
      <div style="flex:1;text-align:center;">
        <p style="font-size:24px;font-weight:700;color:#1A1A1A;margin:0;">${newTips.length}</p>
        <p style="font-size:11px;color:#9B9B9B;text-transform:uppercase;letter-spacing:1px;margin:4px 0 0;">Style Tips</p>
      </div>
      <div style="flex:1;text-align:center;">
        <p style="font-size:24px;font-weight:700;color:#1A1A1A;margin:0;">${pendingPosts.length}</p>
        <p style="font-size:11px;color:#9B9B9B;text-transform:uppercase;letter-spacing:1px;margin:4px 0 0;">Posts Pending</p>
      </div>
    </div>

    <table width="100%" style="border-collapse:collapse;">

      ${section('TikTok Scripts — Ready to Film')}
      <tr><td colspan="2" style="padding-bottom:16px;">${scriptsHtml}</td></tr>

      ${section('Weekly Trend Report')}
      <tr><td colspan="2" style="padding-bottom:16px;">${trendHtml}</td></tr>

      ${section('New Data-Backed Style Tips')}
      <tr><td colspan="2" style="padding-bottom:16px;">${tipsHtml}</td></tr>

      ${pendingPosts.length > 0 ? `
      ${section('Social Posts Pending Approval')}
      <tr><td colspan="2" style="padding-bottom:16px;">${pendingPostsHtml}</td></tr>
      ` : ''}

    </table>

    <!-- Footer -->
    <div style="margin-top:40px;padding-top:24px;border-top:1px solid #F5EDE7;">
      <p style="font-size:12px;color:#9B9B9B;margin:0;">
        Or This? · Founder Content Digest · ${now.toISOString()}<br>
        <a href="https://orthis.app/learn" style="color:#E85D4C;">View Live Learning Center →</a>
      </p>
    </div>

  </div>
</body>
</html>`;

  try {
    await resend.emails.send({
      from,
      to: recipient,
      subject: `Or This? Content Digest — ${tiktokScripts.length} TikTok scripts ready`,
      html,
    });
    console.log(`✅ [FounderContentDigest] Sent to ${recipient}`);
  } catch (err) {
    console.error('[FounderContentDigest] Failed to send:', err);
  }
}
