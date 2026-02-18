/**
 * Pre-Launch Checklist Enforcer
 *
 * Run with: npx tsx scripts/pre-launch-check.ts
 *
 * Validates all configuration and infrastructure requirements before
 * submitting to the app store. Emails a report if RESEND_API_KEY is set.
 */

import 'dotenv/config';

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  detail: string;
}

const results: CheckResult[] = [];
const RAILWAY_URL = process.env.RAILWAY_URL || 'https://fitcheck-production-0f92.up.railway.app';
const TEST_ADMOB_IDS = [
  'ca-app-pub-3940256099942544~3347511713',
  'ca-app-pub-3940256099942544~1458002511',
  'ca-app-pub-3940256099942544/6300978111',
  'ca-app-pub-3940256099942544/1033173712',
];

function pass(name: string, detail: string) {
  results.push({ name, status: 'pass', detail });
}

function fail(name: string, detail: string) {
  results.push({ name, status: 'fail', detail });
}

function warn(name: string, detail: string) {
  results.push({ name, status: 'warn', detail });
}

function skip(name: string, detail: string) {
  results.push({ name, status: 'skip', detail });
}

// ─── 1. Environment Variables ────────────────────────────────────────────────

function checkEnvVars() {
  const required = [
    'DATABASE_URL',
    'GEMINI_API_KEY',
    'CLERK_SECRET_KEY',
    'RESEND_API_KEY',
    'REPORT_RECIPIENT_EMAIL',
  ];

  const optional = [
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'S3_BUCKET_NAME',
    'LIVEKIT_API_KEY',
    'LIVEKIT_API_SECRET',
    'LIVEKIT_URL',
    'POSTHOG_API_KEY',
    'SENTRY_DSN',
    'ENABLE_CRON',
    'ADMIN_USER_IDS',
  ];

  for (const key of required) {
    if (process.env[key]) {
      pass(`Env: ${key}`, 'Set');
    } else {
      fail(`Env: ${key}`, 'NOT SET — required for API to function');
    }
  }

  for (const key of optional) {
    if (process.env[key]) {
      pass(`Env: ${key}`, 'Set');
    } else {
      warn(`Env: ${key}`, 'Not set — some features will be disabled');
    }
  }
}

// ─── 2. Railway Health Check ─────────────────────────────────────────────────

