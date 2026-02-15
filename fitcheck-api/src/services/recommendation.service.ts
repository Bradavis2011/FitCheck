import { prisma } from '../utils/prisma.js';

export interface RecommendationContext {
  occasion?: string;
  weather?: string;
  formality?: number; // 1-5
}

export interface OutfitRecommendation {
  title: string;
  description: string;
  confidence: number; // 0-1
  reasoning: string[];
  suggestedColors: string[];
  suggestedArchetypes: string[];
  suggestedGarments: string[];
  colorHarmony?: string;
  formalityLevel?: number;
}

export async function getRecommendations(
  userId: string,
  context: RecommendationContext
): Promise<OutfitRecommendation[]> {
  // Get user's StyleDNA history (last 20 outfits)
  const styleDNAs = await prisma.styleDNA.findMany({
    where: { userId },
    include: {
      outfitCheck: {
        select: {
          aiScore: true,
          occasions: true,
          weather: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  if (styleDNAs.length < 3) {
    // Not enough data - return generic recommendations
    return getGenericRecommendations(context);
  }

  // Analyze user's style patterns
  const analysis = analyzeStylePatterns(styleDNAs);

  // Generate personalized recommendations
  const recommendations: OutfitRecommendation[] = [];

  // Recommendation 1: Double down on what works
  if (analysis.bestColorCombo.count >= 2) {
    recommendations.push({
      title: 'Your Signature Look',
      description: `Build on your best-performing color combination`,
      confidence: Math.min(analysis.bestColorCombo.avgScore / 10, 1),
      reasoning: [
        `Your ${analysis.bestColorCombo.harmony} color outfits average ${analysis.bestColorCombo.avgScore.toFixed(1)}/10`,
        `This approach has worked ${analysis.bestColorCombo.count} times`,
        analysis.bestColorCombo.colors.length > 0
          ? `Try combining ${analysis.bestColorCombo.colors.slice(0, 3).join(', ')}`
          : 'Stick to colors that have scored well for you',
      ],
      suggestedColors: analysis.bestColorCombo.colors.slice(0, 4),
      suggestedArchetypes: analysis.topArchetypes.slice(0, 2).map(a => a.archetype),
      suggestedGarments: [],
      colorHarmony: analysis.bestColorCombo.harmony,
      formalityLevel: context.formality || analysis.avgFormality,
    });
  }

  // Recommendation 2: Archetype-driven outfit
  if (analysis.topArchetypes.length > 0) {
    const primaryArchetype = analysis.topArchetypes[0];
    const archetypeGarments = getArchetypeGarments(primaryArchetype.archetype, context);

    recommendations.push({
      title: `${capitalize(primaryArchetype.archetype)} Essential`,
      description: `Stay true to your ${primaryArchetype.archetype} style DNA`,
      confidence: primaryArchetype.percentage / 100,
      reasoning: [
        `${primaryArchetype.percentage.toFixed(0)}% of your wardrobe leans ${primaryArchetype.archetype}`,
        `Your ${primaryArchetype.archetype} outfits average ${primaryArchetype.avgScore.toFixed(1)}/10`,
        `This aesthetic consistently works for you`,
      ],
      suggestedColors: analysis.topColors.slice(0, 3).map(c => c.color),
      suggestedArchetypes: [primaryArchetype.archetype],
      suggestedGarments: archetypeGarments,
      formalityLevel: context.formality || analysis.avgFormality,
    });
  }

  // Recommendation 3: Context-aware (occasion + weather)
  if (context.occasion || context.weather) {
    const contextFiltered = styleDNAs.filter(dna => {
      const matchesOccasion = context.occasion
        ? dna.outfitCheck.occasions.some(o => o.toLowerCase().includes(context.occasion!.toLowerCase()))
        : true;
      const matchesWeather = context.weather
        ? dna.outfitCheck.weather?.toLowerCase().includes(context.weather.toLowerCase())
        : true;
      return matchesOccasion && matchesWeather;
    });

    if (contextFiltered.length >= 2) {
      const contextAnalysis = analyzeStylePatterns(contextFiltered);
      const avgScore = contextFiltered.reduce((sum, d) => sum + (d.outfitCheck.aiScore || 0), 0) / contextFiltered.length;

      recommendations.push({
        title: `Proven for ${context.occasion || context.weather || 'This Context'}`,
        description: `Based on your past ${context.occasion || context.weather} outfits`,
        confidence: Math.min(avgScore / 10, 1),
        reasoning: [
          `You've worn ${contextFiltered.length} similar outfits before`,
          `They averaged ${avgScore.toFixed(1)}/10`,
          contextAnalysis.topColors.length > 0
            ? `${contextAnalysis.topColors[0].color} worked best`
            : 'Stick to colors that scored well',
        ],
        suggestedColors: contextAnalysis.topColors.slice(0, 3).map(c => c.color),
        suggestedArchetypes: contextAnalysis.topArchetypes.slice(0, 2).map(a => a.archetype),
        suggestedGarments: getMostUsedGarments(contextFiltered).slice(0, 5),
        formalityLevel: context.formality || contextAnalysis.avgFormality,
      });
    }
  }

  // Recommendation 4: Growth area
  if (analysis.weakestDimension) {
    recommendations.push({
      title: 'Level Up Your Style',
      description: `Improve your ${analysis.weakestDimension.name} game`,
      confidence: 0.7,
      reasoning: [
        `Your ${analysis.weakestDimension.name} scores average ${analysis.weakestDimension.avgScore.toFixed(1)}/10`,
        `Focus on this to elevate your overall look`,
        getImprovementTip(analysis.weakestDimension.name, analysis),
      ],
      suggestedColors: analysis.topColors.slice(0, 3).map(c => c.color),
      suggestedArchetypes: analysis.topArchetypes.slice(0, 1).map(a => a.archetype),
      suggestedGarments: [],
    });
  }

  return recommendations.slice(0, 3); // Return top 3 recommendations
}

// Helper: Analyze user's style patterns from StyleDNA
function analyzeStylePatterns(styleDNAs: any[]) {
  // Best color combination
  const byColorHarmony = new Map<string, { scores: number[]; colors: Set<string> }>();
  styleDNAs.forEach(dna => {
    if (dna.colorHarmony && dna.outfitCheck.aiScore) {
      const entry = byColorHarmony.get(dna.colorHarmony) || { scores: [], colors: new Set() };
      entry.scores.push(dna.outfitCheck.aiScore);
      dna.dominantColors.forEach((c: string) => entry.colors.add(c));
      byColorHarmony.set(dna.colorHarmony, entry);
    }
  });
  const bestColorCombo = Array.from(byColorHarmony.entries())
    .map(([harmony, data]) => ({
      harmony,
      avgScore: data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
      count: data.scores.length,
      colors: Array.from(data.colors),
    }))
    .sort((a, b) => b.avgScore - a.avgScore)[0] || { harmony: 'complementary', avgScore: 7, count: 0, colors: [] };

  // Top colors by score
  const colorScores = new Map<string, { total: number; count: number }>();
  styleDNAs.forEach(dna => {
    if (dna.outfitCheck.aiScore) {
      dna.dominantColors.forEach((color: string) => {
        const entry = colorScores.get(color) || { total: 0, count: 0 };
        entry.total += dna.outfitCheck.aiScore!;
        entry.count++;
        colorScores.set(color, entry);
      });
    }
  });
  const topColors = Array.from(colorScores.entries())
    .filter(([_, v]) => v.count >= 2)
    .map(([color, v]) => ({ color, avgScore: v.total / v.count, count: v.count }))
    .sort((a, b) => b.avgScore - a.avgScore);

  // Top archetypes
  const archetypeCounts = new Map<string, { count: number; totalScore: number }>();
  styleDNAs.forEach(dna => {
    dna.styleArchetypes.forEach((a: string) => {
      const entry = archetypeCounts.get(a) || { count: 0, totalScore: 0 };
      entry.count++;
      entry.totalScore += dna.outfitCheck.aiScore || 0;
      archetypeCounts.set(a, entry);
    });
  });
  const totalArchetypes = Array.from(archetypeCounts.values()).reduce((sum, v) => sum + v.count, 0);
  const topArchetypes = Array.from(archetypeCounts.entries())
    .map(([archetype, data]) => ({
      archetype,
      percentage: (data.count / totalArchetypes) * 100,
      avgScore: data.totalScore / data.count,
    }))
    .sort((a, b) => b.percentage - a.percentage);

  // Average formality
  const formalityScores = styleDNAs.filter(d => d.formalityLevel).map(d => d.formalityLevel!);
  const avgFormality = formalityScores.length > 0
    ? Math.round(formalityScores.reduce((a, b) => a + b, 0) / formalityScores.length)
    : 3;

  // Sub-scores analysis
  const subScores = { color: 0, proportion: 0, fit: 0, coherence: 0, count: 0 };
  styleDNAs.forEach(dna => {
    if (dna.colorScore && dna.proportionScore && dna.fitScore && dna.coherenceScore) {
      subScores.color += dna.colorScore;
      subScores.proportion += dna.proportionScore;
      subScores.fit += dna.fitScore;
      subScores.coherence += dna.coherenceScore;
      subScores.count++;
    }
  });

  let weakestDimension = null;
  if (subScores.count >= 3) {
    const dimensions = [
      { name: 'color coordination', avgScore: subScores.color / subScores.count },
      { name: 'proportions', avgScore: subScores.proportion / subScores.count },
      { name: 'fit', avgScore: subScores.fit / subScores.count },
      { name: 'style coherence', avgScore: subScores.coherence / subScores.count },
    ].sort((a, b) => a.avgScore - b.avgScore);
    weakestDimension = dimensions[0];
  }

  return {
    bestColorCombo,
    topColors,
    topArchetypes,
    avgFormality,
    weakestDimension,
  };
}

// Helper: Get generic recommendations when user has little data
function getGenericRecommendations(context: RecommendationContext): OutfitRecommendation[] {
  return [
    {
      title: 'Start with Neutrals',
      description: 'Build a solid foundation with versatile colors',
      confidence: 0.8,
      reasoning: [
        'Navy, white, and gray are universally flattering',
        'Easy to mix and match as you build your style profile',
        'These colors consistently score well across users',
      ],
      suggestedColors: ['navy', 'white', 'gray', 'black'],
      suggestedArchetypes: ['minimalist', 'classic'],
      suggestedGarments: ['chinos', 'button-down', 'sneakers', 'watch'],
      colorHarmony: 'monochromatic',
      formalityLevel: context.formality || 3,
    },
    {
      title: 'Classic Proportions',
      description: 'Well-fitted basics that work anywhere',
      confidence: 0.75,
      reasoning: [
        'Focus on fit over trends',
        'Balanced proportions score higher than experimental silhouettes',
        'Submit a few outfits to unlock personalized recommendations',
      ],
      suggestedColors: ['navy', 'white', 'tan'],
      suggestedArchetypes: ['classic', 'preppy'],
      suggestedGarments: ['fitted shirt', 'tailored pants', 'leather shoes'],
      formalityLevel: context.formality || 3,
    },
  ];
}

// Helper: Get garments for archetype
function getArchetypeGarments(archetype: string, context: RecommendationContext): string[] {
  const garmentMap: Record<string, string[]> = {
    minimalist: ['simple tee', 'tailored trousers', 'clean sneakers', 'minimal watch'],
    classic: ['oxford shirt', 'chinos', 'loafers', 'leather belt'],
    streetwear: ['graphic tee', 'joggers', 'sneakers', 'baseball cap'],
    preppy: ['polo', 'khakis', 'boat shoes', 'sweater'],
    bohemian: ['flowy shirt', 'wide-leg pants', 'sandals', 'layered jewelry'],
    romantic: ['soft blouse', 'midi skirt', 'heels', 'delicate accessories'],
    edgy: ['leather jacket', 'distressed jeans', 'boots', 'statement jewelry'],
    professional: ['blazer', 'dress pants', 'dress shoes', 'structured bag'],
  };

  const baseGarments = garmentMap[archetype.toLowerCase()] || garmentMap.classic;

  // Adjust for formality
  if (context.formality && context.formality >= 4) {
    return ['blazer', 'dress pants', 'dress shoes', 'watch'];
  } else if (context.formality && context.formality <= 2) {
    return ['t-shirt', 'jeans', 'sneakers', 'cap'];
  }

  return baseGarments;
}

// Helper: Get most used garments from outfit set
function getMostUsedGarments(styleDNAs: any[]): string[] {
  const garmentCounts = new Map<string, number>();
  styleDNAs.forEach(dna => {
    dna.garments.forEach((g: string) => {
      garmentCounts.set(g, (garmentCounts.get(g) || 0) + 1);
    });
  });
  return Array.from(garmentCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([garment]) => garment);
}

// Helper: Get improvement tip for weak dimension
function getImprovementTip(dimension: string, analysis: any): string {
  const tips: Record<string, string> = {
    'color coordination': `Try ${analysis.bestColorCombo.harmony} color schemes - they work well for you`,
    'proportions': 'Balance fitted and relaxed pieces for better visual flow',
    'fit': 'Consider tailoring or sizing adjustments for a more polished look',
    'style coherence': `Lean into your ${analysis.topArchetypes[0]?.archetype || 'signature'} aesthetic consistently`,
  };
  return tips[dimension] || 'Focus on the details';
}

// Helper: Capitalize first letter
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
