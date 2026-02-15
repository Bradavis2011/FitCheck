/**
 * Shared TypeScript types for AI Training Pipeline
 */

export interface ImageSource {
  id: string;
  source: 'getty' | 'unsplash' | 'pexels' | 'synthetic';
  sourceUrl?: string;
  attribution?: string;
  base64: string;
  mimeType: string;
}

export interface CategorizedImage extends ImageSource {
  occasion: string[];
  setting?: string;
  weather?: string;
  vibe?: string;
  outfitDescription: string;
  difficultyEstimate: 'easy' | 'medium' | 'hard';
}

export interface AIResponse {
  imageId: string;
  runNumber: 1 | 2; // For consistency testing
  response: any; // OutfitFeedback type
  latencyMs: number;
  tokenUsage?: {
    input: number;
    output: number;
  };
  error?: string;
}

export interface QualityScores {
  imageId: string;
  runNumber: 1 | 2;

  // Brand voice (0-100)
  brandVoiceScore: number;
  brandVoiceIssues: string[];

  // Specificity (0-100)
  specificityScore: number;
  specificityNotes: string[];

  // Actionability (0-100)
  actionabilityScore: number;
  actionabilityNotes: string[];

  // Schema compliance (0-100)
  schemaComplianceScore: number;
  schemaIssues: string[];

  // Overall AI score
  aiScore: number;
}

export interface ConsistencyScores {
  imageId: string;
  scoreDifference: number; // Absolute difference between run 1 and run 2
  themeOverlapPercent: number; // How similar are the themes/points
  consistent: boolean; // < 0.5 score diff and > 70% overlap
}

export interface WeaknessPattern {
  category: string; // e.g., "formal-wear", "brand-voice-hedging"
  severity: 'high' | 'medium' | 'low';
  affectedImages: string[];
  avgScore: number;
  examples: string[];
  suggestedFix: string;
}

export interface WeaknessAnalysis {
  patterns: WeaknessPattern[];
  topWeaknesses: WeaknessPattern[]; // Top 5 by severity
  recommendations: string[];
}

export interface OptimizationResult {
  originalPrompt: string;
  optimizedPrompt: string;
  testResults: {
    imageId: string;
    originalScore: number;
    optimizedScore: number;
    improvement: number;
  }[];
  avgImprovement: number;
  successful: boolean;
}

export interface TrainingReport {
  runId: string;
  timestamp: string;

  // Image stats
  totalImages: number;
  imagesBySource: Record<string, number>;

  // Quality averages
  avgBrandVoice: number;
  avgSpecificity: number;
  avgActionability: number;
  avgConsistency: number;
  schemaCompliance: number; // Percentage

  // Weaknesses
  weaknesses: WeaknessAnalysis;

  // Optimization
  optimization?: OptimizationResult;

  // Recommendations
  recommendations: string[];
}

export interface Checkpoint {
  runId: string;
  stage: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  stageName: string;
  timestamp: string;
  data: any;
}

export interface TrainingConfig {
  // API Keys
  geminiApiKey: string;
  gettyApiKey?: string;
  unsplashAccessKey?: string;
  pexelsApiKey?: string;

  // Pipeline settings
  imagesPerSource: number;
  geminiRateLimitRPM: number;
  consistencyRuns: number;

  // Quality thresholds
  targetBrandVoice: number; // e.g., 95
  targetSpecificity: number; // e.g., 90
  targetActionability: number; // e.g., 85
  targetConsistencyVar: number; // e.g., 0.5

  // Optimization
  enableOptimization: boolean;
  optimizationSampleSize: number; // How many images to re-test
}
