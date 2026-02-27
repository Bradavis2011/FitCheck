/**
 * Code Reviewer Agent
 *
 * Wednesday 3:00am UTC — scans codebase for quality issues.
 * Always sends weekly digest email.
 * Cost: $0 — filesystem reads + tsc + prisma validate only.
 */

import { execSync } from 'child_process';
import { readdirSync, readFileSync } from 'fs';
import path from 'path';
import { Resend } from 'resend';
import { publishToIntelligenceBus } from './intelligence-bus.service.js';

export interface CodeFinding {
  check: string;
  severity: 'high' | 'medium' | 'low';
  detail: string;
  file?: string;
}

// ─── File helpers ─────────────────────────────────────────────────────────────

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
  } catch { /* skip missing dirs */ }
  return results;
}

function readFile(filePath: string): string {
  try { return readFileSync(filePath, 'utf8'); } catch { return ''; }
}

// ─── Checks ───────────────────────────────────────────────────────────────────

function checkTypeScriptErrors(apiDir: string): CodeFinding[] {
  try {
    execSync('npx tsc --noEmit', { cwd: apiDir, encoding: 'utf8', timeout: 60000 });
    return [];
  } catch (err: any) {
    const output: string = err.stdout || err.stderr || '';
    const lines = output.split('\n').filter(Boolean);
    const errorCount = lines.filter(l => l.includes('error TS')).length;
    if (errorCount === 0) return [];
    const sample = lines.filter(l => l.includes('error TS')).slice(0, 3).join('\n');
    return [{
      check: 'TypeScript compilation errors',
      severity: 'high',
      detail: `${errorCount} TS error(s). First 3:\n${sample}`,
    }];
  }
}

function checkOversizedFiles(srcDir: string): CodeFinding[] {
  const findings: CodeFinding[] = [];
  for (const file of walkTs(srcDir)) {
    const lines = readFile(file).split('\n').length;
    if (lines > 1000) {
      findings.push({
        check: 'Oversized file',
        severity: 'high',
        detail: `${lines} lines — consider splitting into smaller modules.`,
        file: path.relative(srcDir, file),
      });
    } else if (lines > 500) {
      findings.push({
        check: 'Large file',
        severity: 'medium',
        detail: `${lines} lines — may benefit from refactoring.`,
        file: path.relative(srcDir, file),
      });
    }
  }
  return findings;
}

function checkControllersWithoutZod(srcDir: string): CodeFinding[] {
  const findings: CodeFinding[] = [];
  const controllersDir = path.join(srcDir, 'controllers');
  for (const file of walkTs(controllersDir)) {
    const content = readFile(file);
    const hasReqBody = content.includes('req.body');
    const hasZod = content.includes("from 'zod'") || content.includes('from "zod"');
    if (hasReqBody && !hasZod) {
      findings.push({
        check: 'Controller uses req.body without Zod',
        severity: 'medium',
        detail: 'Add Zod schema validation for all req.body access.',
        file: path.relative(srcDir, file),
      });
    }
  }
  return findings;
}

function checkSensitiveConsoleLog(srcDir: string): CodeFinding[] {
  const findings: CodeFinding[] = [];
  const sensitivePattern = /console\.(log|info|debug)\([^)]*?(password|secret|token|api_key|apikey)/gi;
  for (const file of walkTs(srcDir)) {
    const content = readFile(file);
    if (sensitivePattern.test(content)) {
      findings.push({
        check: 'Sensitive data in console.log',
        severity: 'medium',
        detail: 'Potential password/secret/token logging. Review and remove or redact.',
        file: path.relative(srcDir, file),
      });
    }
    sensitivePattern.lastIndex = 0;
  }
  return findings;
}

function checkPrismaSchema(apiDir: string): CodeFinding[] {
  try {
    execSync('npx prisma validate', { cwd: apiDir, encoding: 'utf8', timeout: 30000 });
    return [];
  } catch (err: any) {
    return [{
      check: 'Prisma schema validation error',
      severity: 'high',
      detail: (err.stderr || err.stdout || 'prisma validate failed').slice(0, 300),
    }];
  }
}

