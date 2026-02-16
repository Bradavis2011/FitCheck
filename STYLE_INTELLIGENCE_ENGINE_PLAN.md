# FitCheck Style Intelligence Engine

## Context

FitCheck currently uses Gemini 2.5 Flash with an enhanced prompt (fashion knowledge base, user profiles, few-shot examples, basic feedback memory). While better than a bare API call, it's still fundamentally a **prompt wrapper** -- anyone could replicate it in a weekend.

The goal: Transform the AI into a **Style Intelligence Engine** that accumulates proprietary data with every interaction, gets measurably smarter over time, and produces intelligence no competitor can replicate without the same user base. This is what makes an AI product an acquisition target.

**Core insight:** The LLM is commodity. The moat is the **data layer** between users and the model. Every outfit analyzed should produce structured, queryable intelligence that compounds in value.

---

## Architecture: 3 Layers (in implementation order)

### Layer 1: Style DNA Extraction
**What:** Every outfit analysis extracts structured attributes INTO A SEPARATE TABLE, not just free-text feedback. This creates a queryable fashion dataset that grows with every use.

### Layer 2: Cross-Outfit Intelligence
**What:** The AI remembers a user's best/worst patterns and connects insights across outfits. "Your navy outfits average 8.5 -- this one builds on that strength."

### Layer 3: AI Calibration Loop
**What:** Compare AI scores vs community scores. Feed the delta back into the AI. Prove the system gets smarter over time with a measurable accuracy metric.

---

## Layer 1: Style DNA Extraction

### Why This Matters
Right now, outfit feedback is a JSON blob with free text. You can't query "which color combos score highest?" or "what's trending this month?" Style DNA turns every analysis into structured, queryable data.

### Schema Changes (`fitcheck-api/prisma/schema.prisma`)

```prisma
model StyleDNA {
  id             String   @id @default(uuid())
  outfitCheckId  String   @unique @map("outfit_check_id")
  outfitCheck    OutfitCheck @relation(fields: [outfitCheckId], references: [id], onDelete: Cascade)
  userId         String   @map("user_id")

  // Colors extracted from image
  dominantColors String[] @map("dominant_colors")   // ["navy", "white", "tan"]
  colorHarmony   String?  @map("color_harmony")     // "complementary", "analogous", "monochromatic", "neutral"
  colorCount     Int?     @map("color_count")

  // Style classification
  formalityLevel Int?     @map("formality_level")    // 1-5 (1=very casual, 5=black tie)
  styleArchetypes String[] @map("style_archetypes")  // ["minimalist", "classic", "streetwear"]
  silhouetteType String?  @map("silhouette_type")    // "fitted", "relaxed", "layered", "structured"

  // Garments detected
  garments       String[]                             // ["blazer", "chinos", "sneakers", "watch"]
  patterns       String[]                             // ["solid", "striped", "plaid"]
  textures       String[]                             // ["denim", "cotton", "leather", "knit"]

  // Scores (from AI analysis)
  colorScore       Float? @map("color_score")         // 1-10
  proportionScore  Float? @map("proportion_score")    // 1-10
  fitScore         Float? @map("fit_score")           // 1-10
  coherenceScore   Float? @map("coherence_score")     // 1-10

  createdAt DateTime @default(now()) @map("created_at")

  @@index([userId])
  @@index([createdAt])
  @@map("style_dna")
}
```

Add relation to OutfitCheck:
```prisma
// In OutfitCheck model, add:
styleDNA StyleDNA?
```

### Type Changes (`fitcheck-api/src/types/index.ts`)

Extend `OutfitFeedback` to include Style DNA extraction:

```typescript
export interface StyleDNAExtraction {
  dominantColors: string[];
  colorHarmony: string;
  colorCount: number;
  formalityLevel: number;
  styleArchetypes: string[];
  silhouetteType: string;
  garments: string[];
  patterns: string[];
  textures: string[];
  colorScore: number;
  proportionScore: number;
  fitScore: number;
  coherenceScore: number;
}

export interface OutfitFeedback {
  // ... existing fields stay the same ...
  styleDNA: StyleDNAExtraction;  // NEW - extracted with every analysis
}
```

### AI Prompt Changes (`fitcheck-api/src/services/ai-feedback.service.ts`)

**Add to `responseSchema`** in the Gemini generationConfig:
```typescript
styleDNA: {
  type: 'object',
  properties: {
    dominantColors: { type: 'array', items: { type: 'string' } },
    colorHarmony: { type: 'string' },
    colorCount: { type: 'number' },
    formalityLevel: { type: 'number' },
    styleArchetypes: { type: 'array', items: { type: 'string' } },
    silhouetteType: { type: 'string' },
    garments: { type: 'array', items: { type: 'string' } },
    patterns: { type: 'array', items: { type: 'string' } },
    textures: { type: 'array', items: { type: 'string' } },
    colorScore: { type: 'number' },
    proportionScore: { type: 'number' },
    fitScore: { type: 'number' },
    coherenceScore: { type: 'number' }
  }
}
```

