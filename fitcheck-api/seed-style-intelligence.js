const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedStyleIntelligence() {
  console.log('🌱 Seeding Style Intelligence test data...\n');

  const user = await prisma.user.findFirst({
    select: { id: true, email: true }
  });

  if (!user) {
    console.log('❌ No users found');
    return;
  }

  console.log('✅ Seeding for user:', user.email, '\n');

  // Create 5 test outfits with StyleDNA
  const testOutfits = [
    {
      occasions: ['casual'],
      aiScore: 8.5,
      styleDNA: {
        dominantColors: ['navy', 'white'],
        colorHarmony: 'complementary',
        colorCount: 2,
        formalityLevel: 2,
        styleArchetypes: ['minimalist', 'classic'],
        silhouetteType: 'relaxed',
        garments: ['t-shirt', 'jeans', 'sneakers'],
        patterns: ['solid'],
        textures: ['cotton', 'denim'],
        colorScore: 8.5,
        proportionScore: 8.0,
        fitScore: 9.0,
        coherenceScore: 8.5
      }
    },
    {
      occasions: ['work'],
      aiScore: 7.5,
      styleDNA: {
        dominantColors: ['gray', 'white', 'black'],
        colorHarmony: 'monochromatic',
        colorCount: 3,
        formalityLevel: 4,
        styleArchetypes: ['professional', 'minimalist'],
        silhouetteType: 'fitted',
        garments: ['button-down', 'slacks', 'dress shoes'],
        patterns: ['solid', 'pinstripe'],
        textures: ['cotton', 'wool'],
        colorScore: 7.0,
        proportionScore: 8.0,
        fitScore: 7.5,
        coherenceScore: 8.0
      }
    },
    {
      occasions: ['date night'],
      aiScore: 9.0,
      styleDNA: {
        dominantColors: ['black', 'burgundy'],
        colorHarmony: 'complementary',
        colorCount: 2,
        formalityLevel: 3,
        styleArchetypes: ['modern', 'sleek'],
        silhouetteType: 'fitted',
        garments: ['sweater', 'chinos', 'boots'],
        patterns: ['solid'],
        textures: ['knit', 'cotton'],
        colorScore: 9.0,
        proportionScore: 8.5,
        fitScore: 9.0,
        coherenceScore: 9.0
      }
    },
    {
      occasions: ['casual'],
      aiScore: 6.5,
      styleDNA: {
        dominantColors: ['olive', 'tan', 'white', 'navy'],
        colorHarmony: 'analogous',
        colorCount: 4,
        formalityLevel: 2,
        styleArchetypes: ['streetwear', 'casual'],
        silhouetteType: 'oversized',
        garments: ['hoodie', 'joggers', 'sneakers'],
        patterns: ['solid', 'logo'],
        textures: ['fleece', 'cotton'],
        colorScore: 6.0,
        proportionScore: 6.5,
        fitScore: 7.0,
        coherenceScore: 6.5
      }
    },
    {
      occasions: ['casual'],
      aiScore: 8.0,
      styleDNA: {
        dominantColors: ['navy', 'white'],
        colorHarmony: 'complementary',
        colorCount: 2,
        formalityLevel: 2,
        styleArchetypes: ['minimalist', 'classic'],
        silhouetteType: 'fitted',
        garments: ['polo', 'chinos', 'loafers'],
        patterns: ['solid'],
        textures: ['cotton', 'canvas'],
        colorScore: 8.0,
        proportionScore: 8.0,
        fitScore: 8.5,
        coherenceScore: 8.0
      }
    }
  ];

  let created = 0;
  for (const outfit of testOutfits) {
    const outfitCheck = await prisma.outfitCheck.create({
      data: {
        userId: user.id,
        occasions: outfit.occasions,
        imageType: 'test',
        aiScore: outfit.aiScore,
        aiFeedback: {
          overallScore: outfit.aiScore,
          summary: `Test outfit for ${outfit.occasions.join(', ')}`,
          whatsWorking: [{ point: 'Test', detail: 'Test detail' }],
          consider: [{ point: 'Test', detail: 'Test detail' }],
          quickFixes: [{ suggestion: 'Test', impact: 'Test impact' }],
          occasionMatch: { score: outfit.aiScore, notes: 'Test' },
          styleDNA: outfit.styleDNA
        },
        aiProcessedAt: new Date()
      }
    });

    await prisma.styleDNA.create({
      data: {
        outfitCheckId: outfitCheck.id,
        userId: user.id,
        ...outfit.styleDNA
      }
    });

    created++;
    console.log(`✅ Created outfit ${created}:`, outfit.occasions[0], `(score: ${outfit.aiScore})`);
  }

  console.log(`\n✅ Successfully created ${created} outfits with StyleDNA!\n`);

  // Verify
  const total = await prisma.styleDNA.count({ where: { userId: user.id } });
  console.log('📊 Total StyleDNA records:', total);

  await prisma.$disconnect();
}

seedStyleIntelligence().catch(console.error);
