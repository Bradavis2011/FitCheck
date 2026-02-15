import { api } from '../lib/api';

export interface StyleDNA {
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

export interface StyleProfileResponse {
  topColors: Array<{
    color: string;
    avgScore: number;
    appearances: number;
  }>;
  dominantArchetypes: Array<{
    archetype: string;
    count: number;
    percentage: number;
  }>;
  averageScores: {
    colorCoordination: number;
    proportions: number;
    fit: number;
    styleCoherence: number;
  } | null;
  totalOutfits: number;
}

export interface StyleEvolutionResponse {
  weeklyData: Array<{
    week: string;
    outfitCount: number;
    avgColorScore: number;
    avgProportionScore: number;
    avgFitScore: number;
    avgCoherenceScore: number;
    avgOverallScore: number;
  }>;
}

export interface OutfitRecommendation {
  title: string;
  description: string;
  confidence: number;
  reasoning: string[];
  suggestedColors: string[];
  suggestedArchetypes: string[];
  suggestedGarments: string[];
  colorHarmony?: string;
  formalityLevel?: number;
}

export interface RecommendationsResponse {
  recommendations: OutfitRecommendation[];
}

/**
 * Get user's Style Profile (aggregated Style DNA)
 * Shows top colors, dominant archetypes, and average scores
 */
export async function getStyleProfile(): Promise<StyleProfileResponse> {
  const response = await api.get('/api/user/style-profile');
  return response.data;
}

/**
 * Get user's Style Evolution over time
 * Shows weekly trends in style scores
 */
export async function getStyleEvolution(): Promise<StyleEvolutionResponse> {
  const response = await api.get('/api/user/style-evolution');
  return response.data;
}

/**
 * Get outfit recommendations based on user's StyleDNA
 * Optionally filter by occasion, weather, and formality
 */
export async function getRecommendations(params?: {
  occasion?: string;
  weather?: string;
  formality?: number;
}): Promise<RecommendationsResponse> {
  const queryParams = new URLSearchParams();
  if (params?.occasion) queryParams.append('occasion', params.occasion);
  if (params?.weather) queryParams.append('weather', params.weather);
  if (params?.formality) queryParams.append('formality', params.formality.toString());

  const url = `/api/outfits/recommendations${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await api.get(url);
  return response.data;
}

/**
 * Check if user has enough Style DNA data for insights
 */
export async function hasStyleData(): Promise<boolean> {
  try {
    const profile = await getStyleProfile();
    return profile.totalOutfits >= 3;
  } catch (error) {
    return false;
  }
}
