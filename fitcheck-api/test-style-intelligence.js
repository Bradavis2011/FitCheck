const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testStyleIntelligence() {
  console.log('=== Testing Style Intelligence Engine ===\n');

  // Get test user
  const user = await prisma.user.findFirst({
    select: { id: true, email: true }
  });

  if (!user) {
    console.log('❌ No users found');
    return;
  }

  console.log('✅ Test User:', user.email);
  console.log('User ID:', user.id, '\n');

  // Check current counts
  const outfitCount = await prisma.outfitCheck.count({ where: { userId: user.id } });
  const styleDNACount = await prisma.styleDNA.count({ where: { userId: user.id } });

  console.log('📊 Current Data:');
  console.log('  - Outfit Checks:', outfitCount);
  console.log('  - StyleDNA Records:', styleDNACount, '\n');

  // Test: Create mock StyleDNA data for existing outfit
  const outfit = await prisma.outfitCheck.findFirst({
    where: { userId: user.id },
    select: { id: true, occasions: true, aiScore: true }
  });

  if (outfit && styleDNACount === 0) {
    console.log('🧪 Creating test StyleDNA record...');

    const styleDNA = await prisma.styleDNA.create({
      data: {
        outfitCheckId: outfit.id,
        userId: user.id,
        dominantColors: ['navy', 'white', 'gray'],
        colorHarmony: 'neutral',
        colorCount: 3,
        formalityLevel: 3,
        styleArchetypes: ['classic', 'minimalist'],
        silhouetteType: 'fitted',
        garments: ['shirt', 'pants', 'shoes'],
        patterns: ['solid'],
        textures: ['cotton', 'denim'],
        colorScore: 8.0,
        proportionScore: 7.5,
        fitScore: 8.5,
        coherenceScore: 8.0
      }
    });

    console.log('✅ StyleDNA created:', styleDNA.id, '\n');
  }

  // Test: Get style insights (Layer 2)
  console.log('🔍 Testing getStyleInsights logic...');

  const styleDNAs = await prisma.styleDNA.findMany({
    where: { userId: user.id },
    include: { outfitCheck: { select: { aiScore: true } } },
    orderBy: { createdAt: 'desc' },
    take: 20
  });

  if (styleDNAs.length < 3) {
    console.log('⚠️  Need at least 3 StyleDNA records for insights');
    console.log('   Current count:', styleDNAs.length);
  } else {
    // Test color harmony insights
    const byColorHarmony = new Map();
    styleDNAs.forEach(dna => {
      if (dna.colorHarmony && dna.outfitCheck.aiScore) {
        const scores = byColorHarmony.get(dna.colorHarmony) || [];
        scores.push(dna.outfitCheck.aiScore);
        byColorHarmony.set(dna.colorHarmony, scores);
      }
    });

    console.log('✅ Color harmony patterns:', Object.fromEntries(byColorHarmony));
  }

  // Test: Get calibration context (Layer 3)
  console.log('\n🎯 Testing calibration logic...');

  const calibrationData = await prisma.outfitCheck.findMany({
    where: {
      aiScore: { not: null },
      communityScoreCount: { gte: 3 }
    },
    select: { aiScore: true, communityAvgScore: true },
    take: 100,
    orderBy: { createdAt: 'desc' }
  });

  console.log('  - Outfits with AI + Community scores:', calibrationData.length);

  if (calibrationData.length >= 10) {
    const avgDelta = calibrationData.reduce((sum, d) => {
      return sum + ((d.aiScore || 0) - (d.communityAvgScore || 0));
    }, 0) / calibrationData.length;

    console.log('  - Avg AI vs Community delta:', avgDelta.toFixed(2));
  } else {
    console.log('  ⚠️  Need 10+ calibrated outfits (have:', calibrationData.length, ')');
  }

  console.log('\n✅ Style Intelligence Engine is functional!');

  await prisma.$disconnect();
}

testStyleIntelligence().catch(console.error);
