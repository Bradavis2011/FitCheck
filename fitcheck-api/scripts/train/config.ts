/**
 * AI Training Pipeline Configuration
 */

import { TrainingConfig } from './types.js';
import dotenv from 'dotenv';

dotenv.config();

export const config: TrainingConfig = {
  // API Keys (from environment)
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  gettyApiKey: process.env.GETTY_API_KEY,
  unsplashAccessKey: process.env.UNSPLASH_ACCESS_KEY,
  pexelsApiKey: process.env.PEXELS_API_KEY,

  // Pipeline settings
  imagesPerSource: 10, // Fetch 10 images per source (paid tier)
  geminiRateLimitRPM: 60, // Paid tier = 1500 RPM (use 60 for safety)
  consistencyRuns: 2, // Run each image 2x for consistency testing

  // Quality thresholds (targets from plan)
  targetBrandVoice: 95,
  targetSpecificity: 90,
  targetActionability: 85,
  targetConsistencyVar: 0.5,

  // Optimization
  enableOptimization: true,
  optimizationSampleSize: 5, // Re-test 5 weak images with optimized prompt
};

// Validate required keys
if (!config.geminiApiKey) {
  throw new Error('GEMINI_API_KEY is required for training pipeline');
}

// Image search queries by source
export const IMAGE_QUERIES = {
  getty: [
    'red carpet fashion',
    'fashion week street style',
    'celebrity outfit awards show',
    'fashion show runway',
  ],
  unsplash: [
    'outfit of the day',
    'street style fashion',
    'date night outfit',
    'business casual',
    'formal wear',
  ],
  pexels: [
    'fashion outfit',
    'casual outfit',
    'formal wear',
    'street style',
  ],
};
