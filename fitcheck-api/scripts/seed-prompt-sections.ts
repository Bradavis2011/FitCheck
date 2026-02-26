/**
 * Seed script: splits the hardcoded SYSTEM_PROMPT into 13 PromptSection rows.
 * Run once: npx tsx fitcheck-api/scripts/seed-prompt-sections.ts
 */

import { PrismaClient } from '@prisma/client';
import { SYSTEM_PROMPT } from '../src/services/ai-feedback.service.js';

const prisma = new PrismaClient();

// Define the 13 sections with their boundary markers (text that starts each section)
const SECTIONS: Array<{
  key: string;
  startMarker: string;
  endMarker: string;
  orderIndex: number;
}> = [
  {
    key: 'voice_persona',
    startMarker: 'You are the AI fashion editor',
    endMarker: 'VOICE EXAMPLES:',
    orderIndex: 0,
  },
  {
    key: 'voice_examples',
    startMarker: 'VOICE EXAMPLES:',
    endMarker: '═══════════════════════════════════════════════════════════════════\nFASHION KNOWLEDGE BASE',
    orderIndex: 1,
  },
  {
    key: 'color_theory',
    startMarker: 'COLOR THEORY:',
    endMarker: 'PROPORTIONS & SILHOUETTE:',
    orderIndex: 2,
  },
  {
    key: 'proportions_silhouette',
    startMarker: 'PROPORTIONS & SILHOUETTE:',
    endMarker: 'FIT PRINCIPLES:',
    orderIndex: 3,
  },
  {
    key: 'fit_principles',
    startMarker: 'FIT PRINCIPLES:',
    endMarker: 'BODY BALANCE',
    orderIndex: 4,
  },
  {
    key: 'body_balance',
    startMarker: 'BODY BALANCE',
    endMarker: 'OCCASION DRESS CODES:',
    orderIndex: 5,
  },
  {
    key: 'occasion_dress_codes',
    startMarker: 'OCCASION DRESS CODES:',
    endMarker: 'STYLE COHERENCE:',
    orderIndex: 6,
  },
  {
    key: 'style_coherence',
    startMarker: 'STYLE COHERENCE:',
    endMarker: 'STYLE-ALIGNED ADVICE',
    orderIndex: 7,
  },
  {
    key: 'style_lanes',
    startMarker: 'STYLE-ALIGNED ADVICE',
    endMarker: 'STYLING MOVES',
    orderIndex: 8,
  },
  {
    key: 'styling_moves',
    startMarker: 'STYLING MOVES',
    endMarker: 'SEASONAL & PRACTICAL:',
    orderIndex: 9,
  },
  {
    key: 'seasonal_practical',
    startMarker: 'SEASONAL & PRACTICAL:',
    endMarker: '═══════════════════════════════════════════════════════════════════\nEXAMPLE ANALYSES',
    orderIndex: 10,
  },
  {
    key: 'examples',
    startMarker: '═══════════════════════════════════════════════════════════════════\nEXAMPLE ANALYSES',
    endMarker: 'ANALYSIS APPROACH:',
    orderIndex: 11,
  },
  {
    key: 'analysis_scoring',
    startMarker: 'ANALYSIS APPROACH:',
    endMarker: '', // Last section — goes to end
    orderIndex: 12,
  },
];

// Follow-up prompt sections (hardcoded since they're small)
const FOLLOWUP_SECTIONS = [
  {
    key: 'followup_persona',
    content: `You are the AI fashion editor at Or This? continuing a conversation about a specific outfit.
You already provided initial feedback. Now answer the user's follow-up question with the same editorial voice.
- Confident and decisive. No hedging.
- Reference the specific outfit and your previous feedback where relevant.
- Stay in the style lane of the outfit being discussed.`,
    orderIndex: 13,
  },
  {
    key: 'followup_context_rules',
    content: `FOLLOW-UP CONTEXT RULES:
- You have the outfit image context and your previous feedback.
- Build on what was already said — don't repeat your full analysis.
- If the user asks "what about X?", answer only X, specifically.
- If the user disagrees with your feedback, engage thoughtfully but don't capitulate without reason.
- Keep responses focused: 2-4 sentences unless the question requires more.`,
    orderIndex: 14,
  },
  {
    key: 'followup_response_format',
    content: `RESPONSE FORMAT:
Return plain conversational text (not JSON).
- Short, direct answers to the specific question asked.
- Editorial voice: decisive, specific fashion vocabulary.
- No bulleted lists unless the question specifically calls for options.
- End with a single actionable suggestion when relevant.`,
    orderIndex: 15,
  },
];

