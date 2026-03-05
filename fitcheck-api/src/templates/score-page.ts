/**
 * Score Page HTML Template
 *
 * Server-rendered HTML for public outfit score sharing pages.
 * OG tags enable rich previews on Twitter, iMessage, etc.
 * Apple Smart App Banner prompts App Store download.
 */

interface ScorePageData {
  score: number;
  summary: string;
  occasion?: string;
  username?: string;
  imageUrl?: string;
  shareId: string;
  referralCode?: string;
}

const APP_STORE_URL = 'https://apps.apple.com/app/id6759472490';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.bradavis2011.orthis';
const WEB_BASE_URL = process.env.WEB_BASE_URL || 'https://fitcheck-production-0f92.up.railway.app';

function scoreColor(score: number): string {
  if (score >= 8) return '#10B981';
  if (score >= 6) return '#F59E0B';
  return '#EF4444';
}

function scoreVerdict(score: number): string {
  if (score >= 9) return 'Outstanding';
  if (score >= 8) return 'Excellent';
  if (score >= 7) return 'Great';
  if (score >= 6) return 'Good';
  if (score >= 5) return 'Decent';
  return 'Needs Work';
}

export function buildScorePage(data: ScorePageData): string {
  const {
    score, summary, occasion, username, imageUrl, shareId, referralCode,
  } = data;

  const color = scoreColor(score);
  const verdict = scoreVerdict(score);
  const pageTitle = `${verdict} ${score.toFixed(1)}/10 ${occasion ? `— ${occasion}` : ''} | Or This?`;
  const pageDescription = summary.slice(0, 200);
  const shareUrl = `${WEB_BASE_URL}/s/${shareId}`;
  const ogImage = imageUrl || `${WEB_BASE_URL}/og-default.png`;
  const downloadUrl = referralCode
    ? `${APP_STORE_URL}?ct=${encodeURIComponent(referralCode)}`
    : APP_STORE_URL;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(pageTitle)}</title>

  <!-- Open Graph -->
  <meta property="og:title" content="${escapeHtml(pageTitle)}">
  <meta property="og:description" content="${escapeHtml(pageDescription)}">
  <meta property="og:image" content="${escapeHtml(ogImage)}">
  <meta property="og:url" content="${escapeHtml(shareUrl)}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Or This?">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(pageTitle)}">
  <meta name="twitter:description" content="${escapeHtml(pageDescription)}">
  <meta name="twitter:image" content="${escapeHtml(ogImage)}">
  <meta name="twitter:site" content="@OrThisApp">

  <!-- Apple Smart App Banner -->
  <meta name="apple-itunes-app" content="app-id=6759472490, app-argument=${escapeHtml(shareUrl)}">

  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #FBF7F4;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 48px 16px;
      color: #1A1A1A;
    }

    .logo {
      font-size: 28px;
      font-weight: 500;
      letter-spacing: -0.5px;
      margin-bottom: 40px;
      color: #1A1A1A;
    }

    .logo em {
      font-family: Georgia, 'Times New Roman', serif;
      font-style: italic;
      color: #E85D4C;
    }

    .card {
      background: #fff;
      border-radius: 0;
      overflow: hidden;
      max-width: 460px;
      width: 100%;
      box-shadow: 0 4px 24px rgba(0,0,0,0.06);
    }

    .outfit-image {
      width: 100%;
      aspect-ratio: 3/4;
      object-fit: cover;
      display: block;
      background: #F5EDE7;
    }

    .outfit-placeholder {
      width: 100%;
      aspect-ratio: 3/4;
      background: #F5EDE7;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 48px;
    }

    .score-bar {
      background: ${color};
      padding: 20px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .score-number {
      font-size: 56px;
      font-weight: 700;
      color: #fff;
      line-height: 1;
      font-family: Georgia, serif;
      font-style: italic;
    }

    .score-label {
      text-align: right;
      color: rgba(255,255,255,0.9);
    }

    .score-verdict {
      font-size: 18px;
      font-weight: 600;
      display: block;
    }

    .score-out-of {
      font-size: 13px;
      display: block;
      margin-top: 2px;
      opacity: 0.8;
    }

    .content {
      padding: 24px 28px 32px;
    }

    .section-label {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 1.5px;
      color: #9CA3AF;
      text-transform: uppercase;
      margin-bottom: 8px;
    }

    .summary {
      font-size: 15px;
      line-height: 1.6;
      color: #2D2D2D;
      margin-bottom: 20px;
    }

    .meta-row {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 28px;
    }

    .occasion-pill {
      display: inline-block;
      padding: 5px 12px;
      border: 1px solid #E85D4C;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 1px;
      color: #E85D4C;
      text-transform: uppercase;
    }

    .username {
      font-size: 12px;
      color: #9CA3AF;
    }

    .divider {
      width: 40px;
      height: 1px;
      background: #E5E7EB;
      margin-bottom: 24px;
    }

    .cta-section {
      text-align: center;
    }

    .cta-label {
      font-size: 12px;
      color: #6B7280;
      margin-bottom: 14px;
    }

    .btn-appstore {
      display: inline-block;
      background: #1A1A1A;
      color: #fff;
      text-decoration: none;
      padding: 14px 28px;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.3px;
      margin-bottom: 10px;
      width: 100%;
      text-align: center;
      transition: background 0.15s;
    }

    .btn-appstore:hover {
      background: #E85D4C;
    }

    .btn-playstore {
      display: inline-block;
      background: #fff;
      color: #1A1A1A;
      text-decoration: none;
      padding: 14px 28px;
      font-size: 14px;
      font-weight: 600;
      border: 1px solid #E5E7EB;
      width: 100%;
      text-align: center;
      transition: border-color 0.15s;
    }

    .btn-playstore:hover {
      border-color: #E85D4C;
      color: #E85D4C;
    }

    .footer {
      margin-top: 40px;
      text-align: center;
      font-size: 12px;
      color: #9CA3AF;
    }

    .footer a {
      color: #E85D4C;
      text-decoration: none;
    }
  </style>
</head>
<body>

  <div class="logo">Or <em>This?</em></div>

  <div class="card">

    <!-- Outfit Image -->
    ${imageUrl
      ? `<img class="outfit-image" src="${escapeHtml(imageUrl)}" alt="Outfit" loading="lazy">`
      : `<div class="outfit-placeholder">👗</div>`
    }

    <!-- Score Bar -->
    <div class="score-bar">
      <div class="score-number">${score.toFixed(1)}</div>
      <div class="score-label">
        <span class="score-verdict">${verdict}</span>
        <span class="score-out-of">out of 10</span>
      </div>
    </div>

    <!-- Content -->
    <div class="content">

      ${occasion || username ? `
      <div class="meta-row">
        ${occasion ? `<span class="occasion-pill">${escapeHtml(occasion)}</span>` : ''}
        ${username ? `<span class="username">@${escapeHtml(username)}</span>` : ''}
      </div>
      ` : ''}

      <div class="section-label">AI Feedback</div>
      <p class="summary">${escapeHtml(summary)}</p>

      <div class="divider"></div>

      <div class="cta-section">
        <p class="cta-label">Get your outfit scored by AI</p>
        <a href="${escapeHtml(downloadUrl)}" class="btn-appstore">
          ↓ Download on the App Store
        </a>
        <a href="${escapeHtml(PLAY_STORE_URL)}" class="btn-playstore">
          ↓ Get it on Google Play
        </a>
      </div>

    </div>
  </div>

  <div class="footer">
    <a href="https://orthis.app">orthis.app</a> · AI outfit feedback in seconds
  </div>

</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
