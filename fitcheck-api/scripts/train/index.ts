#!/usr/bin/env tsx
/**
 * AI Training Pipeline Entry Point
 *
 * Automated, one-command pipeline that:
 * 1. Fetches real fashion images
 * 2. Auto-categorizes them with AI
 * 3. Tests production AI
 * 4. Evaluates quality
 * 5. Detects weaknesses
 * 6. Self-optimizes prompts
 * 7. Generates comprehensive report
 *
 * Usage: npm run train:ai
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { Logger } from './utils/logger.js';
import { CheckpointManager } from './utils/checkpoint.js';
import { acquire } from './stages/1-acquire.js';
import { categorize } from './stages/2-categorize.js';
import { test } from './stages/3-test.js';
import { evaluate } from './stages/4-evaluate.js';
import { analyze } from './stages/5-analyze.js';
import { optimize } from './stages/6-optimize.js';
import { report } from './stages/7-report.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const RUN_ID = `run-${Date.now()}`;

async function main() {
  const logger = new Logger(RUN_ID, DATA_DIR);
  const checkpoint = new CheckpointManager(RUN_ID, DATA_DIR);

  logger.header('OR THIS? AI TRAINING PIPELINE');
  logger.info(`Run ID: ${RUN_ID}`);
  logger.info(`Data directory: ${DATA_DIR}`);
  logger.info('');

  try {
    // Check for resume
    const lastStage = checkpoint.getLastCompletedStage();
    if (lastStage > 0) {
      logger.info(`Resuming from stage ${lastStage + 1} (last completed: ${lastStage})`);
    }

    // Stage 1: ACQUIRE
    let images;
    if (lastStage < 1) {
      images = await acquire(RUN_ID, DATA_DIR, logger);
      checkpoint.save(1, 'ACQUIRE', { imageCount: images.length });
    } else {
      logger.info('Skipping ACQUIRE (already completed)');
      const saved = checkpoint.load(1);
      // Load images from saved data
      images = []; // Would need to reload from disk
    }

    if (images.length === 0) {
      throw new Error('No images acquired - cannot proceed');
    }

    // Stage 2: CATEGORIZE
    let categorizedImages;
    if (lastStage < 2) {
      categorizedImages = await categorize(RUN_ID, DATA_DIR, images, logger);
      checkpoint.save(2, 'CATEGORIZE', { count: categorizedImages.length });
    } else {
      logger.info('Skipping CATEGORIZE (already completed)');
      categorizedImages = images as any; // Would reload from disk
    }

    // Stage 3: TEST
    let responses;
    if (lastStage < 3) {
      responses = await test(RUN_ID, DATA_DIR, categorizedImages, logger);
      checkpoint.save(3, 'TEST', { responseCount: responses.length });
    } else {
      logger.info('Skipping TEST (already completed)');
      responses = []; // Would reload from disk
    }

    // Stage 4: EVALUATE
    let qualityScores, consistencyScores;
    if (lastStage < 4) {
      const evaluation = await evaluate(RUN_ID, DATA_DIR, responses, logger);
      qualityScores = evaluation.qualityScores;
      consistencyScores = evaluation.consistencyScores;
      checkpoint.save(4, 'EVALUATE', {
        qualityCount: qualityScores.length,
        consistencyCount: consistencyScores.length,
      });
    } else {
      logger.info('Skipping EVALUATE (already completed)');
      qualityScores = [];
      consistencyScores = [];
    }

    // Stage 5: ANALYZE
    let weaknessAnalysis;
    if (lastStage < 5) {
      weaknessAnalysis = await analyze(RUN_ID, DATA_DIR, qualityScores, categorizedImages, logger);
      checkpoint.save(5, 'ANALYZE', { weaknessCount: weaknessAnalysis.patterns.length });
    } else {
      logger.info('Skipping ANALYZE (already completed)');
      weaknessAnalysis = { patterns: [], topWeaknesses: [], recommendations: [] };
    }

    // Stage 6: OPTIMIZE
    let optimizationResult;
    if (lastStage < 6) {
      optimizationResult = await optimize(
        RUN_ID,
        DATA_DIR,
        weaknessAnalysis,
        qualityScores,
        categorizedImages,
        logger
      );
      checkpoint.save(6, 'OPTIMIZE', {
        success: optimizationResult?.successful || false,
      });
    } else {
      logger.info('Skipping OPTIMIZE (already completed)');
      optimizationResult = null;
    }

    // Stage 7: REPORT
    if (lastStage < 7) {
      await report(
        RUN_ID,
        DATA_DIR,
        categorizedImages,
        qualityScores,
        consistencyScores,
        weaknessAnalysis,
        optimizationResult,
        logger
      );
      checkpoint.save(7, 'REPORT', { complete: true });
    } else {
      logger.info('Skipping REPORT (already completed)');
    }

    logger.success('\n🎉 AI Training Pipeline Complete!');
    logger.info(`\nResults saved to: ${DATA_DIR}/reports/${RUN_ID}/`);

  } catch (error) {
    logger.error(`\n❌ Pipeline failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    logger.error(error instanceof Error && error.stack ? error.stack : '');
    process.exit(1);
  }
}

// Run the pipeline
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
