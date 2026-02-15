# AI Training Pipeline — `npm run train:ai`

## Overview

A fully automated, one-command pipeline that fetches real fashion images, tests the production AI against them, evaluates quality, detects weaknesses, self-optimizes prompts, and generates a comprehensive report. Runs end-to-end without manual intervention.

## Quick Start

```bash
# From fitcheck-api directory
npm run train:ai
```

That's it! The pipeline will run all 7 stages automatically.

## Architecture

```
npm run train:ai
    │
    ├─ Stage 1: ACQUIRE — Fetch images from Getty/Unsplash/Pexels APIs
    ├─ Stage 2: CATEGORIZE — Use Gemini to auto-tag occasion/setting/vibe
    ├─ Stage 3: TEST — Run each image through production AI prompt
    ├─ Stage 4: EVALUATE — Score brand voice, specificity, actionability
    ├─ Stage 5: ANALYZE — Detect weakness patterns across all results
    ├─ Stage 6: OPTIMIZE — Meta-prompt Gemini to improve its own prompt
    └─ Stage 7: REPORT — Generate results summary + before/after comparison
```

## Configuration

### Required Environment Variables

```env
# Required
GEMINI_API_KEY=your-gemini-api-key

# Optional (graceful degradation if missing)
GETTY_API_KEY=your-getty-api-key
UNSPLASH_ACCESS_KEY=your-unsplash-access-key
PEXELS_API_KEY=your-pexels-api-key
```

### Config File

Edit `scripts/train/config.ts` to adjust:

- `imagesPerSource` — How many images to fetch per source (default: 10)
- `geminiRateLimitRPM` — Gemini free tier rate limit (default: 15)
- `consistencyRuns` — How many times to run each image (default: 2)
- Quality thresholds for brand voice, specificity, actionability
- `enableOptimization` — Enable/disable prompt optimization (default: true)
- `optimizationSampleSize` — How many weak images to re-test (default: 5)

## Pipeline Stages

### Stage 1: ACQUIRE

Fetches fashion images from:
- **Getty Images** — Red carpet, fashion week, celebrity events
- **Unsplash** — High-quality outfit photos
- **Pexels** — Free fashion photos

**Fallback:** If no API keys are configured, generates synthetic text-based test scenarios.

**Output:** `data/images/{run-id}/manifest.json` + base64 image files

### Stage 2: CATEGORIZE

Uses Gemini to analyze each image and auto-generate:
- `occasion` — date night, work, casual, formal, etc.
- `setting` — restaurant, office, outdoor, party, etc.
- `weather` — warm, cold, mild, rainy
- `vibe` — casual, elegant, edgy, romantic, etc.
- `outfitDescription` — Detailed text description
- `difficultyEstimate` — easy/medium/hard

**Why?** Creates realistic `OutfitCheckInput` context matching production usage.

**Output:** `data/categorized/{run-id}/*.json`

### Stage 3: TEST

- Imports the production `SYSTEM_PROMPT` and `responseSchema` from `ai-feedback.service.ts`
- Sends each image + auto-generated context to Gemini (same as production)
- Runs each image **2x** to measure consistency
- Records: response, latency, token usage, errors

**Key:** Tests the REAL production prompt, not a separate test prompt.

**Output:** `data/results/{run-id}/*.json`

### Stage 4: EVALUATE

For each AI response, computes:

1. **Brand Voice Score (0-100)** — Uses `brand-voice-validator.ts`
2. **Specificity Score (0-100)** — Fashion terms, color references, concrete details
3. **Actionability Score (0-100)** — Are quick fixes actually actionable?
4. **Consistency Score** — Variance between 2 runs (target: < 0.5 points)
5. **Schema Compliance** — Does response match `OutfitFeedback` interface?

**Output:** `data/evaluations/{run-id}/*.json` + `aggregate-stats.json`

### Stage 5: ANALYZE

Aggregates scores and identifies patterns:

- Lowest-scoring categories (occasions/settings)
- Common brand voice violations
- Consistency outliers
- Specificity gaps
- Score calibration issues

**Output:** `data/evaluations/{run-id}/weakness-analysis.json`

### Stage 6: OPTIMIZE

**The key innovation.** Uses Gemini as a meta-optimizer:

1. Takes current `SYSTEM_PROMPT` + weakness analysis
2. Sends to Gemini with meta-prompt: "Given these weaknesses, produce an improved prompt"
3. Receives optimized prompt
4. Re-runs weak images with new prompt
5. Compares before/after scores

**Safety:** Never auto-deploys. Saves candidate prompt for human review.

**Output:** `data/results/{run-id}/optimized-prompt.txt` + `optimization-result.json`

### Stage 7: REPORT

Generates comprehensive report:

