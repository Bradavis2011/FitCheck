import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: {
    id: string;
    email: string;
    tier: string;
  };
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