async function checkRailwayHealth() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`${RAILWAY_URL}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const body = await res.json().catch(() => ({}));
      pass('Railway: /health', `HTTP 200 — ${JSON.stringify(body)}`);
    } else {
      fail('Railway: /health', `HTTP ${res.status} — API is not healthy`);
    }
  } catch (e: any) {
    fail('Railway: /health', `Connection failed: ${e.message}`);
  }
}

// ─── 3. AdMob IDs ────────────────────────────────────────────────────────────

async function checkAdMobIds() {
  const fs = await import('fs');
  const path = await import('path');

  const appJsonPath = path.join(process.cwd(), '..', 'fitcheck-app', 'app.json');
  try {
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));
    const plugins = appJson?.expo?.plugins || [];
    let androidId = '';
    let iosId = '';

    for (const plugin of plugins) {
      if (Array.isArray(plugin) && plugin[0] === 'react-native-google-mobile-ads') {
        androidId = plugin[1]?.androidAppId || '';
        iosId = plugin[1]?.iosAppId || '';
      }
    }

    if (!androidId) {
      fail('AdMob: Android App ID', 'Not found in app.json');
    } else if (TEST_ADMOB_IDS.some(id => androidId.includes(id.split('~')[0]) && androidId !== 'ca-app-pub-1244039707249288~4992117276')) {
      fail('AdMob: Android App ID', `Using Google test ID: ${androidId}`);
    } else if (androidId === 'ca-app-pub-1244039707249288~4992117276') {
      pass('AdMob: Android App ID', androidId);
    } else {
      pass('AdMob: Android App ID', androidId);
    }

    if (!iosId) {
      fail('AdMob: iOS App ID', 'Not found in app.json');
    } else if (TEST_ADMOB_IDS.includes(iosId)) {
      fail('AdMob: iOS App ID', `Still using Google test ID: ${iosId} — replace with real iOS App ID`);
    } else {
      pass('AdMob: iOS App ID', iosId);
    }
  } catch (e: any) {
    warn('AdMob: IDs', `Could not read app.json: ${e.message}`);
  }
}

// ─── 4. Clerk Key Type ────────────────────────────────────────────────────────

function checkClerkKey() {
  const easJsonPath = require('path').join(process.cwd(), '..', 'fitcheck-app', 'eas.json');
  try {
    const eas = JSON.parse(require('fs').readFileSync(easJsonPath, 'utf-8'));
    const prodKey = eas?.build?.production?.env?.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || '';
    if (prodKey.startsWith('pk_live_')) {
      pass('Clerk: Production key', 'Using live key in EAS production profile');
    } else if (prodKey.startsWith('pk_test_')) {
      fail('Clerk: Production key', `EAS production profile uses TEST key: ${prodKey.slice(0, 20)}... — replace with pk_live_ key`);
    } else {
      warn('Clerk: Production key', 'No Clerk key found in EAS production env');
    }
  } catch (e: any) {
    warn('Clerk: Production key', `Could not read eas.json: ${e.message}`);
  }
}

// ─── 5. S3 / Storage ─────────────────────────────────────────────────────────

async function checkS3() {
  const bucket = process.env.S3_BUCKET_NAME;
  const region = process.env.AWS_REGION || process.env.S3_REGION;
  const accessKey = process.env.AWS_ACCESS_KEY_ID;

  if (!bucket || !accessKey) {
    warn('S3: Bucket', 'AWS credentials not set — images will fall back to base64 DB storage');
    return;
  }

  try {
    const { S3Client, HeadBucketCommand } = await import('@aws-sdk/client-s3');
    const s3 = new S3Client({ region: region || 'us-east-1' });
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    pass('S3: Bucket accessible', `s3://${bucket}`);
  } catch (e: any) {
    fail('S3: Bucket', `Cannot access s3://${bucket}: ${e.message}`);
  }
}

// ─── 6. Database Connection ───────────────────────────────────────────────────

async function checkDatabase() {
  if (!process.env.DATABASE_URL) {
    skip('Database: Connection', 'DATABASE_URL not set');
    return;
  }
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    const userCount = await prisma.user.count();
    const outfitCount = await prisma.outfitCheck.count();
    await prisma.$disconnect();
    pass('Database: Connection', `Connected — ${userCount} users, ${outfitCount} outfits`);
  } catch (e: any) {
    fail('Database: Connection', `Failed: ${e.message}`);
  }
}

// ─── 7. Resend Email ──────────────────────────────────────────────────────────

async function checkResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    fail('Resend: API key', 'Not set — email reports will not work');
    return;
  }
  try {
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.ok) {
      const data: any = await res.json();
      pass('Resend: API key', `Valid — ${data?.data?.length || 0} domains configured`);
    } else {
      fail('Resend: API key', `Invalid key — HTTP ${res.status}`);
    }
  } catch (e: any) {
    warn('Resend: API key', `Could not verify: ${e.message}`);
  }
}

// ─── 8. PostHog ───────────────────────────────────────────────────────────────

async function checkPostHog() {
  const key = process.env.POSTHOG_API_KEY;
  if (!key) {
    warn('PostHog: API key', 'Not set — server-side analytics disabled');
    return;
  }
  // PostHog doesn't have a simple ping endpoint, just validate key format
  if (key.startsWith('phc_') && key.length > 20) {
    pass('PostHog: API key', 'Key format valid');
  } else {
    warn('PostHog: API key', 'Key format looks unexpected');
  }
}

// ─── 9. Cron Jobs ─────────────────────────────────────────────────────────────

function checkCron() {
  if (process.env.ENABLE_CRON === 'true') {
    pass('Scheduler: ENABLE_CRON', 'Enabled on Railway');
  } else {
    warn('Scheduler: ENABLE_CRON', 'Not set to "true" — daily digests and cron jobs will not run');
  }
}

