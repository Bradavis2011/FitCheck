/**
 * Training Data Generation Script
 *
 * Generate diverse outfit scenarios for testing and training.
 * Creates synthetic data covering various occasions, styles, and edge cases.
 *
 * Usage: npm run generate:training-data
 */

import fs from 'fs';
import path from 'path';

interface TrainingScenario {
  id: string;
  occasion: string;
  difficulty: 'easy' | 'medium' | 'hard';
  outfitDescription: string;
  context: {
    occasion: string;
    weather?: string;
    setting?: string;
    vibe?: string;
    concerns?: string[];
  };
  expectedScoreRange: { min: number; max: number };
  notes: string;
}

const TRAINING_SCENARIOS: TrainingScenario[] = [
  // EASY scenarios (9-10 range)
  {
    id: 'wedding-guest-perfect',
    occasion: 'wedding guest',
    difficulty: 'easy',
    outfitDescription: 'Floral midi dress, nude heels, simple jewelry, small clutch',
    context: {
      occasion: 'afternoon wedding',
      weather: 'warm summer day',
      setting: 'outdoor garden venue',
      vibe: 'elegant, romantic',
    },
    expectedScoreRange: { min: 8.5, max: 10 },
    notes: 'Perfect wedding guest attire—should score very high',
  },
  {
    id: 'date-night-classic',
    occasion: 'date night',
    difficulty: 'easy',
    outfitDescription: 'Little black dress, heels, statement earrings',
    context: {
      occasion: 'dinner date',
      setting: 'nice restaurant',
      vibe: 'confident, sophisticated',
    },
    expectedScoreRange: { min: 8.0, max: 9.5 },
    notes: 'Classic LBD—timeless and elegant',
  },

  // MEDIUM scenarios (6-8 range)
  {
    id: 'casual-friday-creative',
    occasion: 'casual Friday',
    difficulty: 'medium',
    outfitDescription: 'Dark jeans, blazer, white t-shirt, loafers',
    context: {
      occasion: 'work (casual Friday)',
      setting: 'creative office',
      vibe: 'professional but relaxed',
    },
    expectedScoreRange: { min: 6.5, max: 8.0 },
    notes: 'Good foundation but could be elevated',
  },
  {
    id: 'brunch-athleisure',
    occasion: 'weekend brunch',
    difficulty: 'medium',
    outfitDescription: 'Leggings, oversized sweater, white sneakers',
    context: {
      occasion: 'brunch with friends',
      weather: 'cool morning',
      vibe: 'casual, comfortable',
    },
    expectedScoreRange: { min: 6.0, max: 7.5 },
    notes: 'Comfortable but could use style upgrades',
  },

  // HARD scenarios (needs significant work)
  {
    id: 'business-meeting-too-casual',
    occasion: 'client presentation',
    difficulty: 'hard',
    outfitDescription: 'Jeans, graphic t-shirt, sneakers, backpack',
    context: {
      occasion: 'important client presentation',
      setting: 'corporate office',
      vibe: 'professional, authoritative',
      concerns: ['being taken seriously'],
    },
    expectedScoreRange: { min: 3.0, max: 5.0 },
    notes: 'Too casual for corporate setting—needs significant changes',
  },
  {
    id: 'cocktail-party-underdressed',
    occasion: 'cocktail party',
    difficulty: 'hard',
    outfitDescription: 'Casual sundress, flat sandals, denim jacket',
    context: {
      occasion: 'evening cocktail party',
      setting: 'upscale venue',
      vibe: 'chic, sophisticated',
    },
    expectedScoreRange: { min: 4.0, max: 6.0 },
    notes: 'Too casual for cocktail party—needs formality upgrade',
  },

  // EDGE CASES
  {
    id: 'pattern-mixing-advanced',
    occasion: 'creative work event',
    difficulty: 'medium',
    outfitDescription: 'Striped blouse, floral skirt, leopard print heels',
    context: {
      occasion: 'creative industry networking event',
      vibe: 'bold, artistic, fashion-forward',
    },
    expectedScoreRange: { min: 5.0, max: 8.0 },
    notes: 'Pattern mixing—could be great or overwhelming depending on execution',
  },
  {
    id: 'monochrome-minimalist',
    occasion: 'art gallery opening',
    difficulty: 'medium',
    outfitDescription: 'All black outfit: turtleneck, wide-leg pants, ankle boots',
    context: {
      occasion: 'art gallery opening',
      vibe: 'minimalist, sophisticated, artistic',
    },
    expectedScoreRange: { min: 7.0, max: 9.0 },
    notes: 'Monochrome minimalist—should score well for right occasion',
  },
  {
    id: 'cultural-traditional',
    occasion: 'cultural celebration',
    difficulty: 'easy',
    outfitDescription: 'Traditional embroidered dress, cultural jewelry',
    context: {
      occasion: 'cultural festival',
      vibe: 'celebrating heritage',
    },
    expectedScoreRange: { min: 8.0, max: 10 },
    notes: 'Traditional attire—should celebrate cultural expression',
  },
  {
    id: 'gender-neutral-suit',
    occasion: 'job interview',
    difficulty: 'easy',
    outfitDescription: 'Tailored pantsuit, button-down, oxford shoes',
    context: {
      occasion: 'corporate job interview',
      vibe: 'professional, polished',
    },
    expectedScoreRange: { min: 8.5, max: 10 },
    notes: 'Gender-neutral professional attire—should score highly',
  },
  {
    id: 'plus-size-bodycon',
    occasion: 'night out',
    difficulty: 'medium',
    outfitDescription: 'Bodycon dress, heels, statement necklace',
    context: {
      occasion: 'night out with friends',
      vibe: 'confident, sexy, fun',
    },
    expectedScoreRange: { min: 7.0, max: 9.0 },
    notes: 'Bodycon dress—focus on fit and confidence, not body type',
  },
  {
    id: 'winter-layering',
    occasion: 'winter errands',
    difficulty: 'medium',
    outfitDescription: 'Jeans, sweater, puffer coat, boots, scarf, beanie',
    context: {
      occasion: 'running errands',
      weather: 'cold winter day',
      vibe: 'warm, practical, put-together',
    },
    expectedScoreRange: { min: 6.5, max: 8.5 },
    notes: 'Winter layering—balance warmth and style',
  },
];