function checkLargeFunctions(srcDir: string): CodeFinding[] {
  const findings: CodeFinding[] = [];
  // Detect exported functions with 5+ parameters
  const pattern = /export\s+(?:async\s+)?function\s+\w+\s*\(([^)]{80,})\)/g;
  for (const file of walkTs(srcDir)) {
    const content = readFile(file);
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      const params = match[1].split(',').length;
      if (params >= 5) {
        findings.push({
          check: 'Function with 5+ parameters',
          severity: 'low',
          detail: `Function has ${params} parameters — consider passing an options object.`,
          file: path.relative(srcDir, file),
        });
        break; // one finding per file
      }
    }
    pattern.lastIndex = 0;
  }
  return findings;
}

function checkExcessiveAnycast(srcDir: string): CodeFinding[] {
  const findings: CodeFinding[] = [];
  const pattern = / as any/g;
  for (const file of walkTs(srcDir)) {
    const content = readFile(file);
    const matches = content.match(pattern) || [];
    if (matches.length > 5) {
      findings.push({
        check: 'Excessive `as any` casts',
        severity: 'low',
        detail: `${matches.length} 'as any' casts found — add proper types where possible.`,
        file: path.relative(srcDir, file),
      });
    }
  }
  return findings;
}

function checkUnusedExports(srcDir: string): CodeFinding[] {
  // Collect all exported names and all import usages across the codebase
  const allFiles = walkTs(srcDir);
  const allContent = allFiles.map(f => readFile(f)).join('\n');

  const findings: CodeFinding[] = [];
  const exportPattern = /^export\s+(?:async\s+)?(?:function|const|class|interface|type)\s+(\w+)/gm;

  for (const file of allFiles) {
    const content = readFile(file);
    let match: RegExpExecArray | null;
    const unused: string[] = [];
    while ((match = exportPattern.exec(content)) !== null) {
      const name = match[1];
      // Skip common framework exports
      if (['default', 'router', 'app', 'handler'].includes(name)) continue;
      // Check if name appears anywhere else in the codebase (rough heuristic)
      const occurrences = (allContent.match(new RegExp(`\\b${name}\\b`, 'g')) || []).length;
      // If only 1-2 occurrences (the export itself + maybe type definition), likely unused
      if (occurrences <= 2) {
        unused.push(name);
      }
    }
    exportPattern.lastIndex = 0;
    if (unused.length > 0) {
      findings.push({
        check: 'Potentially unused exports',
        severity: 'low',
        detail: `${unused.slice(0, 4).join(', ')}${unused.length > 4 ? ` +${unused.length - 4} more` : ''}`,
        file: path.relative(srcDir, file),
      });
    }
  }
  return findings.slice(0, 10); // cap to avoid noise
}

// ─── Main runner ──────────────────────────────────────────────────────────────

