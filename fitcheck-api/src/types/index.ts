import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: {
    id: string;
    email: string;
    tier: string;
  };
  // Explicit declarations ensure these are always recognized even if
  // @types/express is not installed (e.g. when NODE_ENV=production skips devDeps)
  body: any;
  query: any;
  params: any;
  headers: any;
}

export interface StyleDNAExtraction {
  dominantColors: string[];
  colorHarmony: string | null;
  colorCount: number | null;
  formalityLevel: number | null;
  styleArchetypes: string[];
  silhouetteType: string | null;
  garments: string[];
  patterns: string[];
  textures: string[];
  colorScore: number | null;
  proportionScore: number | null;
  fitScore: number | null;
  coherenceScore: number | null;
}

export interface OutfitFeedback {
  overallScore: number;
  summary: string;
  whatsWorking: Array<{
    point: string;
    detail: string;
  }>;
  consider: Array<{
    point: string;
    detail: string;
  }>;
  quickFixes: Array<{
    suggestion: string;
    impact: string;
  }>;
  occasionMatch: {
    score: number;
    notes: string;
  };
  styleDNA: StyleDNAExtraction;
}

export interface OutfitCheckInput {
  imageUrl?: string;
  imageBase64?: string;
  occasions: string[];
  setting?: string;
  weather?: string;
  vibe?: string;
  specificConcerns?: string;
}
