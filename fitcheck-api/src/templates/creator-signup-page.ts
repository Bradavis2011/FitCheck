/**
 * Creator Affiliate Program Pages
 *
 * buildCreatorSignupPage() — Self-serve signup form at GET /creator
 * buildCreatorConfirmationPage() — Shown after successful signup or join-link click
 *
 * Brand: Confidence Cream bg, Decision Coral CTAs, DM Sans + editorial layout, 0px radius buttons
 */

import { escapeHtml } from '../utils/escape.js';

const APP_STORE_URL = 'https://apps.apple.com/app/id6759472490';
const REFERRAL_BASE_URL = process.env.REFERRAL_BASE_URL || 'https://orthis.app/invite';
const CREATOR_SIGNUP_URL = process.env.CREATOR_SIGNUP_URL || 'https://orthis.app/creator';

export function buildCreatorSignupPage(error?: string): string {
  const safeError = error ? escapeHtml(error) : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Creator Affiliate Program — Or This?</title>
  <meta property="og:title" content="Earn 30% recurring — Or This? Creator Program">
  <meta property="og:description" content="Join the Or This? affiliate program. Earn 30% recurring on every subscriber from your link. No minimum followers.">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="Or This? Creator Affiliate — 30% recurring">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #FBF7F4; font-family: Arial, Helvetica, sans-serif; color: #1A1A1A; line-height: 1; }
    .wrap { max-width: 520px; margin: 0 auto; padding: 48px 24px 80px; }
    .logo { font-size: 12px; letter-spacing: 2.5px; font-weight: 700; color: #A8B5A0; margin-bottom: 44px; }
    .logo .q { color: #E85D4C; }
    h1 { font-size: 34px; font-weight: 700; line-height: 1.1; margin-bottom: 14px; }
    h1 em { font-style: italic; }
    .sub { font-size: 15px; color: #6B7280; line-height: 1.65; margin-bottom: 36px; }
    .example { background: #fff; border-left: 3px solid #E85D4C; padding: 18px 20px; margin-bottom: 36px; }
    .example .label { font-size: 10px; letter-spacing: 2px; color: #A8B5A0; font-weight: 700; margin-bottom: 8px; }
    .example p { font-size: 14px; color: #2D2D2D; line-height: 1.6; }
    .example strong { color: #E85D4C; }
    .ideas { margin-bottom: 36px; }
    .idea { display: flex; gap: 14px; margin-bottom: 14px; align-items: flex-start; }
    .idea-num { min-width: 22px; height: 22px; background: #1A1A1A; color: #fff; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; }
    .idea p { font-size: 13px; color: #2D2D2D; line-height: 1.55; }
    .divider { height: 1px; background: #F5EDE7; margin: 32px 0; }
    .form-label { display: block; font-size: 10px; letter-spacing: 2px; font-weight: 700; color: #6B7280; margin-bottom: 8px; }
    .form-input { width: 100%; border: 1px solid #E5E7EB; background: #fff; padding: 13px 14px; font-size: 15px; font-family: inherit; color: #1A1A1A; outline: none; border-radius: 0; margin-bottom: 20px; }
    .form-input:focus { border-color: #E85D4C; }
    .form-select { width: 100%; border: 1px solid #E5E7EB; background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='7' viewBox='0 0 12 7'%3E%3Cpath d='M1 1l5 4 5-4' stroke='%236B7280' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E") no-repeat right 14px center; padding: 13px 38px 13px 14px; font-size: 15px; font-family: inherit; color: #1A1A1A; outline: none; border-radius: 0; margin-bottom: 20px; appearance: none; cursor: pointer; }
    .form-select:focus { border-color: #E85D4C; }
    .error-box { background: #FEF2F2; border: 1px solid #FECACA; color: #DC2626; padding: 12px 16px; font-size: 13px; margin-bottom: 20px; line-height: 1.5; }
    .submit-btn { width: 100%; background: #E85D4C; color: #fff; border: none; padding: 16px 24px; font-size: 13px; letter-spacing: 1.5px; font-weight: 700; cursor: pointer; font-family: inherit; }
    .submit-btn:hover { background: #C94A3A; }
    .fine { font-size: 11px; color: #9CA3AF; line-height: 1.6; margin-top: 18px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="logo">OR <span class="q">THIS?</span></div>

    <h1>Earn 30% on every<br><em>subscription you drive</em></h1>
    <p class="sub">Recurring. No cap. Every paid subscriber from your link earns you commission for as long as they're subscribed — whether that's 3 months or 3 years.</p>

    <div class="example">
      <div class="label">WHAT THIS LOOKS LIKE</div>
      <p>50 installs from your link → 5 go paid at $4.99/mo → <strong>~$7.50/month recurring</strong>.<br>
      Post consistently and that compounds: one video series could generate $50–200/mo indefinitely.</p>
    </div>

    <div class="ideas">
      <div class="idea"><div class="idea-num">1</div><p><strong>Score reveal format.</strong> Submit your outfit, let the scanning animation play fully, react authentically to the score. The suspense is the content — don't cut away early.</p></div>
      <div class="idea"><div class="idea-num">2</div><p><strong>"AI rated my worst outfit."</strong> Low scores perform as well as high scores. The embarrassment hook stops the scroll better than a perfect 9/10.</p></div>
      <div class="idea"><div class="idea-num">3</div><p><strong>Rate your event outfit before/after.</strong> Submit before the event, show the AI score, then show the actual look. Built-in story arc.</p></div>
    </div>

    <div class="divider"></div>

    <form method="POST" action="/creator/signup">
      ${safeError ? `<div class="error-box">${safeError}</div>` : ''}

      <label class="form-label" for="handle">YOUR HANDLE</label>
      <input class="form-input" type="text" id="handle" name="handle" placeholder="@yourhandle" required autocomplete="off" maxlength="55">

      <label class="form-label" for="email">EMAIL</label>
      <input class="form-input" type="email" id="email" name="email" placeholder="you@email.com" required maxlength="200">

      <label class="form-label" for="platform">PRIMARY PLATFORM</label>
      <select class="form-select" id="platform" name="platform" required>
        <option value="">Select platform...</option>
        <option value="tiktok">TikTok</option>
        <option value="instagram">Instagram</option>
        <option value="youtube">YouTube</option>
        <option value="lemon8">Lemon8</option>
      </select>

      <button class="submit-btn" type="submit">GET MY AFFILIATE LINK →</button>
    </form>

    <p class="fine">30% of net revenue, recurring, paid monthly via PayPal. No minimum follower count. By submitting you agree to our creator terms: authentic content only, no incentivized reviews, no paid app installs. Questions? brandon@orthis.app</p>
  </div>
</body>
</html>`;
}

export function buildCreatorConfirmationPage(handle: string, referralCode: string): string {
  const referralLink = `${REFERRAL_BASE_URL}/${referralCode}`;
  const h = escapeHtml(handle);
  const code = escapeHtml(referralCode);
  const link = escapeHtml(referralLink);
  const signupUrl = escapeHtml(CREATOR_SIGNUP_URL);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're in — Or This? Creator Program</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #FBF7F4; font-family: Arial, Helvetica, sans-serif; color: #1A1A1A; }
    .wrap { max-width: 520px; margin: 0 auto; padding: 48px 24px 80px; }
    .logo { font-size: 12px; letter-spacing: 2.5px; font-weight: 700; color: #A8B5A0; margin-bottom: 44px; }
    .logo .q { color: #E85D4C; }
    .badge { display: inline-block; background: #10B981; color: #fff; font-size: 10px; letter-spacing: 2px; font-weight: 700; padding: 4px 12px; margin-bottom: 20px; }
    h1 { font-size: 30px; font-weight: 700; line-height: 1.2; margin-bottom: 6px; }
    h1 em { font-style: italic; color: #E85D4C; }
    .tagline { font-size: 14px; color: #6B7280; margin-bottom: 36px; line-height: 1.5; }
    .link-box { background: #fff; border: 2px solid #E85D4C; padding: 22px 24px; margin-bottom: 32px; }
    .link-box .label { font-size: 10px; letter-spacing: 2px; font-weight: 700; color: #A8B5A0; margin-bottom: 10px; }
    .link-box .link { font-size: 17px; font-weight: 700; color: #E85D4C; word-break: break-all; line-height: 1.4; }
    .link-box .code { font-size: 11px; color: #9CA3AF; margin-top: 8px; }
    .commissions { border: 1px solid #F5EDE7; margin-bottom: 32px; }
    .comm-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid #F5EDE7; }
    .comm-row:last-child { border-bottom: none; }
    .comm-plan { font-size: 13px; color: #2D2D2D; }
    .comm-earn { font-size: 13px; font-weight: 700; color: #E85D4C; }
    .steps { margin-bottom: 32px; }
    .step { display: flex; gap: 14px; margin-bottom: 16px; align-items: flex-start; }
    .step-num { min-width: 24px; height: 24px; background: #1A1A1A; color: #fff; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
    .step p { font-size: 13px; color: #2D2D2D; line-height: 1.55; }
    .cta-btn { display: block; background: #E85D4C; color: #fff; text-decoration: none; padding: 16px 24px; font-size: 13px; letter-spacing: 1.5px; font-weight: 700; text-align: center; margin-bottom: 12px; }
    .fine { font-size: 11px; color: #9CA3AF; line-height: 1.6; }
    .share-link { font-size: 12px; color: #6B7280; margin-top: 20px; padding-top: 20px; border-top: 1px solid #F5EDE7; line-height: 1.6; }
    .share-link a { color: #E85D4C; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="logo">OR <span class="q">THIS?</span></div>
    <div class="badge">YOU'RE IN</div>
    <h1>Welcome,<br><em>@${h}</em></h1>
    <p class="tagline">Your affiliate program is active. Share your link and earnings start immediately.</p>

    <div class="link-box">
      <div class="label">YOUR AFFILIATE LINK</div>
      <div class="link">${link}</div>
      <div class="code">Code: ${code} &nbsp;·&nbsp; Put this link in your bio</div>
    </div>

    <div class="commissions">
      <div class="comm-row"><span class="comm-plan">Plus subscribers ($4.99/mo)</span><span class="comm-earn">~$1.05/mo each</span></div>
      <div class="comm-row"><span class="comm-plan">Pro subscribers ($9.99/mo)</span><span class="comm-earn">~$2.10/mo each</span></div>
      <div class="comm-row"><span class="comm-plan">Recurring as long as they subscribe</span><span class="comm-earn">30% of net</span></div>
    </div>

    <div class="steps">
      <div class="step"><div class="step-num">1</div><p>Download Or This? and actually use it — you need to know the product to talk about it authentically and avoid being called out in comments.</p></div>
      <div class="step"><div class="step-num">2</div><p>Film the score reveal. Submit your outfit, let the scanning animation play out fully (don't cut it), react to your score. That's the format that's working.</p></div>
      <div class="step"><div class="step-num">3</div><p>Put <strong>${link}</strong> in your bio. Every install from that link tracks back to you.</p></div>
    </div>

    <a href="${escapeHtml(APP_STORE_URL)}" class="cta-btn">DOWNLOAD OR THIS? TO TRACK YOUR EARNINGS →</a>
    <p class="fine">You'll receive an email with your creator playbook and full shot list shortly. Questions? brandon@orthis.app</p>

    <p class="share-link">Know other creators? Share the affiliate program: <a href="${signupUrl}">${signupUrl}</a></p>
  </div>
</body>
</html>`;
}
