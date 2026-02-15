# Or This? AI Training - Quick Start Guide

Get your AI ready for launch in 8 weeks.

## 🚀 This Week (Week 1)

### 1. Run Tests to See What You Have

```bash
cd fitcheck-api
npm run test:model
```

You'll see:
- ✅ Brand voice validation working
- ✅ Few-shot examples validated
- ✅ Quality metrics baseline

### 2. Generate Training Scenarios

```bash
npm run generate:training-data
```

This creates 12 diverse outfit scenarios for testing.

### 3. Test a Sample Response

Create `test-sample.ts`:

```typescript
import { brandVoiceValidator } from './src/validators/brand-voice-validator.js';

const goodFeedback = `
You've got this! The wrap dress creates a stunning silhouette that's
perfect for date night. The burgundy color is absolutely gorgeous and
will photograph beautifully. Pair with gold jewelry and you're ready to
turn heads!
`;

const result = brandVoiceValidator.validate(goodFeedback);
console.log('Score:', result.score, '/100');
console.log('Valid:', result.isValid);
console.log('Issues:', result.issues);
```

Run it:
```bash
tsx test-sample.ts
```

## 📅 Week-by-Week Plan

### Week 1: Setup & Baseline ✅ YOU ARE HERE
- [x] Run test suite
- [x] Generate training scenarios
- [ ] Understand brand voice rules
- [ ] Review few-shot examples

**Action**: Spend 2 hours reviewing the code you just created. Understand how it works.

---

### Week 2: Data Collection

**Goal**: Collect 50 outfit images