**Add to SYSTEM_PROMPT** response format section:
```
"styleDNA": {
  "dominantColors": ["<color1>", "<color2>", ...],
  "colorHarmony": "<complementary|analogous|monochromatic|triadic|neutral>",
  "colorCount": <number of distinct colors>,
  "formalityLevel": <1-5, where 1=athleisure/loungewear, 2=casual, 3=smart casual, 4=business/cocktail, 5=formal/black tie>,
  "styleArchetypes": ["<primary archetype>", "<secondary if applicable>"],
  "silhouetteType": "<fitted|relaxed|layered|structured|oversized>",
  "garments": ["<each visible garment/accessory>"],
  "patterns": ["<solid|striped|plaid|floral|graphic|abstract|etc>"],
  "textures": ["<denim|cotton|linen|silk|leather|knit|wool|suede|etc>"],
  "colorScore": <1-10 rating for color coordination>,
  "proportionScore": <1-10 rating for proportions/silhouette>,
  "fitScore": <1-10 rating for how well clothes fit>,
  "coherenceScore": <1-10 rating for overall style coherence>
}
```

**Add extraction instructions to SYSTEM_PROMPT:**
```
STYLE DNA EXTRACTION:
In addition to your feedback, extract structured attributes from the outfit:
- Colors: List actual colors visible (not just "blue" - be specific: "navy", "sky blue", "cobalt")
- Classify color harmony type based on the color wheel relationship
- Formality: 1=gym/lounge, 2=casual errand, 3=smart casual/date, 4=office/cocktail, 5=gala/wedding
- Style archetypes: Choose from [minimalist, classic, preppy, streetwear, bohemian, romantic, edgy, sporty, avant-garde, vintage, coastal, western, maximalist]
- Silhouette: Overall shape of the outfit on the body
- Garments: Every visible item including accessories, shoes, bags
- Sub-scores: Rate each dimension independently (a well-fitted but poorly-colored outfit should show high fit, low color)
```

### Save Style DNA After Analysis (`ai-feedback.service.ts`)

In `analyzeOutfit()`, after the existing `prisma.outfitCheck.update()` that saves `aiFeedback`, add:

```typescript
// Save Style DNA to separate table for querying
if (feedback.styleDNA) {
  await prisma.styleDNA.create({
    data: {
      outfitCheckId,
      userId: outfitCheck.userId,
      dominantColors: feedback.styleDNA.dominantColors,
      colorHarmony: feedback.styleDNA.colorHarmony,
      colorCount: feedback.styleDNA.colorCount,
      formalityLevel: feedback.styleDNA.formalityLevel,
      styleArchetypes: feedback.styleDNA.styleArchetypes,
      silhouetteType: feedback.styleDNA.silhouetteType,
      garments: feedback.styleDNA.garments,
      patterns: feedback.styleDNA.patterns,
      textures: feedback.styleDNA.textures,
      colorScore: feedback.styleDNA.colorScore,
      proportionScore: feedback.styleDNA.proportionScore,
      fitScore: feedback.styleDNA.fitScore,
      coherenceScore: feedback.styleDNA.coherenceScore,
    },
  });
}
```

---

## Layer 2: Cross-Outfit Intelligence

### Why This Matters
Currently `getUserFeedbackHistory()` only checks if past feedback was rated helpful. It doesn't know WHAT worked. With Style DNA, we can tell the AI: "This user's navy outfits average 8.5, their monochromatic looks score highest, and they always lose points on accessories."

### Replace `getUserFeedbackHistory()` (`ai-feedback.service.ts`)

Replace the existing weak function with a new `getStyleInsights()`:

```typescript
async function getStyleInsights(userId: string): Promise<string[]> {
  const insights: string[] = [];

  const styleDNAs = await prisma.styleDNA.findMany({
    where: { userId },
    include: { outfitCheck: { select: { aiScore: true, feedbackHelpful: true, occasions: true } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  if (styleDNAs.length < 3) return insights; // Need enough data

  // 1. Best scoring color combinations
  const byColorHarmony = new Map<string, number[]>();
  styleDNAs.forEach(dna => {
    if (dna.colorHarmony && dna.outfitCheck.aiScore) {
      const scores = byColorHarmony.get(dna.colorHarmony) || [];
      scores.push(dna.outfitCheck.aiScore);
      byColorHarmony.set(dna.colorHarmony, scores);
    }
  });
  const bestHarmony = [...byColorHarmony.entries()]
    .map(([harmony, scores]) => ({ harmony, avg: scores.reduce((a, b) => a + b) / scores.length, count: scores.length }))
    .filter(h => h.count >= 2)
    .sort((a, b) => b.avg - a.avg);
  if (bestHarmony.length > 0) {
    insights.push(`User's ${bestHarmony[0].harmony} color outfits score highest (avg ${bestHarmony[0].avg.toFixed(1)})`);
  }

  // 2. Strongest and weakest sub-scores
  const avgScores = {
    color: 0, proportion: 0, fit: 0, coherence: 0, count: 0,
  };
  styleDNAs.forEach(dna => {
    if (dna.colorScore && dna.proportionScore && dna.fitScore && dna.coherenceScore) {
      avgScores.color += dna.colorScore;
      avgScores.proportion += dna.proportionScore;
      avgScores.fit += dna.fitScore;
      avgScores.coherence += dna.coherenceScore;
      avgScores.count++;
    }
  });
  if (avgScores.count >= 3) {
    const n = avgScores.count;
    const dimensions = [
      { name: 'color coordination', avg: avgScores.color / n },
      { name: 'proportions', avg: avgScores.proportion / n },
      { name: 'fit', avg: avgScores.fit / n },
      { name: 'style coherence', avg: avgScores.coherence / n },
    ].sort((a, b) => b.avg - a.avg);
    insights.push(`Strongest area: ${dimensions[0].name} (avg ${dimensions[0].avg.toFixed(1)})`);
    insights.push(`Growth area: ${dimensions[3].name} (avg ${dimensions[3].avg.toFixed(1)}) - focus improvement here`);
  }

  // 3. Most-used style archetype
  const archetypeCounts = new Map<string, number>();
  styleDNAs.forEach(dna => {
    dna.styleArchetypes.forEach(a => {
      archetypeCounts.set(a, (archetypeCounts.get(a) || 0) + 1);
    });
  });
  const topArchetype = [...archetypeCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topArchetype && topArchetype[1] >= 3) {
    insights.push(`User's dominant style: ${topArchetype[0]} (${topArchetype[1]} of last ${styleDNAs.length} outfits)`);
  }

  // 4. Favorite colors (most frequently used that score well)
  const colorScores = new Map<string, { total: number; count: number }>();
  styleDNAs.forEach(dna => {
    if (dna.outfitCheck.aiScore) {
      dna.dominantColors.forEach(color => {
        const entry = colorScores.get(color) || { total: 0, count: 0 };
        entry.total += dna.outfitCheck.aiScore!;
        entry.count++;
        colorScores.set(color, entry);
      });
    }
  });
  const topColors = [...colorScores.entries()]
    .filter(([_, v]) => v.count >= 2)
    .map(([color, v]) => ({ color, avg: v.total / v.count, count: v.count }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 3);
  if (topColors.length > 0) {
    insights.push(`Best performing colors: ${topColors.map(c => `${c.color} (${c.avg.toFixed(1)})`).join(', ')}`);
  }

  return insights;
}
```

Update `analyzeOutfit()` to call `getStyleInsights()` instead of `getUserFeedbackHistory()`, and pass results via `buildUserPrompt()`.

---

## Layer 3: AI Calibration Loop

### Why This Matters
This is how you PROVE the AI gets better. Compare AI score vs crowd consensus. Track the delta. Shrink it over time. This is a measurable quality metric acquirers care about.

### Schema Changes (`prisma/schema.prisma`)

Add cached community scores to OutfitCheck (avoids expensive aggregation queries):
```prisma
// Add to OutfitCheck model:
communityAvgScore   Float? @map("community_avg_score")
communityScoreCount Int    @default(0) @map("community_score_count")
```

Add calibration snapshot table:
```prisma
model CalibrationSnapshot {
  id           String   @id @default(uuid())
  period       String   // "2026-02-W07", "2026-02"
  sampleSize   Int      @map("sample_size")
  avgAiScore   Float    @map("avg_ai_score")
  avgCommunity Float    @map("avg_community_score")
  delta        Float    // avgAiScore - avgCommunity (positive = AI scores higher)
  correlation  Float?   // Pearson correlation coefficient
  createdAt    DateTime @default(now()) @map("created_at")

  @@unique([period])
  @@map("calibration_snapshots")
}
```

### Update Community Feedback (`social.controller.ts`)

In `submitCommunityFeedback()`, after the existing upsert, recalculate the cached score:

```typescript
// After community feedback upsert, update cached avg
const agg = await prisma.communityFeedback.aggregate({
  where: { outfitId },
  _avg: { score: true },
  _count: { score: true },
});
await prisma.outfitCheck.update({
  where: { id: outfitId },
  data: {
    communityAvgScore: agg._avg.score,
    communityScoreCount: agg._count.score,
  },
});
```

### Feed Calibration Into AI Prompt (`ai-feedback.service.ts`)

Add to `buildUserPrompt()`, after the feedback history section:

```typescript
// Get calibration data for the AI
const calibration = await getCalibrationContext();
if (calibration) {
  parts.push('', `Calibration note: ${calibration}`);
}
```

```typescript
async function getCalibrationContext(): Promise<string | null> {
  // Find outfits with both AI and community scores
  const calibrationData = await prisma.outfitCheck.findMany({
    where: {
      aiScore: { not: null },
      communityScoreCount: { gte: 3 }, // At least 3 community votes
    },
    select: { aiScore: true, communityAvgScore: true },
    take: 100,
    orderBy: { createdAt: 'desc' },
  });

  if (calibrationData.length < 10) return null;

  const avgDelta = calibrationData.reduce((sum, d) => {
    return sum + ((d.aiScore || 0) - (d.communityAvgScore || 0));
  }, 0) / calibrationData.length;

  if (Math.abs(avgDelta) > 0.3) {
    const direction = avgDelta > 0 ? 'higher' : 'lower';
    return `Your scores tend to run ${Math.abs(avgDelta).toFixed(1)} points ${direction} than community consensus. Adjust slightly toward crowd perception.`;
  }
  return null;
}
```

### New Endpoint: Calibration Metrics (`outfit.controller.ts`)

```typescript
// GET /api/outfits/calibration (admin/internal)
export async function getCalibrationMetrics(req: AuthenticatedRequest, res: Response) {
  const snapshots = await prisma.calibrationSnapshot.findMany({
    orderBy: { createdAt: 'desc' },
    take: 12,
  });
  res.json({ snapshots });
}
```

---

## New Endpoints Summary

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/user/style-profile` | Get user's aggregated Style DNA (top colors, archetypes, scores) |
| GET | `/api/user/style-evolution` | Style DNA trends over time (weekly averages) |