// ─── 10. Admin Configuration ──────────────────────────────────────────────────

function checkAdminConfig() {
  const adminIds = process.env.ADMIN_USER_IDS;
  if (adminIds && adminIds.trim().length > 0) {
    const ids = adminIds.split(',').filter(Boolean);
    pass('Admin: ADMIN_USER_IDS', `${ids.length} admin user(s) configured`);
  } else {
    warn('Admin: ADMIN_USER_IDS', 'Not set — /api/admin/* routes will be inaccessible');
  }
}

// ─── Report ───────────────────────────────────────────────────────────────────

function printReport() {
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const warned = results.filter(r => r.status === 'warn').length;
  const skipped = results.filter(r => r.status === 'skip').length;

  const icons = { pass: '✅', fail: '❌', warn: '⚠️ ', skip: '⏭️ ' };
  const width = Math.max(...results.map(r => r.name.length)) + 2;

  console.log('\n' + '─'.repeat(80));
  console.log('  OR THIS? — PRE-LAUNCH CHECKLIST');
  console.log('─'.repeat(80));

  for (const r of results) {
    const icon = icons[r.status];
    const name = r.name.padEnd(width);
    console.log(`  ${icon}  ${name}  ${r.detail}`);
  }

  console.log('─'.repeat(80));
  console.log(`  ${passed} passed  |  ${failed} failed  |  ${warned} warnings  |  ${skipped} skipped`);
  console.log('─'.repeat(80) + '\n');

  if (failed > 0) {
    console.log(`🚨 ${failed} critical issue(s) must be resolved before launch.\n`);
    process.exitCode = 1;
  } else if (warned > 0) {
    console.log(`⚠️  ${warned} warning(s). Review before launch.\n`);
  } else {
    console.log('🚀 All checks passed. Ready to launch!\n');
  }
}

async function emailReport() {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.REPORT_RECIPIENT_EMAIL || process.env.ALERT_EMAIL;
  if (!key || !to) return;

  const icons = { pass: '✅', fail: '❌', warn: '⚠️', skip: '⏭️' };
  const colors = { pass: '#10B981', fail: '#EF4444', warn: '#F59E0B', skip: '#9CA3AF' };

  const rows = results.map(r => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${icons[r.status]}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:${colors[r.status]};font-weight:600">${r.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#555;font-size:13px">${r.detail}</td>
    </tr>`).join('');

  const failed = results.filter(r => r.status === 'fail').length;
  const status = failed > 0 ? `❌ ${failed} issue(s) need fixing` : '✅ Ready to launch';

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'launch@orthis.app',
      to,
      subject: `[Or This?] Pre-Launch Check — ${status}`,
      html: `
        <div style="font-family:sans-serif;max-width:700px;margin:0 auto">
          <h2 style="color:#E85D4C">Or This? — Pre-Launch Checklist</h2>
          <p>${new Date().toUTCString()}</p>
          <p><strong>Status: ${status}</strong></p>
          <table style="width:100%;border-collapse:collapse;margin-top:16px">
            <thead>
              <tr style="background:#f8f8f8">
                <th style="padding:8px 12px;text-align:left;font-size:12px;color:#999">STATUS</th>
                <th style="padding:8px 12px;text-align:left;font-size:12px;color:#999">CHECK</th>
                <th style="padding:8px 12px;text-align:left;font-size:12px;color:#999">DETAIL</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`,
    }),
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\nRunning pre-launch checks...\n');

  checkEnvVars();
  checkClerkKey();
  checkCron();
  checkAdminConfig();

  await Promise.all([
    checkRailwayHealth(),
    checkAdMobIds(),
    checkS3(),
    checkDatabase(),
    checkResend(),
    checkPostHog(),
  ]);

  printReport();
  await emailReport();
}

main().catch(e => {
  console.error('Pre-launch check crashed:', e);
  process.exit(1);
});
