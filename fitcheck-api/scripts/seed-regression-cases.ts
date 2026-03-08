/**
 * Seed script: seeds 20 regression test cases into the RegressionCase table.
 * Run once: npx tsx fitcheck-api/scripts/seed-regression-cases.ts
 *
 * Covers 4 occasions × 5 contexts = 20 diverse scenarios.
 * baselineScores are set at neutral 7/10 initially; calibrateRegressionBaselines()
 * will update them with real prompt scores on Sunday midnight UTC.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface RegressionCase {
  scenarioName: string;
  contextSnapshot: {
    occasion: string;
    setting?: string;
    weather?: string;
    vibe?: string;
    outfit?: string;
  };
  baselineScores: {
    specificity: number;
    voiceConsistency: number;
    actionability: number;
    styleAlignment: number;
    occasionFit: number;
  };
}

const REGRESSION_CASES: RegressionCase[] = [
  // ── Occasion 1: Job Interview ─────────────────────────────────────────────
  {
    scenarioName: 'job-interview-tech-startup',
    contextSnapshot: {
      occasion: 'job interview tech startup',
      setting: 'office',
      vibe: 'professional',
      outfit: 'Navy chinos, white oxford shirt, brown leather belt, brown suede loafers',
    },
    baselineScores: { specificity: 7, voiceConsistency: 7, actionability: 7, styleAlignment: 7, occasionFit: 7 },
  },
  {
    scenarioName: 'job-interview-finance-formal',
    contextSnapshot: {
      occasion: 'job interview corporate finance',
      setting: 'downtown office',
      weather: 'cold',
      vibe: 'polished',
      outfit: 'Charcoal suit, white dress shirt, burgundy tie, black Oxford shoes',
    },
    baselineScores: { specificity: 7, voiceConsistency: 7, actionability: 7, styleAlignment: 7, occasionFit: 7 },
  },
  {
    scenarioName: 'job-interview-creative-agency',
    contextSnapshot: {
      occasion: 'job interview creative agency',
      setting: 'open plan office',
      vibe: 'creative confident',
      outfit: 'Wide-leg black trousers, chunky turtleneck, white sneakers, structured tote',
    },
    baselineScores: { specificity: 7, voiceConsistency: 7, actionability: 7, styleAlignment: 7, occasionFit: 7 },
  },
  {
    scenarioName: 'job-interview-casual-remote',
    contextSnapshot: {
      occasion: 'video interview remote tech company',
      setting: 'home office',
      vibe: 'smart casual',
      outfit: 'Dark wash jeans, navy blazer, white t-shirt, minimal jewelry',
    },
    baselineScores: { specificity: 7, voiceConsistency: 7, actionability: 7, styleAlignment: 7, occasionFit: 7 },
  },
  {
    scenarioName: 'job-interview-retail-management',
    contextSnapshot: {
      occasion: 'job interview retail store manager',
      setting: 'retail environment',
      vibe: 'approachable professional',
      outfit: 'Black slim trousers, patterned blouse, pointed-toe flats, structured handbag',
    },
    baselineScores: { specificity: 7, voiceConsistency: 7, actionability: 7, styleAlignment: 7, occasionFit: 7 },
  },

  // ── Occasion 2: Date Night ────────────────────────────────────────────────
  {
    scenarioName: 'date-night-first-date-restaurant',
    contextSnapshot: {
      occasion: 'first date nice restaurant',
      setting: 'upscale casual restaurant',
      weather: 'mild',
      vibe: 'effortless chic',
      outfit: 'Midi slip dress, leather jacket, heeled boots, gold hoops',
    },
    baselineScores: { specificity: 7, voiceConsistency: 7, actionability: 7, styleAlignment: 7, occasionFit: 7 },
  },
  {
    scenarioName: 'date-night-casual-bowling',
    contextSnapshot: {
      occasion: 'date night bowling alley',
      setting: 'bowling alley',
      vibe: 'fun playful',
      outfit: 'High-waisted mom jeans, ribbed crop top, chunky sneakers, baseball cap',
    },
    baselineScores: { specificity: 7, voiceConsistency: 7, actionability: 7, styleAlignment: 7, occasionFit: 7 },
  },
  {
    scenarioName: 'date-night-rooftop-bar',
    contextSnapshot: {
      occasion: 'date rooftop bar summer',
      setting: 'rooftop bar',
      weather: 'hot',
      vibe: 'elevated casual',
      outfit: 'Linen trousers, fitted tank, strappy sandals, minimal gold jewelry',
    },
    baselineScores: { specificity: 7, voiceConsistency: 7, actionability: 7, styleAlignment: 7, occasionFit: 7 },
  },
  {
    scenarioName: 'date-night-theatre',
    contextSnapshot: {
      occasion: 'date night theatre performance',
      setting: 'theatre',
      vibe: 'dressed up elegant',
      outfit: 'Velvet blazer, wide-leg trousers, silk cami, block heels',
    },
    baselineScores: { specificity: 7, voiceConsistency: 7, actionability: 7, styleAlignment: 7, occasionFit: 7 },
  },
  {
    scenarioName: 'date-night-winter-cozy',
    contextSnapshot: {
      occasion: 'date night winter cozy',
      setting: 'cozy wine bar',
      weather: 'cold',
      vibe: 'romantic cozy',
      outfit: 'Camel wool coat, burgundy knit dress, knee-high boots, simple pendant necklace',
    },
    baselineScores: { specificity: 7, voiceConsistency: 7, actionability: 7, styleAlignment: 7, occasionFit: 7 },
  },

  // ── Occasion 3: Wedding Guest ─────────────────────────────────────────────
  {
    scenarioName: 'wedding-guest-garden-summer',
    contextSnapshot: {
      occasion: 'wedding guest garden ceremony summer',
      setting: 'outdoor garden venue',
      weather: 'warm sunny',
      vibe: 'romantic feminine',
      outfit: 'Floral midi dress, espadrille wedges, straw clutch, dainty jewelry',
    },
    baselineScores: { specificity: 7, voiceConsistency: 7, actionability: 7, styleAlignment: 7, occasionFit: 7 },
  },
  {
    scenarioName: 'wedding-guest-black-tie',
    contextSnapshot: {
      occasion: 'black tie wedding guest',
      setting: 'grand ballroom',
      vibe: 'glamorous formal',
      outfit: 'Floor-length navy gown, strappy heels, crystal earrings, small clutch',
    },
    baselineScores: { specificity: 7, voiceConsistency: 7, actionability: 7, styleAlignment: 7, occasionFit: 7 },
  },
  {
    scenarioName: 'wedding-guest-beach-destination',
    contextSnapshot: {
      occasion: 'beach destination wedding guest',
      setting: 'beach ceremony',
      weather: 'hot humid',
      vibe: 'breezy elegant',
      outfit: 'Flowing maxi dress, flat sandals, shell jewelry, linen shawl',
    },
    baselineScores: { specificity: 7, voiceConsistency: 7, actionability: 7, styleAlignment: 7, occasionFit: 7 },
  },
  {
    scenarioName: 'wedding-guest-autumn-rustic',
    contextSnapshot: {
      occasion: 'autumn rustic barn wedding guest',
      setting: 'barn venue',
      weather: 'cool crisp',
      vibe: 'earthy romantic',
      outfit: 'Rust midi skirt, cream blouse, ankle boots, structured jacket, simple earrings',
    },
    baselineScores: { specificity: 7, voiceConsistency: 7, actionability: 7, styleAlignment: 7, occasionFit: 7 },
  },
  {
    scenarioName: 'wedding-guest-male-semiformal',
    contextSnapshot: {
      occasion: 'semi-formal wedding guest male',
      setting: 'hotel ballroom',
      vibe: 'polished refined',
      outfit: 'Light grey suit, white dress shirt, no tie, pocket square, oxford shoes',
    },
    baselineScores: { specificity: 7, voiceConsistency: 7, actionability: 7, styleAlignment: 7, occasionFit: 7 },
  },

  // ── Occasion 4: Casual Everyday ───────────────────────────────────────────
  {
    scenarioName: 'casual-weekend-brunch',
    contextSnapshot: {
      occasion: 'weekend brunch with friends',
      setting: 'cafe',
      weather: 'mild',
      vibe: 'relaxed put-together',
      outfit: 'Light wash jeans, white tee, oversized blazer, white sneakers',
    },
    baselineScores: { specificity: 7, voiceConsistency: 7, actionability: 7, styleAlignment: 7, occasionFit: 7 },
  },
  {
    scenarioName: 'casual-grocery-errands',
    contextSnapshot: {
      occasion: 'running errands grocery shopping',
      setting: 'everyday',
      vibe: 'comfortable casual',
      outfit: 'Jogger pants, oversized hoodie, clean white sneakers, baseball cap',
    },
    baselineScores: { specificity: 7, voiceConsistency: 7, actionability: 7, styleAlignment: 7, occasionFit: 7 },
  },
  {
    scenarioName: 'casual-gym-activewear',
    contextSnapshot: {
      occasion: 'gym workout',
      setting: 'gym',
      vibe: 'athletic functional',
      outfit: 'Black leggings, sports bra, oversized gym tee, running shoes',
    },
    baselineScores: { specificity: 7, voiceConsistency: 7, actionability: 7, styleAlignment: 7, occasionFit: 7 },
  },
  {
    scenarioName: 'casual-art-museum-weekend',
    contextSnapshot: {
      occasion: 'art museum weekend visit',
      setting: 'art gallery',
      vibe: 'artistic intellectual',
      outfit: 'Wide-leg trousers, graphic tee, loafers, structured crossbody bag',
    },
    baselineScores: { specificity: 7, voiceConsistency: 7, actionability: 7, styleAlignment: 7, occasionFit: 7 },
  },
  {
    scenarioName: 'casual-airport-travel',
    contextSnapshot: {
      occasion: 'airport travel long flight',
      setting: 'airport',
      weather: 'varies',
      vibe: 'comfortable stylish',
      outfit: 'Matching tracksuit set, oversized coat, slip-on sneakers, baseball cap',
    },
    baselineScores: { specificity: 7, voiceConsistency: 7, actionability: 7, styleAlignment: 7, occasionFit: 7 },
  },
];

async function main() {
  console.log('Seeding regression cases...');

  let created = 0;
  let skipped = 0;

  for (const rc of REGRESSION_CASES) {
    const existing = await prisma.regressionCase.findFirst({
      where: { scenarioName: rc.scenarioName },
    });

    if (existing) {
      console.log(`  SKIP (exists): ${rc.scenarioName}`);
      skipped++;
      continue;
    }

    await prisma.regressionCase.create({
      data: {
        scenarioName: rc.scenarioName,
        contextSnapshot: rc.contextSnapshot as any,
        baselineScores: rc.baselineScores as any,
        isActive: true,
      },
    });

    console.log(`  CREATED: ${rc.scenarioName}`);
    created++;
  }

  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
  console.log('Run calibrateRegressionBaselines() to update baseline scores with real prompt performance.');
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
