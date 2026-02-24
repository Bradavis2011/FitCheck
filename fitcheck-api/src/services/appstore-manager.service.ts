import { GoogleGenerativeAI } from '@google/generative-ai';
import { createSign } from 'crypto';
import { Resend } from 'resend';
import { prisma } from '../utils/prisma.js';
import { executeOrQueue, registerExecutor } from './agent-manager.service.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ─── JWT Helpers ──────────────────────────────────────────────────────────────

function b64url(buf: Buffer): string {
  return buf.toString('base64url');
}

function b64urlStr(s: string): string {
  return b64url(Buffer.from(s, 'utf8'));
}

function buildAppStoreJwt(keyId: string, issuerId: string, privateKeyPem: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64urlStr(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' }));
  const payload = b64urlStr(JSON.stringify({ iss: issuerId, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' }));
  const toSign = `${header}.${payload}`;

  const sign = createSign('SHA256');
  sign.update(toSign);
  // ES256 requires IEEE P1363 format (r+s concatenated, not DER)
  const signature = sign.sign({ key: privateKeyPem, dsaEncoding: 'ieee-p1363' }, 'base64url');

  return `${toSign}.${signature}`;
}

function buildGoogleJwt(serviceAccount: { client_email: string; private_key: string }): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64urlStr(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64urlStr(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const toSign = `${header}.${payload}`;
  const sign = createSign('SHA256');
  sign.update(toSign);
  const signature = sign.sign(serviceAccount.private_key, 'base64url');
  return `${toSign}.${signature}`;
}

async function getGoogleAccessToken(serviceAccount: { client_email: string; private_key: string }): Promise<string> {
  const jwt = buildGoogleJwt(serviceAccount);
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }).toString(),
  });

  if (!resp.ok) {
    throw new Error(`Google token exchange failed: ${resp.status} ${await resp.text()}`);
  }

  const data = (await resp.json()) as { access_token?: string };
  if (!data.access_token) throw new Error('No access_token in Google response');
  return data.access_token;
}

// ─── Draft Reply Generation ───────────────────────────────────────────────────

async function draftReply(rating: number, title: string | null, body: string | null): Promise<string> {
  // Fallback replies when Gemini is unavailable
  if (!process.env.GEMINI_API_KEY) {
    if (rating >= 4) {
      return 'Thank you so much for your kind words! We\'re thrilled you\'re enjoying Or This? Your support means everything to us. ✨';
    }
    return 'Thank you for your honest feedback. We\'re sorry to hear this — please reach out to us at support@orthis.app so we can make it right.';
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    const prompt = `You are customer support for "Or This?", an AI-powered outfit feedback app. Brand voice: warm, encouraging, supportive.

Draft a brief reply to this app store review. Requirements:
- 2-3 sentences maximum
- Thank the user genuinely
- Address their main point specifically
- End on a positive, confidence-building note
- Plain text only (no markdown, no emoji)
- Under 170 characters total (App Store limit)

Review — Rating: ${rating}/5 | Title: ${title || 'No title'} | Review: ${body || 'No text'}

Reply:`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim().slice(0, 170);
  } catch (err) {
    console.error('[AppStoreManager] draftReply Gemini error:', err);
    return rating >= 4
      ? 'Thank you for your wonderful review! We love hearing from happy users. 😊'
      : 'Thank you for your honest feedback. We\'re always working to improve. Please email support@orthis.app and we\'ll make it right.';
  }
}

// ─── Apple App Store Reviews ──────────────────────────────────────────────────

async function fetchAppleReviews(): Promise<void> {
  const keyId = process.env.APPSTORE_KEY_ID;
  const issuerId = process.env.APPSTORE_ISSUER_ID;
  const privateKeyB64 = process.env.APPSTORE_PRIVATE_KEY;
  const appId = process.env.APPSTORE_APP_ID;

  if (!keyId || !issuerId || !privateKeyB64 || !appId) {
    console.log('[AppStoreManager] App Store Connect keys not configured — skipping Apple reviews');
    return;
  }

  const privateKeyPem = Buffer.from(privateKeyB64, 'base64').toString('utf8');
  const jwt = buildAppStoreJwt(keyId, issuerId, privateKeyPem);

  try {
    const url = `https://api.appstoreconnect.apple.com/v1/apps/${appId}/customerReviews?sort=-createdDate&limit=25`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${jwt}` },
    });

    if (!resp.ok) {
      console.error(`[AppStoreManager] Apple API error ${resp.status}: ${await resp.text()}`);
      return;
    }

    const data = (await resp.json()) as { data?: Array<{ id: string; attributes: { rating: number; title?: string; body?: string; reviewerNickname?: string; createdDate: string } }> };
    const reviews = data.data ?? [];

    let newCount = 0;
    for (const review of reviews) {
      const { id, attributes } = review;
      const existing = await prisma.appReview.findUnique({ where: { externalId: id } });
      if (existing) continue;

      const draft = await draftReply(attributes.rating, attributes.title ?? null, attributes.body ?? null);

      const appReview = await prisma.appReview.create({
        data: {
          store: 'apple',
          externalId: id,
          rating: attributes.rating,
          title: attributes.title ?? null,
          body: attributes.body ?? null,
          author: attributes.reviewerNickname ?? null,
          draftReply: draft,
          replyStatus: 'pending',
          reviewDate: new Date(attributes.createdDate),
        },
      });

      await executeOrQueue(
        'appstore-manager',
        'reply_review',
        'high',
        {
          reviewId: appReview.id,
          store: 'apple',
          rating: attributes.rating,
          title: attributes.title ?? null,
          body: attributes.body ?? null,
          draftReply: draft,
        } as unknown as Record<string, unknown>,
        async () => {
          // App Store Connect reply API requires additional OAuth scope setup
          // Founder approves the draft, then posts manually via App Store Connect
          console.log(`[AppStoreManager] Apple review reply queued for manual posting (reviewId: ${appReview.id})`);
          return { posted: false, note: 'manual_required_via_app_store_connect' };
        },
        draft,
      );

      newCount++;
    }

    console.log(`[AppStoreManager] Apple: ${newCount} new review(s) processed`);
  } catch (err) {
    console.error('[AppStoreManager] fetchAppleReviews failed:', err);
  }
}

// ─── Google Play Reviews ──────────────────────────────────────────────────────

async function fetchGooglePlayReviews(): Promise<void> {
  const serviceAccountJson = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT;
  const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME;

  if (!serviceAccountJson || !packageName) {
    console.log('[AppStoreManager] Google Play service account not configured — skipping Play reviews');
    return;
  }

  let serviceAccount: { client_email: string; private_key: string };
  try {
    serviceAccount = JSON.parse(serviceAccountJson) as { client_email: string; private_key: string };
  } catch {
    console.error('[AppStoreManager] Failed to parse GOOGLE_PLAY_SERVICE_ACCOUNT JSON');
    return;
  }

  let accessToken: string;
  try {
    accessToken = await getGoogleAccessToken(serviceAccount);
  } catch (err) {
    console.error('[AppStoreManager] Failed to get Google access token:', err);
    return;
  }

  try {
    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/reviews?maxResults=25`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!resp.ok) {
      console.error(`[AppStoreManager] Google Play API error ${resp.status}: ${await resp.text()}`);
      return;
    }

    const data = (await resp.json()) as {
      reviews?: Array<{
        reviewId: string;
        authorName?: string;
        comments?: Array<{ userComment?: { starRating?: number; text?: string; lastModified?: { seconds?: string } } }>;
      }>;
    };

    const reviews = data.reviews ?? [];
    let newCount = 0;

    for (const review of reviews) {
      const externalId = `google:${review.reviewId}`;
      const existing = await prisma.appReview.findUnique({ where: { externalId } });
      if (existing) continue;

      const userComment = review.comments?.[0]?.userComment;
      const rating = userComment?.starRating ?? 0;
      const body = userComment?.text ?? null;
      const reviewDateSecs = userComment?.lastModified?.seconds;
      const reviewDate = reviewDateSecs ? new Date(parseInt(reviewDateSecs) * 1000) : new Date();

      const draft = await draftReply(rating, null, body);

      const appReview = await prisma.appReview.create({
        data: {
          store: 'google',
          externalId,
          rating,
          title: null,
          body,
          author: review.authorName ?? null,
          draftReply: draft,
          replyStatus: 'pending',
          reviewDate,
        },
      });

      await executeOrQueue(
        'appstore-manager',
        'reply_review',
        'high',
        { reviewId: appReview.id, store: 'google', rating, body, draftReply: draft } as unknown as Record<string, unknown>,
        async () => {
          console.log(`[AppStoreManager] Google Play reply queued for founder (reviewId: ${appReview.id})`);
          return { posted: false, note: 'manual_required_via_play_console' };
        },
        draft,
      );

      newCount++;
    }

    console.log(`[AppStoreManager] Google Play: ${newCount} new review(s) processed`);
  } catch (err) {
    console.error('[AppStoreManager] fetchGooglePlayReviews failed:', err);
  }
}