```
═══════════════════════════════════════════
   Or This? AI Training Report
   Run: 2026-02-15T14:30:00Z
═══════════════════════════════════════════

IMAGES TESTED: 35
  - Getty: 12
  - Unsplash: 13
  - Pexels: 10

QUALITY SCORES (averages):
  Brand Voice:    92/100  ⚠️
  Specificity:    88/100  ⚠️
  Actionability:  91/100  ✅
  Consistency:    0.3 var ✅
  Schema:         100%    ✅

TOP WEAKNESSES:
  1. [HIGH] Brand voice dips on formal/work outfits
  2. [MEDIUM] Specificity low for accessories

OPTIMIZATION RESULTS:
  Candidate prompt generated: YES
  Average improvement: +5.0 points
  Success: YES ✅

RECOMMENDATIONS:
  1. Review and deploy optimized prompt
  2. Add more formal-wear examples
═══════════════════════════════════════════
```

**Output:** `data/reports/{run-id}/report.json` + `report.txt`

## File Structure

```
scripts/train/
├── index.ts              — Entry point, orchestrates stages
├── config.ts             — Configuration, API keys, thresholds
├── types.ts              — TypeScript types
├── README.md             — This file
├── utils/
│   ├── logger.ts         — Colored console + file logging
│   ├── rate-limiter.ts   — Gemini API rate limiting (15 RPM)
│   └── checkpoint.ts     — Save/resume progress
├── stages/
│   ├── 1-acquire.ts      — Image fetching
│   ├── 2-categorize.ts   — Auto-categorization
│   ├── 3-test.ts         — Production AI testing
│   ├── 4-evaluate.ts     — Quality scoring
│   ├── 5-analyze.ts      — Weakness detection
│   ├── 6-optimize.ts     — Prompt optimization
│   └── 7-report.ts       — Report generation
└── data/                 — Runtime data (gitignored)
    ├── images/
    ├── categorized/
    ├── results/
    ├── evaluations/
    ├── reports/
    ├── logs/
    └── checkpoints/
```

## Resumability

The pipeline automatically saves checkpoints after each stage. If it fails:

```bash
# Just re-run the same command
npm run train:ai

# It will resume from the last completed stage
```

To start fresh:

```bash
# Delete checkpoints for the run
rm -rf scripts/train/data/checkpoints/run-*
```

## Interpreting Results

### Quality Thresholds

| Metric | Target | Meaning |
|--------|--------|---------|
| Brand Voice | ≥95 | Warm, decisive, supportive tone |
| Specificity | ≥90 | Uses fashion terms, concrete colors |
| Actionability | ≥85 | Quick fixes are concrete |
| Consistency | <0.5 | Same input → similar output |
| Schema | 100% | Valid JSON structure |

### Weakness Severity

- **HIGH** — Affects >30% of responses, requires immediate fix
- **MEDIUM** — Affects 10-30%, should be addressed
- **LOW** — Minor issue, optional improvement

### Optimization Success

Optimized prompt is considered successful if:
- Average improvement >2 points across test images
- No regression on well-performing images
- Maintains brand voice compliance

**Next steps after successful optimization:**
1. Review `data/results/{run-id}/optimized-prompt.txt`
2. Test manually on a few images
3. Update `src/services/ai-feedback.service.ts` with new prompt
4. Run pipeline again to verify improvements

## Troubleshooting

### No images fetched

**Cause:** No image API keys configured

**Solution:** Add at least one of:
- `UNSPLASH_ACCESS_KEY` (easiest to get)
- `PEXELS_API_KEY`
- `GETTY_API_KEY`

**Fallback:** Pipeline will use synthetic text scenarios

### Rate limit errors

**Cause:** Gemini free tier = 15 RPM

**Solution:** Reduce `imagesPerSource` in `config.ts` or add delays

### Schema validation errors

**Cause:** Gemini response doesn't match expected format

**Solution:** Check `data/results/{run-id}/*.json` for malformed responses

## Cost Estimation

### Gemini API (Free Tier)
- 15 requests/minute
- ~1500 requests/day
- This pipeline uses ~40-60 requests per run (10 images × 2 runs + categorization + optimization)
- **Cost:** FREE (within free tier limits)

### Image APIs
- **Unsplash:** Free (5000 requests/hour)
- **Pexels:** Free (200 requests/hour)
- **Getty:** Paid (requires subscription)

**Recommended:** Start with Unsplash + Pexels (both free)

## Advanced Usage

### Custom Image Queries

Edit `config.ts` to add custom search queries:

```typescript
export const IMAGE_QUERIES = {
  unsplash: [
    'minimalist outfit',
    'maximalist fashion',
    // ... your queries
  ],
};
```

### Disable Optimization

If you only want evaluation (no prompt changes):

```typescript
// config.ts
export const config = {
  // ...
  enableOptimization: false,
};
```

### Test Specific Occasions

Filter images by occasion in the categorize stage to focus on specific scenarios.

## Contributing

To add a new image source:

1. Add API client to `stages/1-acquire.ts`
2. Update `config.ts` with API key and queries
3. Update `types.ts` to add source to `ImageSource['source']`

To add a new quality metric:

1. Add scoring logic to `stages/4-evaluate.ts`
2. Update `QualityScores` type in `types.ts`
3. Update report generation in `stages/7-report.ts`

## License

Internal tool for Or This? project.
