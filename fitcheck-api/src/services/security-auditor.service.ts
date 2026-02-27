/**
 * Security Auditor Agent
 *
 * Daily 2:30am UTC — scans codebase and env config for security issues.
 * Emails only when findings exist (silent when clean).
 * Cost: $0 — filesystem reads + npm audit + env var checks only.
 */

import { execSync } from 'child_process';
import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';
import { Resend } from 'resend';
import { publishToIntelligenceBus } from './intelligence-bus.service.js';

export interface Finding {
  check: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  detail: string;
  file?: string;
}

// ─── File cache ───────────────────────────────────────────────────────────────

const fileCache = new Map<string, string>();

function getFileContent(filePath: string): string {
  if (fileCache.has(filePath)) return fileCache.get(filePath)!;
  try {
    const content = readFileSync(filePath, 'utf8');
    fileCache.set(filePath, content);
    return content;
  } catch {
    return '';
  }
}

/** Walk a directory and return all .ts file paths */
function walkTs(dir: string): string[] {
  const results: string[] = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'dist') {
        results.push(...walkTs(full));
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        results.push(full);
      }
    }
  } catch { /* directory may not exist */ }
  return results;
}

// ─── Individual checks ────────────────────────────────────────────────────────

function checkCorsWildcard(): Finding[] {
  const cors = process.env.CORS_ORIGIN || '';
  if (cors.includes('*')) {
    return [{
      check: 'CORS wildcard',
      severity: 'critical',
      detail: `CORS_ORIGIN env var contains '*' — all origins allowed. Restrict to your app's domain in Railway.`,
    }];
  }
  return [];
}

function checkHardcodedAdminEmails(srcDir: string): Finding[] {
  const findings: Finding[] = [];
  const adminEmailPattern = /ADMIN_EMAILS\s*=\s*\[|['"]admin@|['"]bradavis/gi;
  for (const file of walkTs(srcDir)) {
    const content = getFileContent(file);
    if (adminEmailPattern.test(content)) {
      findings.push({
        check: 'Hardcoded admin email',
        severity: 'critical',
        detail: `Admin email pattern found — use ADMIN_USER_IDS env var instead.`,
        file: path.relative(srcDir, file),
      });
    }
    adminEmailPattern.lastIndex = 0;
  }
  return findings;
}

function checkWebhookHmac(srcDir: string): Finding[] {
  const findings: Finding[] = [];
  const webhookFiles = walkTs(srcDir).filter(f => f.includes('webhook'));
  for (const file of webhookFiles) {
    const content = getFileContent(file);
    const hasHmacOrSvix = /timingSafeEqual|svix|createHmac|Webhook/.test(content);
    if (!hasHmacOrSvix) {
      findings.push({
        check: 'Webhook without HMAC',
        severity: 'high',
        detail: `No HMAC/svix signature validation found.`,
        file: path.relative(srcDir, file),
      });
    }
  }
  return findings;
}

function checkAdminTokenLength(): Finding[] {
  const token = process.env.ADMIN_DASHBOARD_TOKEN || '';
  if (token && token.length < 32) {
    return [{
      check: 'Admin token too short',
      severity: 'high',
      detail: `ADMIN_DASHBOARD_TOKEN is only ${token.length} chars — use at least 32 random chars.`,
    }];
  }
  if (!token) {
    return [{
      check: 'Admin token missing',
      severity: 'high',
      detail: 'ADMIN_DASHBOARD_TOKEN is not set — admin dashboard is unprotected.',
    }];
  }
  return [];
}

function checkRawSql(srcDir: string): Finding[] {
  const findings: Finding[] = [];
  const pattern = /\$queryRawUnsafe|\$executeRawUnsafe/g;
  for (const file of walkTs(srcDir)) {
    const content = getFileContent(file);
    if (pattern.test(content)) {
      findings.push({
        check: 'Unsafe raw SQL',
        severity: 'high',
        detail: 'Use $queryRaw or $executeRaw with tagged template literals instead.',
        file: path.relative(srcDir, file),
      });
    }
    pattern.lastIndex = 0;
  }
  return findings;
}

function checkXssInEmailTemplates(srcDir: string): Finding[] {
  const findings: Finding[] = [];
  // Look for unescaped user-controlled fields interpolated directly into HTML strings
  const pattern = /`[^`]*<[^>]*>\$\{[^}]*(reason|details|content|name|username|bio|title|body)[^}]*\}/gi;
  for (const file of walkTs(srcDir)) {
    const content = getFileContent(file);
    if (pattern.test(content)) {
      findings.push({
        check: 'Potential XSS in email template',
        severity: 'medium',
        detail: 'User-controlled field interpolated into HTML without escapeHtml(). Use escapeHtml() from utils/escape.ts.',
        file: path.relative(srcDir, file),
      });
    }
    pattern.lastIndex = 0;
  }
  return findings;
}