**Where to Find Free Images**:
- Unsplash: https://unsplash.com/s/photos/outfit
- Pexels: https://www.pexels.com/search/fashion/
- Pinterest (reference only, don't use without permission)

**What to Collect**:
- 10 date night outfits
- 10 work/interview outfits
- 10 casual/weekend outfits
- 10 formal/wedding outfits
- 10 edge cases (patterns, cultural, unconventional)

**Save them as**:
```
training-data/
  date-night/
    image-1.jpg
    image-2.jpg
  work/
    image-1.jpg
  ...
```

**Action**: 1 hour/day image collection = 50 images by end of week

---

### Week 3-4: Manual Feedback Curation

**Goal**: Write exemplary feedback for each image

**Process**:
1. Open an image
2. Write feedback following Or This? brand voice
3. Validate with brand voice validator
4. Save in JSON format

**Template**:
```typescript
{
  "imageId": "date-night-001",
  "imagePath": "training-data/date-night/image-1.jpg",
  "outfit": {
    "description": "Burgundy wrap dress, nude heels, clutch",
    "items": ["wrap dress", "heels", "clutch"]
  },
  "context": {
    "occasion": "dinner date",
    "setting": "upscale restaurant",
    "vibe": "romantic"
  },
  "expertFeedback": {
    "overallScore": 8.5,
    "criteriaScores": { fit: 9, color: 8, occasion: 9, cohesion: 8, confidence: 9 },
    "summary": "Absolutely stunning date night look!",
    "whatsWorking": [
      "The wrap dress creates a gorgeous silhouette",
      "Burgundy is perfect for evening",
      "Accessories are elegant and understated"
    ],
    "consider": [
      "Add gold jewelry for extra sparkle"
    ],
    "quickFixes": [
      "Delicate gold necklace would be perfect",
      "Consider a red lip to tie it all together",
      "Bring a light shawl if it gets cool"
    ]
  }
}
```

**Script to Help**:
```typescript
// scripts/curate-feedback.ts
import { brandVoiceValidator } from '../src/validators/brand-voice-validator.js';
import { validateFeedbackTemplate } from '../src/templates/feedback-template.js';

const feedback = { /* your feedback */ };

// Validate template
const templateCheck = validateFeedbackTemplate(feedback);
console.log('Template valid:', templateCheck.isValid);

// Validate brand voice
const text = [
  feedback.summary,
  ...feedback.whatsWorking,
  ...feedback.consider,
  ...feedback.quickFixes
].join(' ');

const voiceCheck = brandVoiceValidator.validate(text);
console.log('Brand voice score:', voiceCheck.score, '/100');
console.log('Issues:', voiceCheck.issues);
```

**Action**: Curate 5 images/day = 50 images in 2 weeks

---

### Week 5: First AI Test

**Goal**: Test current AI against your ground truth

**Setup Your AI Integration**:

```typescript
// test-ai.ts
import { buildEnhancedSystemPrompt, buildOutfitAnalysisPrompt } from './src/lib/ai-integration-helper.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

async function testAIFeedback(imageData: any) {
  const systemPrompt = buildEnhancedSystemPrompt(imageData.context);
  const userPrompt = buildOutfitAnalysisPrompt(
    imageData.outfit.description,
    imageData.context
  );

  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-exp",
    systemInstruction: systemPrompt,
  });

  const result = await model.generateContent(userPrompt);
  const response = JSON.parse(result.response.text());

  return response;
}

// Compare AI score to your expert score
const yourData = require('./training-data/curated-feedback.json');

for (const item of yourData) {
  const aiResponse = await testAIFeedback(item);
  const difference = Math.abs(aiResponse.overallScore - item.expertFeedback.overallScore);

  console.log(`${item.imageId}: AI=${aiResponse.overallScore}, Expert=${item.expertFeedback.overallScore}, Diff=${difference}`);
}
```

**Success Criteria**:
- 80%+ of responses within ±1 point of your score
- 90%+ pass brand voice validation

**Action**: Run full test suite, document results

---

### Week 6: Iterate & Improve

**Goal**: Fix issues found in Week 5

**Common Issues & Fixes**:

**Issue**: AI scores too high/low
**Fix**: Add score calibration examples to prompt
```typescript
// Add to system prompt:
"Here are example scores:
- 9-10: Magazine-worthy, minimal changes needed
- 7-8: Great with minor tweaks
- 5-6: Good foundation, needs adjustments
- 3-4: Several issues to address"
```

**Issue**: AI uses prohibited phrases
**Fix**: Add explicit prohibition to prompt
```typescript
"NEVER use these phrases: 'not flattering', 'wrong', 'should probably change'"
```

**Issue**: AI too generic
**Fix**: Add more few-shot examples with specific details

**Issue**: AI inconsistent
**Fix**: Add temperature=0.3 (or lower) to your AI calls

**Action**: Iterate prompt, re-test, measure improvement

---

### Week 7: Beta Testing

**Goal**: Test with real humans

**Setup**:
1. Deploy a simple test UI
2. Invite 10-20 friends
3. Ask them to:
   - Upload outfit photo
   - Get AI feedback
   - Rate it 1-5 stars
   - Leave comments

**Collect**:
- Average rating (target: > 4.0/5.0)
- Common complaints
- Offensive/inappropriate responses (should be 0!)
- Edge cases that failed

**Action**: Run beta for 3-5 days, collect data, fix issues

---

### Week 8: Final Validation

**Goal**: Ensure all metrics pass before launch

**Checklist**:

```bash
# Run full test suite
npm run test:model

# Check all metrics
```

**Target Metrics**:
- [ ] Consistency: Variance < 0.5 ✅
- [ ] Brand Voice: > 95% pass rate ✅
- [ ] Accuracy: > 80% within ±1 point ✅
- [ ] Specificity: > 90/100 ✅
- [ ] Actionability: > 85/100 ✅
- [ ] Beta Rating: > 4.0/5.0 ✅
- [ ] Zero offensive responses ✅

**Action**: Fix any failing metrics, re-test until all pass

---

## 🎯 Launch Day Checklist

Before you launch:

- [ ] All 8 metrics passing
- [ ] Beta testing complete with positive feedback
- [ ] No known offensive/inappropriate responses
- [ ] Prompt documented and version-controlled
- [ ] Monitoring/logging set up for production
- [ ] Fallback plan if AI fails (show cached example response)
- [ ] Rate limiting configured (prevent API cost explosions)

---

## 📊 Production Monitoring

After launch, track these weekly:

```typescript
// Monitor these metrics in production
{
  "weeklyMetrics": {
    "averageUserRating": 4.2,  // From user feedback
    "responseTime": "2.3s",    // API latency
    "errorRate": "0.5%",       // Failed responses
    "brandVoiceScore": 94,     // Automated validation
    "costPerAnalysis": "$0.02" // API costs
  }
}
```

Set up alerts:
- User rating drops below 4.0 → investigate
- Error rate > 2% → check logs
- Cost per analysis > $0.05 → optimize prompt
- Brand voice score < 90 → audit responses

---

## 🛠️ Tools & Resources

**Testing**:
```bash
npm run test:model              # Full test suite
npm run generate:training-data  # Create scenarios
npm run test:brand-voice        # Quick voice check
```

**Files to Know**:
- `src/prompts/outfit-analysis.prompt.ts` - Main AI prompt
- `src/validators/brand-voice-validator.ts` - Voice checker
- `src/data/few-shot-examples.ts` - Example feedback
- `src/knowledge/style-rules.ts` - Fashion knowledge
- `AI_TRAINING_README.md` - Full documentation

**Get Help**:
- Review few-shot examples for inspiration
- Check brand guidelines for voice questions
- Test individual responses with brand voice validator
- Compare to training scenarios for edge cases

---

## ⚡ Quick Commands

```bash
# Test if a response is good
echo "Your feedback text" | tsx -e "
import { brandVoiceValidator } from './src/validators/brand-voice-validator.js';
import fs from 'fs';
const text = fs.readFileSync(0, 'utf-8');
const result = brandVoiceValidator.validate(text);
console.log('Score:', result.score, 'Valid:', result.isValid);
"

# Generate training data
npm run generate:training-data

# Run full tests
npm run test:model
```

---

**You're ready to start! Begin with Week 1 tasks today.** 🚀
