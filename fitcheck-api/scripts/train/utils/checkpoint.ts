/**
 * Checkpoint system for resumable training runs
 */

import fs from 'fs';
import path from 'path';
import { Checkpoint } from '../types.js';

export class CheckpointManager {
  private checkpointDir: string;
  private runId: string;

  constructor(runId: string, dataDir: string) {
    this.runId = runId;
    this.checkpointDir = path.join(dataDir, 'checkpoints');
    fs.mkdirSync(this.checkpointDir, { recursive: true });
  }

  /**
   * Save checkpoint for a stage
   */
  save(stage: Checkpoint['stage'], stageName: string, data: any): void {
    const checkpoint: Checkpoint = {
      runId: this.runId,
      stage,
      stageName,
      timestamp: new Date().toISOString(),
      data,
    };

    const filepath = path.join(this.checkpointDir, `${this.runId}-stage-${stage}.json`);
    fs.writeFileSync(filepath, JSON.stringify(checkpoint, null, 2));
  }

  /**
   * Load checkpoint for a stage (if exists)
   */
  load(stage: Checkpoint['stage']): Checkpoint | null {
    const filepath = path.join(this.checkpointDir, `${this.runId}-stage-${stage}.json`);

    if (!fs.existsSync(filepath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filepath, 'utf-8');
      return JSON.parse(content) as Checkpoint;
    } catch (error) {
      console.error(`Failed to load checkpoint for stage ${stage}:`, error);
      return null;
    }
  }

  /**
   * Get the last completed stage
   */
  getLastCompletedStage(): number {
    const files = fs.readdirSync(this.checkpointDir);
    const checkpoints = files
      .filter(f => f.startsWith(this.runId) && f.endsWith('.json'))
      .map(f => {
        const match = f.match(/stage-(\d)\.json$/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => n > 0);

    return checkpoints.length > 0 ? Math.max(...checkpoints) : 0;
  }

  /**
   * Clear all checkpoints for this run
   */
  clear(): void {
    const files = fs.readdirSync(this.checkpointDir);
    files
      .filter(f => f.startsWith(this.runId))
      .forEach(f => {
        fs.unlinkSync(path.join(this.checkpointDir, f));
      });
  }
}