function checkDashboardBeforeHelmet(serverFile: string): Finding[] {
  const content = getFileContent(serverFile);
  const dashboardPos = content.indexOf("app.use('/dashboard'");
  const helmetPos = content.indexOf('app.use(helmet())');
  if (dashboardPos > -1 && helmetPos > -1 && dashboardPos < helmetPos) {
    // This is intentional — static files served before helmet for CDN CSP
    // Only flag if there's no comment explaining it
    if (!content.slice(dashboardPos - 200, dashboardPos).includes('before helmet')) {
      return [{
        check: 'Dashboard static before helmet',
        severity: 'medium',
        detail: 'Static dashboard files are served before helmet(). If intentional, add a comment.',
        file: 'server.ts',
      }];
    }
  }
  return [];
}

function checkUnprotectedRoutes(srcDir: string): Finding[] {
  const findings: Finding[] = [];
  const routesDir = path.join(srcDir, 'routes');
  for (const file of walkTs(routesDir)) {
    const content = getFileContent(file);
    // Skip waitlist (intentionally public) and agent-admin (has its own auth)
    const basename = path.basename(file);
    if (['waitlist.routes.ts', 'agent-admin.routes.ts', 'auth.routes.ts'].includes(basename)) continue;
    // Flag route files that define routes but don't use authenticateToken
    if (content.includes('router.') && !content.includes('authenticateToken')) {
      findings.push({
        check: 'Route file without authenticateToken',
        severity: 'medium',
        detail: 'No authenticateToken middleware found — verify all routes are intentionally public.',
        file: path.relative(srcDir, file),
      });
    }
  }
  return findings;
}

