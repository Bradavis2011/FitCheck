/**
 * Share Controller — Public outfit score page
 *
 * GET /s/:id
 * Serves a branded web page for sharing outfit scores.
 * Supports isPublic outfits directly + private outfits via HMAC token.
 */

import { Request, Response } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { prisma } from '../utils/prisma.js';
import { buildScorePage } from '../templates/score-page.js';

const _hmacSecret = process.env.SHARE_HMAC_SECRET || process.env.FOLLOW_UP_HMAC_SECRET;
if (!_hmacSecret) {
  throw new Error('[share.controller] SHARE_HMAC_SECRET env var must be set');
}
const HMAC_SECRET: string = _hmacSecret;

/** Generate an HMAC share token for a private outfit */
export function generateShareToken(outfitId: string): string {
  return createHmac('sha256', HMAC_SECRET).update(`share:${outfitId}`).digest('hex');
}

/** Verify an HMAC share token */
function verifyShareToken(outfitId: string, token: string): boolean {
  try {
    const expected = createHmac('sha256', HMAC_SECRET).update(`share:${outfitId}`).digest('hex');
    const tokenBuf = Buffer.from(token, 'hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    if (tokenBuf.length !== expectedBuf.length) return false;
    return timingSafeEqual(tokenBuf, expectedBuf);
  } catch { return false; }
}

/** GET /s/:id — Public score page */
export async function getScorePage(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { t: token, ref: referralCode } = req.query as { t?: string; ref?: string };

  if (!id || id.length < 10) {
    res.status(404).send('Not found');
    return;
  }

  try {
    const outfit = await prisma.outfitCheck.findUnique({
      where: { id },
      include: {
        user: { select: { username: true, referralCode: true } },
      },
    });

    if (!outfit || outfit.isDeleted) {
      res.status(404).send(buildNotFoundPage());
      return;
    }

    // Access control: public outfit OR valid HMAC token
    const isPublic = outfit.isPublic;
    const hasValidToken = token && verifyShareToken(id, token);

    if (!isPublic && !hasValidToken) {
      res.status(403).send(buildNotFoundPage());
      return;
    }

    if (!outfit.aiScore || !outfit.aiFeedback) {
      res.status(404).send(buildNotFoundPage());
      return;
    }

    const feedback = outfit.aiFeedback as any;
    const summary = feedback?.editorialSummary
      || feedback?.summary
      || feedback?.whatIsWorking?.[0]
      || 'AI outfit analysis by Or This?';

    const imageUrl = outfit.thumbnailUrl || outfit.imageUrl || undefined;

    const html = buildScorePage({
      score: outfit.aiScore,
      summary: typeof summary === 'string' ? summary : String(summary),
      occasion: outfit.occasions?.[0] || undefined,
      username: outfit.user?.username || undefined,
      imageUrl,
      shareId: id,
      referralCode: referralCode || outfit.user?.referralCode || undefined,
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // Cache for 5 minutes — score won't change
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(html);
  } catch (err) {
    console.error('[ShareController] Error serving score page:', err);
    res.status(500).send('Something went wrong');
  }
}

function buildNotFoundPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Or This? — Score Not Found</title>
  <style>
    body { font-family: Arial, sans-serif; background: #FBF7F4; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .box { background: #fff; padding: 40px; text-align: center; max-width: 360px; width: 100%; }
    .logo { font-size: 24px; font-weight: 600; color: #E85D4C; margin-bottom: 16px; }
    p { color: #6B7280; font-size: 14px; line-height: 1.6; margin-bottom: 20px; }
    a { display: inline-block; background: #E85D4C; color: #fff; text-decoration: none; padding: 12px 28px; font-size: 14px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="box">
    <div class="logo">Or This?</div>
    <p>This outfit score isn't available. It may have been deleted or made private.</p>
    <a href="https://apps.apple.com/app/id6759472490">Get the App →</a>
  </div>
</body>
</html>`;
}