function generateTrainingDataFile() {
  const outputDir = path.join(process.cwd(), 'src', 'data');
  const outputFile = path.join(outputDir, 'training-scenarios.json');

  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write scenarios to JSON file
  fs.writeFileSync(
    outputFile,
    JSON.stringify(TRAINING_SCENARIOS, null, 2),
    'utf-8'
  );

  console.log(`✅ Generated ${TRAINING_SCENARIOS.length} training scenarios`);
  console.log(`📁 Saved to: ${outputFile}\n`);

  // Print summary
  const byDifficulty = {
    easy: TRAINING_SCENARIOS.filter(s => s.difficulty === 'easy').length,
    medium: TRAINING_SCENARIOS.filter(s => s.difficulty === 'medium').length,
    hard: TRAINING_SCENARIOS.filter(s => s.difficulty === 'hard').length,
  };

  console.log('📊 Breakdown:');
  console.log(`  Easy (8-10 range): ${byDifficulty.easy}`);
  console.log(`  Medium (6-8 range): ${byDifficulty.medium}`);
  console.log(`  Hard (3-6 range): ${byDifficulty.hard}\n`);

  const byOccasion = TRAINING_SCENARIOS.reduce((acc, scenario) => {
    acc[scenario.occasion] = (acc[scenario.occasion] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('📅 By Occasion:');
  Object.entries(byOccasion)
    .sort((a, b) => b[1] - a[1])
    .forEach(([occasion, count]) => {
      console.log(`  ${occasion}: ${count}`);
    });
}

// Print recommendations for next steps
function printRecommendations() {
  console.log('\n═══════════════════════════════════════════════');
  console.log('   Next Steps for Training Data');
  console.log('═══════════════════════════════════════════════\n');

  console.log('1. 📸 Collect Real Images');
  console.log('   - Use free stock photos from Unsplash, Pexels');
  console.log('   - Search for: "woman dress", "man suit", "casual outfit", etc.');
  console.log('   - Aim for diverse body types, ethnicities, styles\n');

  console.log('2. ✍️  Manually Curate Feedback');
  console.log('   - For each scenario, write exemplary Or This? feedback');
  console.log('   - Follow brand voice guidelines strictly');
  console.log('   - This becomes your "ground truth" for testing\n');

  console.log('3. 🧪 Test Against AI');
  console.log('   - Run scenarios through your AI model');
  console.log('   - Compare AI scores to your manual scores');
  console.log('   - Iterate on prompts to improve accuracy\n');

  console.log('4. 📈 Expand Dataset');
  console.log('   - Add more edge cases as you discover them');
  console.log('   - Include user-reported issues');
  console.log('   - Continuously improve with real user data\n');
}

function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('   Or This? Training Data Generator');
  console.log('═══════════════════════════════════════════════\n');

  generateTrainingDataFile();
  printRecommendations();

  console.log('✅ Complete!\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { TRAINING_SCENARIOS };
