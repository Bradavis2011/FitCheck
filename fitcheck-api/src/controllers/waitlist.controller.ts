import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { Resend } from 'resend';
import { randomBytes } from 'crypto';

let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  _resend = new Resend(key);
  return _resend;
}

const JoinSchema = z.object({
  email: z.string().email('Invalid email address'),
  referralCode: z.string().optional(),
});

function makeReferralCode(): string {
  return randomBytes(4).toString('hex'); // 8-char hex, e.g. "a3f9c201"
}

function getAppUrl(): string {
  return process.env.APP_URL || 'https://orthis.app';
}

// POST /api/waitlist
export async function joinWaitlist(req: Request, res: Response) {
  const parsed = JoinSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { email, referralCode: referredByCode } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  // Check if already on the waitlist
  const existing = await prisma.waitlistEntry.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    res.json({
      alreadyJoined: true,
      position: existing.position,
      referralCode: existing.referralCode,
      referralLink: `${getAppUrl()}?ref=${existing.referralCode}`,
    });
    return;
  }

  // Validate the referral code if provided
  let referredBy: string | null = null;
  if (referredByCode) {
    const referrer = await prisma.waitlistEntry.findUnique({ where: { referralCode: referredByCode } });
    if (referrer) {
      referredBy = referredByCode;
      // Bump referrer up 5 spots (lower position = earlier access)
      await prisma.waitlistEntry.update({
        where: { referralCode: referredByCode },
        data: { position: { decrement: 5 } },
      });
    }
  }

  // Count total entries to assign a base position
  const total = await prisma.waitlistEntry.count();

  const newEntry = await prisma.waitlistEntry.create({
    data: {
      email: normalizedEmail,
      referralCode: makeReferralCode(),
      referredBy,
      position: total + 1,
    },
  });

  // Send welcome email (non-blocking — don't fail the request if email fails)
  const resend = getResend();
  const fromEmail = process.env.EMAIL_FROM || 'Or This? <hello@orthis.app>';
  if (resend) {
    resend.emails.send({
      from: fromEmail,
      to: normalizedEmail,
      subject: "You're on the Or This? waitlist!",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1A1A1A;">
          <h1 style="color: #E85D4C;">You're in! 🎉</h1>
          <p>You're <strong>#${newEntry.position}</strong> on the Or This? waitlist.</p>
          <p>Move up the queue by sharing your referral link — every friend who joins bumps you up 5 spots:</p>
          <a href="${getAppUrl()}?ref=${newEntry.referralCode}"
             style="display:inline-block;background:#E85D4C;color:#fff;padding:12px 24px;border-radius:24px;text-decoration:none;font-weight:600;margin:16px 0;">
            Share my link
          </a>
          <p style="font-size:13px;color:#888;">
            Your link: ${getAppUrl()}?ref=${newEntry.referralCode}
          </p>
          <p>We'll email you the moment early access opens.</p>
          <p style="color:#E85D4C;font-style:italic;">— The Or This? team</p>
        </div>
      `,
    }).catch(err => console.error('[Waitlist] Failed to send welcome email:', err));
  }

  res.status(201).json({
    position: newEntry.position,
    referralCode: newEntry.referralCode,
    referralLink: `${getAppUrl()}?ref=${newEntry.referralCode}`,
  });
}

// GET /api/waitlist/status?email=user@example.com
export async function getWaitlistStatus(req: Request, res: Response) {
  const email = (req.query.email as string || '').toLowerCase().trim();
  if (!email) {
    res.status(400).json({ error: 'email query parameter required' });
    return;
  }

  const entry = await prisma.waitlistEntry.findUnique({ where: { email } });
  if (!entry) {
    res.status(404).json({ error: 'Email not found on waitlist' });
    return;
  }

  res.json({
    position: entry.position,
    referralCode: entry.referralCode,
    referralLink: `${getAppUrl()}?ref=${entry.referralCode}`,
  });
}