function checkUnusedDependencies(apiDir: string): Finding[] {
  const findings: Finding[] = [];
  try {
    const pkgPath = path.join(apiDir, 'package.json');
    const pkg = JSON.parse(getFileContent(pkgPath));
    const deps = Object.keys(pkg.dependencies || {});
    const srcContent = walkTs(path.join(apiDir, 'src'))
      .map(f => getFileContent(f))
      .join('\n');

    const knownOptional = new Set(['@sentry/node', 'dotenv', 'prisma', '@prisma/client']);
    const suspicious: string[] = [];
    for (const dep of deps) {
      if (knownOptional.has(dep)) continue;
      // Simple heuristic: package name used anywhere in source
      const searchName = dep.replace(/^@[^/]+\//, ''); // strip scope
      if (!srcContent.includes(searchName) && !srcContent.includes(dep)) {
        suspicious.push(dep);
      }
    }
    if (suspicious.length > 0) {
      findings.push({
        check: 'Potentially unused dependencies',
        severity: 'medium',
        detail: `These deps may be unused (check before removing): ${suspicious.slice(0, 5).join(', ')}${suspicious.length > 5 ? ` +${suspicious.length - 5} more` : ''}`,
      });
    }
  } catch { /* best-effort */ }
  return findings;
}

function checkNpmAudit(apiDir: string): Finding[] {
  const findings: Finding[] = [];
  try {
    const result = execSync('npm audit --json --audit-level=high 2>/dev/null', {
      cwd: apiDir,
      encoding: 'utf8',
      timeout: 30000,
    });
    const audit = JSON.parse(result);
    const vulns = audit?.metadata?.vulnerabilities || {};
    const critical = vulns.critical || 0;
    const high = vulns.high || 0;
    if (critical > 0 || high > 0) {
      findings.push({
        check: 'npm audit vulnerabilities',
        severity: critical > 0 ? 'critical' : 'high',
        detail: `npm audit found ${critical} critical + ${high} high severity vulnerabilities. Run: npm audit fix`,
      });
    }
  } catch (err: any) {
    // npm audit exits non-zero when vulns found — parse stdout regardless
    try {
      const audit = JSON.parse(err.stdout || '{}');
      const vulns = audit?.metadata?.vulnerabilities || {};
      const critical = vulns.critical || 0;
      const high = vulns.high || 0;
      if (critical > 0 || high > 0) {
        findings.push({
          check: 'npm audit vulnerabilities',
          severity: critical > 0 ? 'critical' : 'high',
          detail: `npm audit found ${critical} critical + ${high} high severity vulnerabilities. Run: npm audit fix`,
        });
      }
    } catch { /* audit unavailable */ }
  }
  return findings;
}

function checkErrorHandlerStackLeaks(srcDir: string): Finding[] {
  const findings: Finding[] = [];
  const errorHandlerPath = path.join(srcDir, 'middleware', 'errorHandler.ts');
  const content = getFileContent(errorHandlerPath);
  if (content.includes('stack') && content.includes('res.json') && !content.includes('NODE_ENV')) {
    findings.push({
      check: 'Error handler stack trace leak',
      severity: 'low',
      detail: 'errorHandler.ts may be sending stack traces to clients regardless of NODE_ENV.',
      file: 'middleware/errorHandler.ts',
    });
  }
  return findings;
}

// ─── Main runner ──────────────────────────────────────────────────────────────

export async function runSecurityAudit(): Promise<void> {
  console.log('[SecurityAuditor] Starting security audit...');
  fileCache.clear();

  const apiDir = process.cwd();
  const srcDir = path.join(apiDir, 'src');
  const serverFile = path.join(srcDir, 'server.ts');

  const findings: Finding[] = [
    ...checkCorsWildcard(),
    ...checkHardcodedAdminEmails(srcDir),
    ...checkWebhookHmac(srcDir),
    ...checkAdminTokenLength(),
    ...checkRawSql(srcDir),
    ...checkXssInEmailTemplates(srcDir),
    ...checkDashboardBeforeHelmet(serverFile),
    ...checkUnprotectedRoutes(srcDir),
    ...checkUnusedDependencies(apiDir),
    ...checkNpmAudit(apiDir),
    ...checkErrorHandlerStackLeaks(srcDir),
  ];

  const summary = {
    total: findings.length,
    critical: findings.filter(f => f.severity === 'critical').length,
    high: findings.filter(f => f.severity === 'high').length,
    medium: findings.filter(f => f.severity === 'medium').length,
    low: findings.filter(f => f.severity === 'low').length,
    checkedAt: new Date().toISOString(),
  };

  console.log(`[SecurityAuditor] Findings: ${summary.total} total (${summary.critical} critical, ${summary.high} high, ${summary.medium} medium, ${summary.low} low)`);

  // Publish to intelligence bus for Founder Brief
  await publishToIntelligenceBus('security-auditor', 'security_audit', {
    ...summary,
    findings: findings.map(f => ({ check: f.check, severity: f.severity, file: f.file })),
  }).catch(() => {});

  // Email only when findings exist
  if (findings.length === 0) {
    console.log('[SecurityAuditor] No findings — skipping email');
    return;
  }

  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  const recipient = process.env.REPORT_RECIPIENT_EMAIL;
  if (!resend || !recipient) {
    console.log('[SecurityAuditor] No email configured — findings logged only');
    return;
  }

  const SEVERITY_COLOR: Record<string, string> = {
    critical: '#EF4444',
    high: '#F97316',
    medium: '#F59E0B',
    low: '#6B7280',
  };

  const rows = findings.map(f => `
    <tr>
      <td style="padding:8px 12px;font-size:13px;font-weight:600;color:${SEVERITY_COLOR[f.severity] || '#1A1A1A'};border-bottom:1px solid #F5EDE7;text-transform:uppercase;">${f.severity}</td>
      <td style="padding:8px 12px;font-size:13px;color:#1A1A1A;border-bottom:1px solid #F5EDE7;">${f.check}</td>
      <td style="padding:8px 12px;font-size:13px;color:#2D2D2D;border-bottom:1px solid #F5EDE7;">${f.detail}${f.file ? `<br><code style="font-size:11px;color:#6B7280;">${f.file}</code>` : ''}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#FBF7F4;padding:40px;">
    <div style="max-width:750px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;border:2px solid ${summary.critical > 0 ? '#EF4444' : summary.high > 0 ? '#F97316' : '#F59E0B'};">
      <h2 style="color:#E85D4C;margin-top:0;">🔐 Or This? Security Audit</h2>
      <p style="color:#2D2D2D;">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      <div style="display:flex;gap:16px;margin-bottom:24px;">
        ${summary.critical > 0 ? `<span style="background:#FEF2F2;color:#EF4444;padding:6px 12px;border-radius:6px;font-size:13px;font-weight:600;">🔴 ${summary.critical} Critical</span>` : ''}
        ${summary.high > 0 ? `<span style="background:#FFF7ED;color:#F97316;padding:6px 12px;border-radius:6px;font-size:13px;font-weight:600;">🟠 ${summary.high} High</span>` : ''}
        ${summary.medium > 0 ? `<span style="background:#FFFBEB;color:#F59E0B;padding:6px 12px;border-radius:6px;font-size:13px;font-weight:600;">🟡 ${summary.medium} Medium</span>` : ''}
        ${summary.low > 0 ? `<span style="background:#F9FAFB;color:#6B7280;padding:6px 12px;border-radius:6px;font-size:13px;font-weight:600;">⚪ ${summary.low} Low</span>` : ''}
      </div>
      <table width="100%" style="border-collapse:collapse;">
        <thead><tr style="background:#F5EDE7;">
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6B7280;font-weight:600;width:80px;">Severity</th>
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6B7280;font-weight:600;width:160px;">Check</th>
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6B7280;font-weight:600;">Detail</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="color:#6B7280;font-size:12px;margin-top:24px;">Or This? · Security Auditor · ${new Date().toISOString()}</p>
    </div>
  </body></html>`;

  const from = process.env.REPORT_FROM_EMAIL || 'alerts@orthis.app';
  const badge = summary.critical > 0 ? '🔴' : summary.high > 0 ? '🟠' : '🟡';
  await resend.emails.send({
    from,
    to: recipient,
    subject: `${badge} Or This? Security Audit — ${summary.total} finding(s) (${summary.critical} critical, ${summary.high} high)`,
    html,
  });

  console.log(`[SecurityAuditor] Sent security audit email: ${summary.total} findings`);
}

/** Exported for Founder Brief consumption */
export async function getSecurityAuditSummary(): Promise<{ total: number; critical: number; high: number } | null> {
  try {
    const { prisma } = await import('../utils/prisma.js');
    const entry = await (prisma as any).intelligenceBusEntry.findFirst({
      where: { agent: 'security-auditor', entryType: 'security_audit' },
      orderBy: { createdAt: 'desc' },
    });
    if (!entry) return null;
    const payload = entry.payload as any;
    return { total: payload.total || 0, critical: payload.critical || 0, high: payload.high || 0 };
  } catch {
    return null;
  }
}
