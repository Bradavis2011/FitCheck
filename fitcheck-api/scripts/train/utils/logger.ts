/**
 * Colored console logger with file output for training pipeline
 */

import fs from 'fs';
import path from 'path';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

export class Logger {
  private logFile: string;
  private runId: string;

  constructor(runId: string, dataDir: string) {
    this.runId = runId;
    this.logFile = path.join(dataDir, 'logs', `${runId}.log`);

    // Ensure log directory exists
    fs.mkdirSync(path.dirname(this.logFile), { recursive: true });
  }

  private write(message: string, color?: keyof typeof colors) {
    const timestamp = new Date().toISOString();
    const colorCode = color ? colors[color] : '';
    const resetCode = color ? colors.reset : '';

    // Console output (with color)
    console.log(`${colorCode}${message}${resetCode}`);

    // File output (no color)
    const logLine = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(this.logFile, logLine);
  }

  info(message: string) {
    this.write(`ℹ️  ${message}`, 'blue');
  }

  success(message: string) {
    this.write(`✅ ${message}`, 'green');
  }

  warning(message: string) {
    this.write(`⚠️  ${message}`, 'yellow');
  }

  error(message: string) {
    this.write(`❌ ${message}`, 'red');
  }

  stage(stageNumber: number, stageName: string) {
    const line = '═'.repeat(50);
    this.write(`\n${line}`, 'cyan');
    this.write(`  STAGE ${stageNumber}: ${stageName.toUpperCase()}`, 'cyan');
    this.write(`${line}\n`, 'cyan');
  }

  metric(label: string, value: string | number) {
    this.write(`  ${label}: ${value}`, 'white');
  }

  progress(current: number, total: number, item: string) {
    this.write(`  [${current}/${total}] ${item}`, 'dim');
  }

  header(text: string) {
    const line = '─'.repeat(50);
    this.write(`\n${line}`, 'magenta');
    this.write(`  ${text}`, 'magenta');
    this.write(`${line}`, 'magenta');
  }
}