async function seedPromptSections() {
  console.log('Seeding prompt sections...');

  // Check if already seeded
  const existing = await prisma.promptSection.count();
  if (existing > 0) {
    console.log(`Already seeded (${existing} sections exist). Skipping.`);
    await prisma.$disconnect();
    return;
  }

  // Split SYSTEM_PROMPT into sections
  const sectionsToCreate: Array<{ key: string; content: string; orderIndex: number }> = [];

  for (let i = 0; i < SECTIONS.length; i++) {
    const section = SECTIONS[i];
    const startIdx = SYSTEM_PROMPT.indexOf(section.startMarker);

    if (startIdx === -1) {
      console.warn(`Section "${section.key}" startMarker not found: "${section.startMarker.slice(0, 40)}..."`);
      continue;
    }

    let endIdx: number;
    if (section.endMarker === '') {
      endIdx = SYSTEM_PROMPT.length;
    } else {
      endIdx = SYSTEM_PROMPT.indexOf(section.endMarker, startIdx);
      if (endIdx === -1) {
        console.warn(`Section "${section.key}" endMarker not found — using end of prompt`);
        endIdx = SYSTEM_PROMPT.length;
      }
    }

    const content = SYSTEM_PROMPT.slice(startIdx, endIdx).trim();
    sectionsToCreate.push({ key: section.key, content, orderIndex: section.orderIndex });
  }

  // Create main sections
  for (const s of sectionsToCreate) {
    await prisma.promptSection.create({
      data: {
        sectionKey: s.key,
        version: 1,
        content: s.content,
        isActive: true,
        source: 'manual',
        changelog: 'Initial seed from hardcoded SYSTEM_PROMPT v3.2',
        orderIndex: s.orderIndex,
      },
    });
    console.log(`  Seeded section: ${s.key} (${s.content.length} chars)`);
  }

  // Create follow-up sections
  for (const s of FOLLOWUP_SECTIONS) {
    await prisma.promptSection.create({
      data: {
        sectionKey: s.key,
        version: 1,
        content: s.content,
        isActive: true,
        source: 'manual',
        changelog: 'Initial seed — follow-up conversation prompt',
        orderIndex: s.orderIndex,
      },
    });
    console.log(`  Seeded follow-up section: ${s.key}`);
  }

  // Seed 20 regression cases
  const regressionCases = [
    { name: 'streetwear_casual_1', category: 'style_lanes', context: { occasion: 'hanging with friends', outfit: 'Oversized graphic hoodie, baggy cargo pants, Air Force 1s', vibe: 'streetwear' } },
    { name: 'business_interview_1', category: 'occasion_dress_codes', context: { occasion: 'job interview tech startup', outfit: 'Navy slacks, light pink button-down, brown belt, brown dress shoes' } },
    { name: 'cocktail_party_1', category: 'examples', context: { occasion: 'cocktail party', outfit: 'Black fitted dress, gold statement necklace, black heels' } },
    { name: 'gym_athletic_1', category: 'style_lanes', context: { occasion: 'gym session', outfit: 'Black compression leggings, oversized gray cotton tee, neon green running shoes' } },
    { name: 'brunch_casual_1', category: 'proportions_silhouette', context: { occasion: 'brunch with friends', outfit: 'Light blue jeans, white t-shirt, olive bomber jacket, white sneakers' } },
    { name: 'formal_wedding_1', category: 'occasion_dress_codes', context: { occasion: 'black tie wedding', outfit: 'Navy tuxedo, white dress shirt, black bow tie, black patent leather shoes' } },
    { name: 'date_night_1', category: 'style_coherence', context: { occasion: 'date night restaurant', outfit: 'Black skinny jeans, silk blouse, strappy heels, small clutch' } },
    { name: 'streetwear_hiphop_1', category: 'style_lanes', context: { occasion: 'concert', outfit: 'Designer logo hoodie, baggy jeans, Jordan 1s, gold chain, bucket hat' } },
    { name: 'minimalist_work_1', category: 'style_lanes', context: { occasion: 'office meeting', outfit: 'Cream blazer, black wide-leg trousers, white button-down, white sneakers' } },
    { name: 'bohemian_festival_1', category: 'style_lanes', context: { occasion: 'music festival', outfit: 'Crochet top, flowy maxi skirt, cowboy boots, layered necklaces, fringe bag' } },
    { name: 'smart_casual_dinner_1', category: 'fit_principles', context: { occasion: 'dinner with colleagues', outfit: 'Dark wash jeans, navy blazer, white t-shirt, white sneakers' } },
    { name: 'athletic_running_1', category: 'style_lanes', context: { occasion: 'morning run', outfit: 'Technical running shorts, moisture-wicking long sleeve, running shoes, GPS watch' } },
    { name: 'old_money_prep_1', category: 'style_lanes', context: { occasion: 'yacht club lunch', outfit: 'Navy chinos, striped OCBD, loafers, leather belt, minimal watch' } },
    { name: 'punk_edgy_1', category: 'style_lanes', context: { occasion: 'concert', outfit: 'Black leather jacket with studs, ripped jeans, Doc Martens, band tee, safety pin earrings' } },
    { name: 'cottagecore_picnic_1', category: 'style_lanes', context: { occasion: 'picnic in the park', outfit: 'Prairie dress with puff sleeves, floral print, straw hat, woven basket bag, Mary Janes' } },
    { name: 'color_clash_1', category: 'color_theory', context: { occasion: 'casual day out', outfit: 'Red shirt, orange shorts, purple sneakers' } },
    { name: 'monochrome_1', category: 'color_theory', context: { occasion: 'casual', outfit: 'All navy: navy turtleneck, navy trousers, navy sneakers' } },
    { name: 'oversized_intentional_1', category: 'fit_principles', context: { occasion: 'casual', outfit: 'Oversized vintage band tee tucked front into baggy jeans, chunky sneakers' } },
    { name: 'texture_mixing_1', category: 'style_coherence', context: { occasion: 'cocktail', outfit: 'Velvet blazer, silk shirt, wool trousers, suede shoes' } },
    { name: 'quiet_luxury_1', category: 'style_lanes', context: { occasion: 'business casual', outfit: 'Cashmere crewneck, tailored camel trousers, leather loafers, minimal gold watch' } },
  ];

  for (const rc of regressionCases) {
    await prisma.regressionCase.create({
      data: {
        scenarioName: rc.name,
        category: rc.category,
        contextSnapshot: rc.context as any,
        baselineScores: { specificity: 7, voiceConsistency: 7, actionability: 7, styleAlignment: 7, occasionFit: 7 } as any,
      },
    });
  }
  console.log(`  Seeded ${regressionCases.length} regression cases`);

  console.log('Prompt sections seeded successfully');
  await prisma.$disconnect();
}

seedPromptSections().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