These will be added to `user.controller.ts` and `user.routes.ts`.

---

## Files Modified (Summary)

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add `StyleDNA` model, `CalibrationSnapshot` model, 2 fields on `OutfitCheck`, relation on `OutfitCheck` |
| `src/types/index.ts` | Add `StyleDNAExtraction` interface, extend `OutfitFeedback` with `styleDNA` |
| `src/services/ai-feedback.service.ts` | Add `styleDNA` to SYSTEM_PROMPT response format + extraction instructions, add to `responseSchema`, save StyleDNA after analysis, replace `getUserFeedbackHistory()` with `getStyleInsights()`, add `getCalibrationContext()` |
| `src/controllers/outfit.controller.ts` | Include styleDNA in `getOutfitFeedback` response |
| `src/controllers/social.controller.ts` | Update `communityAvgScore`/`communityScoreCount` after community feedback |
| `src/controllers/user.controller.ts` | Add `getStyleProfile` and `getStyleEvolution` endpoints |
| `src/routes/user.routes.ts` | Add new routes |

---

## Implementation Order

1. **Schema changes** - Add models, run `prisma db push`
2. **Types** - Add `StyleDNAExtraction` interface
3. **AI prompt + schema** - Extend SYSTEM_PROMPT and Gemini responseSchema to extract Style DNA
4. **Save Style DNA** - After analysis, write to StyleDNA table
5. **Cross-outfit intelligence** - Replace `getUserFeedbackHistory()` with `getStyleInsights()`
6. **Calibration loop** - Update community feedback to cache scores, add calibration context to prompts
7. **New endpoints** - Style profile and evolution

---

## Verification

1. Submit an outfit → check DB for new `StyleDNA` record with colors, garments, scores
2. Submit 3+ outfits → verify `getStyleInsights()` returns meaningful patterns
3. View community feedback on an outfit → check `communityAvgScore` updates on OutfitCheck
4. After 10+ outfits with community scores → verify calibration context appears in AI prompt
5. AI feedback now includes `styleDNA` field in the JSON response
6. Follow-up questions can reference Style DNA ("What colors go best with my wardrobe?")

## What This Enables (Future)

Once these 3 layers are running, the NEXT level becomes possible:
- **Trend Detection API** - Aggregate StyleDNA across all users: "Navy + earth tones up 35% this month"
- **Collaborative Filtering** - "Users with similar Style DNA also scored well with..."
- **Style Tribes** - Cluster users by archetype patterns
- **Wardrobe Graph** - Track individual garments across outfits
- **B2B Fashion Intelligence API** - Sell trend data to brands/retailers
