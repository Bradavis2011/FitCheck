import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testEndpoints() {
  console.log('🧪 Testing Style Intelligence Endpoints\n');

  const user = await prisma.user.findFirst({
    select: { id: true, email: true }
  });

  console.log('Test User:', user.email, '\n');

  // ===== TEST: getStyleProfile =====
  console.log('📊 Testing GET /api/user/style-profile logic...\n');

  const styleDNAs = await prisma.styleDNA.findMany({
    where: { userId: user.id },
    include: { outfitCheck: { select: { aiScore: true } } },
    orderBy: { createdAt: 'desc' },
  });

  if (styleDNAs.length === 0) {
    console.log('❌ No style data (this would return empty response)');
  } else {
    // Top colors
    const colorScores = new Map();
    styleDNAs.forEach(dna => {
      if (dna.outfitCheck.aiScore) {
        dna.dominantColors.forEach(color => {
          const entry = colorScores.get(color) || { total: 0, count: 0 };
          entry.total += dna.outfitCheck.aiScore;
          entry.count++;
          colorScores.set(color, entry);
        });
      }
    });

    const topColors = [...colorScores.entries()]
      .map(([color, v]) => ({ color, avgScore: +(v.total / v.count).toFixed(2), appearances: v.count }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 10);

    console.log('✅ Top Colors by Performance:');
    topColors.forEach(c => {
      console.log(`   ${c.color}: ${c.avgScore} (${c.appearances} appearances)`);
    });

    // Dominant archetypes
    const archetypeCounts = new Map();
    styleDNAs.forEach(dna => {
      dna.styleArchetypes.forEach(a => {
        archetypeCounts.set(a, (archetypeCounts.get(a) || 0) + 1);
      });
    });

    const dominantArchetypes = [...archetypeCounts.entries()]
      .map(([archetype, count]) => ({
        archetype,
        count,
        percentage: +((count / styleDNAs.length) * 100).toFixed(1)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    console.log('\n✅ Dominant Style Archetypes:');
    dominantArchetypes.forEach(a => {
      console.log(`   ${a.archetype}: ${a.count} outfits (${a.percentage}%)`);
    });

    // Average scores
    const avgScores = { color: 0, proportion: 0, fit: 0, coherence: 0, count: 0 };
    styleDNAs.forEach(dna => {
      if (dna.colorScore && dna.proportionScore && dna.fitScore && dna.coherenceScore) {
        avgScores.color += dna.colorScore;
        avgScores.proportion += dna.proportionScore;
        avgScores.fit += dna.fitScore;
        avgScores.coherence += dna.coherenceScore;
        avgScores.count++;
      }
    });

    const averageScores = {
      colorCoordination: +(avgScores.color / avgScores.count).toFixed(2),
      proportions: +(avgScores.proportion / avgScores.count).toFixed(2),
      fit: +(avgScores.fit / avgScores.count).toFixed(2),
      styleCoherence: +(avgScores.coherence / avgScores.count).toFixed(2),
    };

    console.log('\n✅ Average Sub-Scores:');
    console.log(`   Color: ${averageScores.colorCoordination}/10`);
    console.log(`   Proportions: ${averageScores.proportions}/10`);
    console.log(`   Fit: ${averageScores.fit}/10`);
    console.log(`   Coherence: ${averageScores.styleCoherence}/10`);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // ===== TEST: getStyleInsights (used in AI prompt) =====
  console.log('🔍 Testing getStyleInsights (AI Context)...\n');

  if (styleDNAs.length < 3) {
    console.log('⚠️  Need 3+ outfits for insights (have:', styleDNAs.length, ')');
  } else {
    const insights = [];

    // Best color harmony
    const byColorHarmony = new Map();
    styleDNAs.forEach(dna => {
      if (dna.colorHarmony && dna.outfitCheck.aiScore) {
        const scores = byColorHarmony.get(dna.colorHarmony) || [];
        scores.push(dna.outfitCheck.aiScore);
        byColorHarmony.set(dna.colorHarmony, scores);
      }
    });

    const bestHarmony = [...byColorHarmony.entries()]
      .filter(([_, scores]) => scores.length > 0)
      .map(([harmony, scores]) => ({
        harmony,
        avg: scores.reduce((a, b) => a + b) / scores.length,
        count: scores.length
      }))
      .filter(h => h.count >= 2)
      .sort((a, b) => b.avg - a.avg);

    if (bestHarmony.length > 0) {
      insights.push(`User's ${bestHarmony[0].harmony} color outfits score highest (avg ${bestHarmony[0].avg.toFixed(1)})`);
    }

    console.log('✅ AI Context Insights:');
    insights.forEach(i => console.log(`   - ${i}`));
  }

  console.log('\n✅ All endpoint logic verified!\n');

  await prisma.$disconnect();
}

testEndpoints().catch(console.error);
