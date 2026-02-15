/**
 * Model Quality Testing Script
 *
 * Run this script to test AI model quality before launch.
 * Tests consistency, brand voice, and overall quality metrics.
 *
 * Usage: npm run test:model
 */

import { modelEvaluator } from '../src/evaluation/model-evaluator.js';
import { brandVoiceValidator } from '../src/validators/brand-voice-validator.js';
import { FEW_SHOT_EXAMPLES } from '../src/data/few-shot-examples.js';
import { FeedbackTemplate } from '../src/templates/feedback-template.js';

// Mock AI function (replace with actual AI call)
async function mockGenerateFeedback(context: any): Promise<FeedbackTemplate> {
  // This would be your actual AI call
  // For now, return a sample response
  return {
    overallScore: 8.5,
    criteriaScores: {
      fit: 9,
      color: 8,
      occasion: 9,
      cohesion: 8,
      confidence: 9,
    },
    summary: 'This wrap dress is absolutely stunning on you!',
    whatsWorking: [
      'The wrap style creates a gorgeous silhouette',
      'Deep burgundy is perfect for evening',
      'The midi length is ideal for the occasion',
    ],
    consider: [
      'Consider adding gold jewelry to elevate the look',
    ],
    quickFixes: [
      'Add a structured clutch',
      'Pair with nude or metallic heels',
      'Keep makeup elegant but not overpowering',
    ],
  };
}

async function runConsistencyTests() {
  console.log('🧪 Running Consistency Tests...\n');

  // Test with few-shot examples
  const testCases = FEW_SHOT_EXAMPLES.slice(0, 3); // Test first 3 examples

  for (const example of testCases) {
    console.log(`Testing: ${example.id}`);
    const result = await modelEvaluator.evaluateConsistency(
      {
        id: example.id,
        description: example.outfit.description,
        context: example.context,
        expertScore: example.exemplaryFeedback.overallScore,
      },
      mockGenerateFeedback,
      5 // Run 5 times
    );

    console.log(`  Variance: ${result.scoreVariance.toFixed(3)} ${result.passed ? '✅' : '❌'}`);
    console.log(`  Average: ${result.averageScore.toFixed(2)}`);
    console.log();
  }
}

async function runBrandVoiceTests() {
  console.log('🗣️  Running Brand Voice Tests...\n');

  // Test few-shot example feedback
  const testFeedbacks = FEW_SHOT_EXAMPLES.map(ex => {
    const feedback = ex.exemplaryFeedback;
    return [
      feedback.summary,
      ...feedback.whatsWorking,
      ...feedback.consider,
      ...feedback.quickFixes,
    ].join(' ');
  });

  const results = modelEvaluator.batchEvaluateBrandVoice(testFeedbacks);

  console.log(`Pass Rate: ${results.passRate.toFixed(1)}%`);
  console.log(`Average Score: ${results.averageScore.toFixed(1)}/100`);
  console.log();

  if (results.commonIssues.size > 0) {
    console.log('Common Issues:');
    Array.from(results.commonIssues.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([issue, count]) => {
        console.log(`  - ${issue}: ${count} occurrences`);
      });
  }
  console.log();
}

async function runQualityTests() {
  console.log('✨ Running Quality Tests...\n');

  // Test specificity and actionability
  for (const example of FEW_SHOT_EXAMPLES.slice(0, 5)) {
    const feedback = example.exemplaryFeedback;

    console.log(`Testing: ${example.id}`);

    const specificityResult = modelEvaluator.checkSpecificity(feedback);
    console.log(`  Specificity: ${specificityResult.score}/100 ${specificityResult.hasSpecificTerms ? '✅' : '❌'}`);

    const actionabilityResult = modelEvaluator.checkActionability(feedback);
    console.log(`  Actionability: ${actionabilityResult.score.toFixed(0)}/100 ${actionabilityResult.score >= 85 ? '✅' : '❌'}`);

    const expertComparison = modelEvaluator.compareToExpertScore(
      feedback.overallScore,
      feedback.overallScore // Same for curated examples
    );
    console.log(`  Expert Match: ${expertComparison.accuracyScore}/100 ✅`);
    console.log();
  }
}

async function testProhibitedPhrases() {
  console.log('🚫 Testing Prohibited Phrases...\n');

  const badExamples = [
    'This outfit is not flattering on you.',
    'You should probably change the shoes.',
    'Are you sure about that color choice?',
    'This doesn\'t really work for your body type.',
    'Maybe try something less bold.',
  ];

  console.log('Testing negative examples (should all FAIL):');
  badExamples.forEach((text, i) => {
    const result = brandVoiceValidator.validate(text);
    console.log(`  ${i + 1}. ${result.isValid ? '❌ PASSED (BAD!)' : '✅ FAILED (GOOD!)'} - Score: ${result.score}/100`);
    if (result.issues.length > 0) {
      result.issues.forEach(issue => {
        console.log(`     Issue: ${issue.message}`);
      });
    }
  });

  console.log('\nTesting positive examples (should all PASS):');
  const goodExamples = [
    'You\'ve got this! The wrap dress creates a stunning silhouette.',
    'Love the color choice! This burgundy is absolutely gorgeous on you.',
    'Great foundation! Let\'s elevate it with a few tweaks.',
  ];

  goodExamples.forEach((text, i) => {
    const result = brandVoiceValidator.validate(text);
    console.log(`  ${i + 1}. ${result.isValid ? '✅ PASSED' : '❌ FAILED'} - Score: ${result.score}/100`);
  });

  console.log();
}

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('   Or This? AI Model Quality Test Suite');
  console.log('═══════════════════════════════════════════════\n');

  try {
    await testProhibitedPhrases();
    await runBrandVoiceTests();
    await runQualityTests();
    // await runConsistencyTests(); // Uncomment when you have real AI

    console.log('═══════════════════════════════════════════════');
    console.log('   Final Report');
    console.log('═══════════════════════════════════════════════\n');

    modelEvaluator.printReport();

    console.log('\n✅ Testing complete!\n');
  } catch (error) {
    console.error('❌ Error running tests:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
