# Or This? AI Training System

Complete infrastructure for training, testing, and optimizing the Or This? AI outfit analysis system **before** acquiring users.

## 📚 Table of Contents

- [Overview](#overview)
- [What's Included](#whats-included)
- [Quick Start](#quick-start)
- [System Components](#system-components)
- [Testing & Evaluation](#testing--evaluation)
- [Pre-Launch Checklist](#pre-launch-checklist)
- [Continuous Improvement](#continuous-improvement)

---

## Overview

This system provides everything you need to ensure high-quality AI feedback before launch:

✅ **Brand Voice Enforcement** - Ensures all responses match Or This? personality
✅ **Few-Shot Learning** - Pre-built examples for consistent, high-quality feedback
✅ **Style Knowledge Base** - Comprehensive fashion rules and guidelines
✅ **Automated Testing** - Validate consistency, quality, and brand alignment
✅ **Evaluation Framework** - Measure and track AI performance metrics

---

## What's Included

### 1. Prompts (`src/prompts/`)
- **`outfit-analysis.prompt.ts`** - Comprehensive system prompt with Or This? brand voice
- Includes evaluation criteria, tone guidelines, score calibration
- Ready for GPT-4 Vision, Claude, or Gemini

### 2. Knowledge Base (`src/knowledge/`)
- **`style-rules.ts`** - Complete fashion knowledge:
  - Color theory (complementary, analogous, seasonal)
  - Fit guidelines (shoulders, sleeves, pants, dresses)
  - Body type guidelines
  - Occasion appropriateness rules
  - Style aesthetics (classic, bohemian, minimalist, etc.)
  - Pattern mixing rules
  - Accessory guidelines
  - Quick fix database

### 3. Few-Shot Examples (`src/data/`)
- **`few-shot-examples.ts`** - 8 curated outfit analyses
  - Date night (high score)
  - Job interviews (medium score)
  - Casual weekend (high score)
  - Business meetings (needs work)
  - Wedding guest (high score)
  - First day at work (medium score)
  - Athleisure (medium score)
  - Cocktail party (high score)

### 4. Brand Voice Validation (`src/validators/`)
- **`brand-voice-validator.ts`** - Automated brand voice checking
  - Detects prohibited phrases ("not flattering", "wrong", etc.)
  - Checks for hedging language ("maybe", "perhaps")
  - Ensures encouraging tone
  - Validates specificity and actionability
  - Returns 0-100 score with detailed issues

### 5. Response Templates (`src/templates/`)
- **`feedback-template.ts`** - Structured response format
  - Enforces consistent output structure
  - Opening/closing phrases based on score
  - Template validation
  - Markdown formatting

### 6. Evaluation Tools (`src/evaluation/`)
- **`model-evaluator.ts`** - Comprehensive testing framework
  - **Consistency testing**: Same input → similar output (variance < 0.5)
  - **Brand voice testing**: Validation pass rate > 95%
  - **Quality metrics**: Specificity, actionability, positivity ratio
  - **Expert comparison**: AI score vs. manual ground truth

### 7. Integration Helpers (`src/lib/`)
- **`ai-integration-helper.ts`** - Connect all components to your AI service
  - Build enhanced prompts with few-shot examples
  - Validate and sanitize AI responses
  - Retry logic with validation
  - Color harmony and quick fix suggestions

### 8. Testing Scripts (`scripts/`)
- **`test-model-quality.ts`** - Run full test suite
- **`generate-training-data.ts`** - Generate synthetic scenarios

---

## Quick Start

### 1. Install Dependencies

```bash
cd fitcheck-api
npm install
```

### 2. Run Tests

```bash
# Test brand voice validation
npm run test:model

# Generate training scenarios
npm run generate:training-data
```

### 3. Integrate with Your AI

```typescript
import {
  buildEnhancedSystemPrompt,
  buildOutfitAnalysisPrompt,
  validateAIResponse,
} from './src/lib/ai-integration-helper.js';

// Build prompts
const systemPrompt = buildEnhancedSystemPrompt({ occasion: 'date night' });
const userPrompt = buildOutfitAnalysisPrompt('Burgundy wrap dress', {
  occasion: 'dinner date',
  setting: 'upscale restaurant',
  vibe: 'romantic',
});

// Call your AI (OpenAI, Claude, Gemini, etc.)
const response = await yourAIService.call(systemPrompt, userPrompt);

// Validate response
const validation = validateAIResponse(response);
if (!validation.isValid) {
  console.error('Validation errors:', validation.errors);
}
```

---

## System Components

### Brand Voice Rules

The Or This? brand voice is:
- **Decisive** - Clear answers, no hedging
- **Warm** - Supportive, encouraging
- **Confident** - Bold recommendations
- **Real** - Honest but constructive

**Prohibited Phrases:**
- "not flattering", "unflattering"
- "wrong", "bad choice", "mistake"
- "should probably change"
- "are you sure"
- "hides problem areas"

**Encouraged Phrases:**
- "you've got this!"
- "gorgeous", "stunning", "beautiful"
- "love this!"
- "chef's kiss" 💋
- "trust your instincts"

### Evaluation Criteria

All outfits are scored on 5 dimensions (0-10):

1. **Fit & Proportion** - How well garments fit
2. **Color Harmony** - Color combinations and skin tone
3. **Occasion Match** - Appropriateness for context
4. **Style Cohesion** - How well pieces work together
5. **Confidence Factor** - Overall "you've got this" vibe

**Overall Score** = Average of 5 criteria

### Response Structure

```typescript
{
  overallScore: 8.5,
  criteriaScores: { fit: 9, color: 8, occasion: 9, cohesion: 8, confidence: 9 },
  summary: "One-sentence enthusiastic summary",
  whatsWorking: [
    "Specific positive point 1",
    "Specific positive point 2",
    "Specific positive point 3"
  ],
  consider: [
    "Gentle suggestion 1 (if needed)",
    "Gentle suggestion 2 (if needed)"
  ],
  quickFixes: [
    "Actionable tip 1",
    "Actionable tip 2",
    "Actionable tip 3"
  ]
}
```

---

## Testing & Evaluation

### Run Full Test Suite

```bash
npm run test:model
```

This will test:
- ✅ Brand voice validation (prohibited phrases, tone)
- ✅ Template compliance (structure, required fields)
- ✅ Quality metrics (specificity, actionability)
- ✅ Few-shot example validation

### Consistency Testing

```typescript
import { modelEvaluator } from './src/evaluation/model-evaluator.js';

// Test same input multiple times
const result = await modelEvaluator.evaluateConsistency(
  testCase,
  yourAIFunction,
  5 // number of runs
);

console.log(`Variance: ${result.scoreVariance}`); // Target: < 0.5
console.log(`Passed: ${result.passed}`);
```

### Brand Voice Testing

```typescript
import { brandVoiceValidator } from './src/validators/brand-voice-validator.js';

const validation = brandVoiceValidator.validate(feedbackText);

console.log(`Score: ${validation.score}/100`); // Target: > 90
console.log(`Valid: ${validation.isValid}`);
console.log(`Issues:`, validation.issues);
```

### Quality Metrics

```typescript
import { modelEvaluator } from './src/evaluation/model-evaluator.js';

// Check specificity (uses fashion terms, not vague)
const specificityResult = modelEvaluator.checkSpecificity(feedback);
// Target: > 90/100

// Check actionability (concrete, actionable tips)
const actionabilityResult = modelEvaluator.checkActionability(feedback);
// Target: > 85/100
```

---

## Pre-Launch Checklist

### Week 1-2: Data Collection
- [ ] Collect 50-100 diverse outfit images (stock photos, Pinterest)
- [ ] Categorize by occasion (date night, work, casual, wedding, etc.)
- [ ] Include diverse body types, styles, and cultural attire
- [ ] Create expected score ranges for each

### Week 3-4: Manual Curation
- [ ] Write exemplary Or This? feedback for each image
- [ ] Follow brand voice guidelines strictly
- [ ] These become your "ground truth" for testing
- [ ] Validate your own feedback with brand voice validator

### Week 5: Initial AI Testing
- [ ] Run all images through current AI
- [ ] Compare AI scores to your manual scores
- [ ] Calculate accuracy: % within 1 point of ground truth
- [ ] Target: > 80% accuracy

### Week 6: Prompt Iteration
- [ ] Identify patterns in AI errors
- [ ] Adjust system prompt based on issues
- [ ] Re-test with updated prompt
- [ ] Measure improvement
- [ ] Repeat until targets met

### Week 7: Beta Testing
- [ ] Test with 10-20 friends/family
- [ ] Collect subjective feedback
- [ ] Note any offensive/inappropriate responses
- [ ] Test edge cases (cultural attire, unconventional styles)

### Week 8: Final Validation
- [ ] Run full test suite
- [ ] Ensure all metrics meet targets:
  - Consistency: variance < 0.5 ✅
  - Brand voice: > 95% pass rate ✅
  - Accuracy: > 80% within 1 point of expert ✅
  - Specificity: > 90/100 ✅
  - Actionability: > 85/100 ✅

---

## Target Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| **Consistency** | Variance < 0.5 points | Run same input 5 times, check std dev |
| **Brand Voice** | > 95% pass rate | `brandVoiceValidator.validate()` |
| **Specificity** | > 90/100 score | `modelEvaluator.checkSpecificity()` |
| **Actionability** | > 85/100 score | `modelEvaluator.checkActionability()` |
| **Accuracy** | > 80% within ±1 point | Compare AI to expert scores |
| **Positive Ratio** | > 2:1 positive:negative | Count positive vs. negative words |

---

## Continuous Improvement

### Post-Launch

1. **Collect Real User Feedback**
   - Track user ratings of AI feedback
   - Note when users disagree with AI
   - Identify patterns in low-rated responses

2. **Expand Training Data**
   - Add problematic examples to training set
   - Write better ground truth feedback
   - Re-test and iterate

3. **Monitor Metrics**
   - Track metrics over time
   - Set up automated testing in CI/CD
   - Alert if metrics drop below thresholds

4. **A/B Testing**
   - Test prompt variations
   - Measure impact on user satisfaction
   - Roll out improvements gradually

---

## Advanced Usage

### Custom Few-Shot Examples

Add your own examples to `src/data/few-shot-examples.ts`:

```typescript
export const FEW_SHOT_EXAMPLES: FewShotExample[] = [
  ...existingExamples,
  {
    id: 'your-custom-example',
    occasion: 'beach wedding',
    context: { occasion: 'beach wedding', weather: 'warm', vibe: 'tropical' },
    outfit: {
      description: 'Flowy maxi dress, flat sandals, flower crown',
      items: ['maxi dress', 'sandals', 'flower crown'],
    },
    exemplaryFeedback: {
      overallScore: 9.0,
      criteriaScores: { fit: 9, color: 9, occasion: 10, cohesion: 9, confidence: 8 },
      summary: 'Perfect beach wedding vibes!',
      whatsWorking: [/* ... */],
      consider: [/* ... */],
      quickFixes: [/* ... */],
    },
  },
];
```

### Custom Validators

Create custom validation rules:

```typescript
import { BrandVoiceValidator } from './src/validators/brand-voice-validator.js';

class CustomValidator extends BrandVoiceValidator {
  checkCustomRule(text: string): boolean {
    // Your custom logic
    return true;
  }
}
```

---

## Troubleshooting

### AI Responses Are Too Generic

**Solution**: Add more few-shot examples with specific details
```typescript
// Bad: "The dress looks nice"
// Good: "The A-line silhouette creates beautiful proportions and the midi length is perfect for this occasion"
```

### Brand Voice Failing

**Solution**: Check prohibited phrases list, add more if needed
```typescript
// Check what's failing:
const validation = brandVoiceValidator.validate(response);
console.log(validation.issues);
```

### Scores Too Inconsistent

**Solution**: Add score calibration examples to prompt
```typescript
// Include explicit examples of 9-10, 7-8, 5-6, 3-4 outfits
// Show the AI what each range looks like
```

---

## Resources

- **Brand Guidelines**: `/Branding/ORTHIS_BRAND_GUIDELINES.md`
- **OpenAI Best Practices**: https://platform.openai.com/docs/guides/prompt-engineering
- **Few-Shot Learning**: https://arxiv.org/abs/2005.14165
- **Fashion Terminology**: https://fashionhistory.fitnyc.edu/glossary/

---

## Support

Questions? Issues? Improvements?

1. Check the troubleshooting section above
2. Review few-shot examples for reference
3. Test with `npm run test:model` to identify issues
4. Review brand guidelines for voice questions

---

**Last Updated**: February 2026
**Version**: 1.0
**Maintainer**: Or This? Engineering Team

---

## Summary

You now have a **production-ready AI training infrastructure**:

✅ Brand voice enforcement
✅ Quality validation
✅ Automated testing
✅ Comprehensive knowledge base
✅ Pre-built examples
✅ Evaluation metrics

**Next Step**: Integrate with your AI service and start testing!

```bash
npm run test:model  # See it in action
```