export async function runCodeReview(): Promise<void> {
  console.log('[CodeReviewer] Starting code review...');

  const apiDir = process.cwd();
  const srcDir = path.join(apiDir, 'src');

  const findings: CodeFinding[] = [
    ...checkTypeScriptErrors(apiDir),
    ...checkOversizedFiles(srcDir),
    ...checkControllersWithoutZod(srcDir),
    ...checkSensitiveConsoleLog(srcDir),
    ...checkPrismaSchema(apiDir),
    ...checkLargeFunctions(srcDir),
    ...checkExcessiveAnycast(srcDir),
    ...checkUnusedExports(srcDir),
  ];

  const summary = {
    total: findings.length,
    high: findings.filter(f => f.severity === 'high').length,
    medium: findings.filter(f => f.severity === 'medium').length,
    low: findings.filter(f => f.severity === 'low').length,
    reviewedAt: new Date().toISOString(),
  };

  console.log(`[CodeReviewer] Findings: ${summary.total} total (${summary.high} high, ${summary.medium} medium, ${summary.low} low)`);

  // Publish to intelligence bus
  await publishToIntelligenceBus('code-reviewer', 'code_review', {
    ...summary,
    findings: findings.map(f => ({ check: f.check, severity: f.severity, file: f.file })),
  }).catch(() => {});

  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  const recipient = process.env.REPORT_RECIPIENT_EMAIL;
  if (!resend || !recipient) {
    console.log('[CodeReviewer] No email configured — findings logged only');
    return;
  }

  const SEVERITY_COLOR: Record<string, string> = {
    high: '#EF4444',
    medium: '#F59E0B',
    low: '#6B7280',
  };

  const rows = findings.length > 0
    ? findings.map(f => `
      <tr>
        <td style="padding:8px 12px;font-size:13px;font-weight:600;color:${SEVERITY_COLOR[f.severity]};border-bottom:1px solid #F5EDE7;text-transform:uppercase;">${f.severity}</td>
        <td style="padding:8px 12px;font-size:13px;color:#1A1A1A;border-bottom:1px solid #F5EDE7;">${f.check}</td>
        <td style="padding:8px 12px;font-size:13px;color:#2D2D2D;border-bottom:1px solid #F5EDE7;white-space:pre-wrap;">${f.detail}${f.file ? `<br><code style="font-size:11px;color:#6B7280;">${f.file}</code>` : ''}</td>
      </tr>`).join('')
    : `<tr><td colspan="3" style="padding:16px 12px;color:#10B981;font-size:14px;font-weight:600;text-align:center;">✅ No issues found — clean codebase!</td></tr>`;

  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#FBF7F4;padding:40px;">
    <div style="max-width:750px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;">
      <h2 style="color:#E85D4C;margin-top:0;">🔍 Or This? Code Review Digest</h2>
      <p style="color:#2D2D2D;">${dateStr}</p>
      <div style="margin-bottom:20px;">
        ${summary.high > 0 ? `<span style="background:#FEF2F2;color:#EF4444;padding:6px 12px;border-radius:6px;font-size:13px;font-weight:600;margin-right:8px;">🔴 ${summary.high} High</span>` : ''}
        ${summary.medium > 0 ? `<span style="background:#FFFBEB;color:#F59E0B;padding:6px 12px;border-radius:6px;font-size:13px;font-weight:600;margin-right:8px;">🟡 ${summary.medium} Medium</span>` : ''}
        ${summary.low > 0 ? `<span style="background:#F9FAFB;color:#6B7280;padding:6px 12px;border-radius:6px;font-size:13px;font-weight:600;margin-right:8px;">⚪ ${summary.low} Low</span>` : ''}
        ${findings.length === 0 ? `<span style="background:#ECFDF5;color:#10B981;padding:6px 12px;border-radius:6px;font-size:13px;font-weight:600;">✅ All clear</span>` : ''}
      </div>
      <table width="100%" style="border-collapse:collapse;">
        <thead><tr style="background:#F5EDE7;">
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6B7280;font-weight:600;width:70px;">Severity</th>
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6B7280;font-weight:600;width:180px;">Check</th>
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6B7280;font-weight:600;">Detail</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="color:#6B7280;font-size:12px;margin-top:24px;">Or This? · Code Reviewer · ${new Date().toISOString()}</p>
    </div>
  </body></html>`;

  const from = process.env.REPORT_FROM_EMAIL || 'alerts@orthis.app';
  const badge = summary.high > 0 ? '🔴' : summary.medium > 0 ? '🟡' : '✅';
  await resend.emails.send({
    from,
    to: recipient,
    subject: `${badge} Or This? Code Review — ${summary.total > 0 ? `${summary.total} finding(s)` : 'All clear'}`,
    html,
  });

  console.log(`[CodeReviewer] Sent code review digest: ${summary.total} findings`);
}

/** Exported for Founder Brief consumption */
export async function getCodeReviewSummary(): Promise<{ total: number; high: number } | null> {
  try {
    const { prisma } = await import('../utils/prisma.js');
    const entry = await (prisma as any).intelligenceBusEntry.findFirst({
      where: { agent: 'code-reviewer', entryType: 'code_review' },
      orderBy: { createdAt: 'desc' },
    });
    if (!entry) return null;
    const payload = entry.payload as any;
    return { total: payload.total || 0, high: payload.high || 0 };
  } catch {
    return null;
  }
}