// ─── Weekly Summary Email ─────────────────────────────────────────────────────

export async function runAppStoreWeeklySummary(): Promise<void> {
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  const recipient = process.env.REPORT_RECIPIENT_EMAIL;

  if (!resend || !recipient) {
    console.log('[AppStoreManager] Resend/recipient not configured — skipping weekly summary');
    return;
  }

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [weekReviews, pendingCount] = await Promise.all([
    prisma.appReview.findMany({ where: { createdAt: { gte: weekAgo } }, select: { rating: true, store: true } }),
    prisma.appReview.count({ where: { replyStatus: 'pending' } }),
  ]);

  const total = weekReviews.length;
  const avgRating = total > 0 ? weekReviews.reduce((s, r) => s + r.rating, 0) / total : null;
  const ratingCounts = [1, 2, 3, 4, 5].map(r => ({
    rating: r,
    count: weekReviews.filter(rev => rev.rating === r).length,
  }));

  const ratingRows = ratingCounts.map(({ rating, count }) => `
    <tr>
      <td style="padding:8px 12px;font-size:14px;">${'⭐'.repeat(rating)}</td>
      <td style="padding:8px 12px;font-size:14px;">${count}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#FBF7F4;padding:40px;">
    <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#E85D4C,#FF7A6B);padding:28px 40px;text-align:center;">
        <div style="font-size:26px;font-weight:700;color:#fff;">Or This?</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.8);margin-top:4px;">Weekly App Store Review Summary</div>
      </div>
      <div style="padding:32px 40px;">
        <div style="display:flex;gap:16px;margin-bottom:24px;">
          <div style="flex:1;background:#F5EDE7;border-radius:12px;padding:16px;text-align:center;">
            <div style="font-size:28px;font-weight:700;color:#E85D4C;">${total}</div>
            <div style="font-size:12px;color:#6B7280;">Reviews this week</div>
          </div>
          <div style="flex:1;background:#F5EDE7;border-radius:12px;padding:16px;text-align:center;">
            <div style="font-size:28px;font-weight:700;color:#E85D4C;">${avgRating != null ? avgRating.toFixed(1) : '—'}</div>
            <div style="font-size:12px;color:#6B7280;">Avg rating</div>
          </div>
          <div style="flex:1;background:#F5EDE7;border-radius:12px;padding:16px;text-align:center;">
            <div style="font-size:28px;font-weight:700;color:#E85D4C;">${pendingCount}</div>
            <div style="font-size:12px;color:#6B7280;">Pending replies</div>
          </div>
        </div>
        <table width="100%" style="border-collapse:collapse;">
          <thead><tr style="background:#F5EDE7;"><th style="padding:8px 12px;text-align:left;font-size:13px;">Rating</th><th style="padding:8px 12px;text-align:left;font-size:13px;">Count</th></tr></thead>
          <tbody>${ratingRows}</tbody>
        </table>
      </div>
      <div style="padding:16px 40px 24px;border-top:1px solid #F5EDE7;"><p style="color:#6B7280;font-size:12px;margin:0;">Or This? · App Store Manager · ${new Date().toISOString()}</p></div>
    </div>
  </body></html>`;

  try {
    await resend.emails.send({
      from: process.env.REPORT_FROM_EMAIL || 'reports@orthis.app',
      to: recipient,
      subject: `Or This? App Store Summary: ${total} review(s), ${avgRating != null ? avgRating.toFixed(1) : '—'} avg`,
      html,
    });
    console.log('[AppStoreManager] Weekly summary sent');
  } catch (err) {
    console.error('[AppStoreManager] Failed to send weekly summary:', err);
  }
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export async function runAppStoreManager(): Promise<void> {
  console.log('[AppStoreManager] Daily run starting...');
  await fetchAppleReviews();
  await fetchGooglePlayReviews();
  console.log('[AppStoreManager] Daily run complete');
}

/** Register executors at startup so processApprovedActions works after a server restart. */
export function registerExecutors(): void {
  registerExecutor('appstore-manager', 'reply_review', async (payload) => {
    const p = payload as { reviewId: string; store: string };
    console.log(`[AppStoreManager] ${p.store} review reply queued for manual posting (reviewId: ${p.reviewId})`);
    return { posted: false, note: p.store === 'apple' ? 'manual_required_via_app_store_connect' : 'manual_required_via_play_console' };
  });
}

// Auto-register at module load time
registerExecutors();
