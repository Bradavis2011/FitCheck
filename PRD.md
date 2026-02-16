# Product Requirements Document: FitCheck
## Real-Time Outfit Feedback App

**Version:** 1.0  
**Date:** January 29, 2026  
**Author:** Brandon [Last Name]  
**Status:** Draft for Review

---

## Executive Summary

FitCheck is a mobile application that provides women with instant, personalized outfit feedback before they leave the house. Users record or photograph themselves in an outfit and receive real-time critiques and styling advice. The app uses AI to bootstrap instant feedback, transitioning to community and expert human feedback as the user base grows.

### Core Value Proposition
"Never leave the house wondering if your outfit works. Get instant, honest feedback in 30 seconds."

### Key Differentiator
Unlike existing AI styling apps that focus on wardrobe management and shopping recommendations, FitCheck solves the **moment-of-decision problem**: "I'm dressed and about to leave—does this actually look good?"

---

## Problem Statement

### The Pain Point
Women frequently face the "outfit anxiety" moment—standing in front of a mirror, unsure if their outfit works for the occasion, fit looks right, or colors coordinate properly. Current solutions are inadequate:

| Current Solution | Why It Fails |
|-----------------|--------------|
| Ask a friend/partner | Not always available; may not be honest; interrupts their day |
| Reddit (r/fashionadvice, r/femalefashionadvice) | Too slow (hours/days for feedback); public posting feels vulnerable; dominated by younger demographics |
| Instagram/TikTok Live | Requires existing following; attracts unwanted attention from men; feedback is shallow |
| AI Styling Apps (Fits, Style DNA, etc.) | Focus on wardrobe organization and shopping, not real-time "does this look good?" feedback |
| Human Stylists | $100-250/session; appointment-based; overkill for daily outfit decisions |

### Market Validation
- r/malefashionadvice has been active since 2009 with millions of users posting outfit photos for feedback
- r/femalefashionadvice and related subreddits show consistent demand for human outfit opinions
- The Virtual Personal Styling Services market is $4.5B in 2024, growing at 20% CAGR
- AI-Based Personalized Stylist market projected to reach $2.8B by 2034 at 36.5% CAGR
- US retailers saw $890B in returns in 2024—much driven by "doesn't look right on me" regret

### Target User
**Primary:** Women 25-45 who:
- Care about their appearance but aren't fashion experts
- Have disposable income but not for personal stylists
- Experience regular "outfit anxiety" moments
- Are comfortable with technology but time-constrained

**Secondary:** 
- Professional women needing confidence for meetings/presentations
- Women dating who want to make good impressions
- Anyone preparing for events (interviews, dates, weddings, etc.)

---

## Product Vision

### Phase 1: AI Bootstrap (Months 1-6)
Launch with AI-powered instant feedback. Users don't know (or care) it's AI—they just get helpful, fast feedback.

### Phase 2: Community Growth (Months 6-12)
Introduce peer feedback system. Users can earn rewards for giving quality feedback to others. AI handles overflow and maintains response time SLA.

### Phase 3: Expert Tier (Months 12+)
Add professional stylists as premium tier. Three-tier system:
- **Free:** AI feedback (limited per day)
- **Plus:** Community + AI feedback (unlimited)
- **Pro:** Expert stylists + Community + AI (priority response)

---

## Feature Requirements

### MVP Features (Phase 1)

#### 1. Outfit Capture
**Priority:** P0 (Must Have)

| Requirement | Details |
|-------------|---------|
| Photo capture | Single full-body photo with guidance overlay for optimal framing |
| Video capture | 5-15 second video showing front, side, back views |
| Gallery upload | Import existing photos from camera roll |
| Guidance UI | On-screen silhouette guide for proper positioning |
| Lighting detection | Alert user if lighting is poor |

**Acceptance Criteria:**
- Camera opens in < 1 second
- Capture to feedback initiation in < 2 seconds
- Works in portrait orientation
- Supports front and rear camera

#### 2. Context Input
**Priority:** P0 (Must Have)

Before getting feedback, user provides context:

| Context Field | Options | Required |
|--------------|---------|----------|
| Occasion | Work, Casual, Date, Event, Interview, Other | Yes |
| Setting | Indoor, Outdoor, Mixed | No |
| Weather | Hot, Warm, Cool, Cold | No |
| Vibe/Goal | Professional, Trendy, Classic, Relaxed, Sexy, Elegant | No |
| Specific concerns | Free text: "worried about the color combo" | No |

**UX Note:** Make this fast—2-3 taps maximum for basic submission.

#### 3. AI Feedback Engine
**Priority:** P0 (Must Have)

AI analyzes the outfit and provides structured feedback:

**Feedback Structure:**
```
Overall Score: 8/10 ⭐

✅ What's Working:
- The color palette is cohesive (navy + cream = classic)
- Silhouette flatters your frame
- Accessories are proportional

⚠️ Consider:
- The hem length may be challenging for sitting (event context)
- Adding a third color accent could elevate this

💡 Quick Fixes:
- Try cuffing the sleeves once for a more relaxed vibe
- A statement earring would add polish

🎯 Verdict: Perfect for [occasion]. Go with confidence!
```

**AI Analysis Dimensions:**
1. Color coordination and harmony
2. Fit and silhouette appropriateness
3. Occasion appropriateness
4. Proportion and balance
5. Style cohesion
6. Seasonal/weather appropriateness (if provided)

**Technical Requirements:**
- Response time: < 10 seconds from submission
- Confidence scoring for AI to flag uncertain assessments
- Fallback responses for edge cases (costume, uniform, etc.)

#### 4. Follow-Up Interaction
**Priority:** P1 (Should Have)

After initial feedback, user can:
- Ask clarifying questions ("What earrings would you suggest?")
- Request alternative suggestions ("What if I swapped the shoes?")
- Get specific item recommendations (with affiliate links)

**Limit:** 3 follow-ups per outfit check on free tier

#### 5. Outfit History
**Priority:** P1 (Should Have)

- Save past outfit checks with feedback
- Tag favorites
- Track what worked for which occasions
- "Wear again" reminders

#### 6. User Profile & Preferences
**Priority:** P1 (Should Have)

- Style preferences (classic, trendy, minimalist, etc.)
- Body type self-identification (for better fit feedback)
- Color season (optional: warm/cool/neutral)
- Comfort zones (e.g., "I never wear patterns")

---

### Phase 2 Features (Community)

#### 7. Community Feedback
**Priority:** P0 for Phase 2

Users can opt to get feedback from other community members.

**Submission Flow:**
1. User submits outfit
2. Gets instant AI feedback
3. Can optionally "request community feedback"
4. Outfit enters queue for community review
5. Multiple community members provide ratings/comments
6. User gets aggregated community verdict

**Giving Feedback:**
- Users earn points for giving quality feedback
- Simple rating UI: 👍 Works / 🤔 Almost / 👎 Needs Work
- Optional: Written comment
- Time limit: 60 seconds to respond (keeps it snappy)

**Quality Control:**
- Users rate helpfulness of feedback received
- Low-quality feedback givers lose visibility
- High-quality feedback givers get "Trusted Reviewer" status

#### 8. Gamification System
**Priority:** P1 for Phase 2

| Element | Details |
|---------|---------|
| Points | Earn for giving feedback, receiving helpful votes |
| Levels | Style Newbie → Fashion Friend → Style Expert → Fashion Icon |
| Badges | "Early Riser" (first feedback of day), "Streak" (7 days), "Helpful" (50 helpful votes) |
| Leaderboards | Weekly top feedback givers |
| Rewards | Higher levels unlock features: more daily checks, priority queue, exclusive content |

#### 9. Privacy Controls
**Priority:** P0 for Phase 2

| Setting | Options |
|---------|---------|
| Face visibility | Show / Blur / Crop above neck |
| Who can see | AI only / Trusted reviewers only / All community |
| Data retention | Auto-delete after 24h / 7d / 30d / Keep forever |
| Screenshot prevention | Enable / Disable (warn only) |

---

### Phase 3 Features (Expert Tier)

#### 10. Expert Stylist Marketplace
**Priority:** P0 for Phase 3

- Verified professional stylists available for premium feedback
- Stylist profiles with specialties (workwear, evening, petite, etc.)
- Booking for async review (within 2 hours) or live video chat
- Rating system for stylists

**Stylist Compensation:**
- Stylists set their own rates
- Platform takes 20-30% commission
- Minimum response time SLA

#### 11. Style Report (Premium)
**Priority:** P1 for Phase 3

Monthly/quarterly analysis:
- Your most successful outfit patterns
- Colors that work best for you
- Occasions you dress best/worst for
- Personalized shopping recommendations

---

## Monetization Strategy

### Tier Structure

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0 | 3 AI feedback checks/day, basic analysis, ads |
| **Plus** | $4.99/mo | Unlimited AI checks, community feedback, no ads, outfit history |
| **Pro** | $14.99/mo | Everything in Plus + 5 expert reviews/month, priority queue, style reports |
| **Expert Sessions** | $15-50/session | A la carte expert stylist consultations |

### Additional Revenue Streams

1. **Affiliate/Shopping Integration**
   - AI suggests specific items → links to purchase
   - Commission on referred sales (typically 5-15%)
   
2. **Brand Partnerships**
   - Sponsored styling tips
   - "Try this brand" recommendations
   - Must be clearly labeled as sponsored

3. **Data Insights (B2B)**
   - Aggregate, anonymized trend data to fashion retailers
   - "What are women struggling with?" insights

---

## Success Metrics

### North Star Metric
**Weekly Active Users (WAU) who receive feedback they rate as "helpful"**

### Primary Metrics

| Metric | Target (Month 6) | Target (Month 12) |
|--------|------------------|-------------------|
| Monthly Active Users (MAU) | 50,000 | 250,000 |
| Daily outfit checks | 10,000 | 75,000 |
| AI feedback helpfulness rating | >4.0/5 | >4.2/5 |
| D7 retention | 30% | 40% |
| D30 retention | 15% | 25% |

### Secondary Metrics
- Time to feedback (target: <10 seconds for AI)
- Session duration (target: 2-4 minutes)
- Conversion to paid tier (target: 5% of MAU)
- Community feedback response rate
- NPS score (target: >50)

---

## Technical Requirements

### Performance
- App launch to camera ready: <2 seconds
- Photo/video upload: <3 seconds on 4G
- AI feedback generation: <10 seconds
- 99.5% uptime

### Security & Privacy
- End-to-end encryption for all images
- GDPR/CCPA compliant
- Biometric authentication option
- Images stored in user's preferred region
- Clear data deletion process

### Platform Support
- iOS 15+ (initial launch)
- Android 12+ (Phase 2)
- Mobile web (Phase 3, limited features)

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| AI feedback quality insufficient | Medium | High | Extensive prompt engineering; human review of AI outputs; user feedback loop |
| Users feel AI is "fake" | Medium | Medium | Frame as "instant AI feedback" not fake humans; transparency |
| Community feedback becomes toxic | Medium | High | Strong moderation; face blur default; quality scoring |
| Cold start—no community to give feedback | High | High | AI bootstrap phase; incentivize early adopters heavily |
| Competition from established players | Medium | Medium | Focus on speed/simplicity vs. feature bloat; niche positioning |
| Privacy concerns deter signups | Medium | Medium | Privacy-first design; face blur; local processing options |

---

## Go-to-Market Strategy

### Launch Strategy
1. **Private Beta (4 weeks):** 500 users from fashion subreddits, Instagram
2. **Public Beta (8 weeks):** ProductHunt launch, TikTok creator partnerships
3. **Full Launch:** Paid marketing, influencer partnerships

### Channel Strategy
- TikTok: "FitCheck" trend integration
- Instagram: Before/after transformations
- Reddit: Organic community building in fashion subs
- Podcasts: Women-focused lifestyle shows

### Positioning
"Your honest friend in your pocket, available 24/7."

---

## Timeline

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| **Phase 1: MVP** | 12 weeks | Core app with AI feedback, basic profile, outfit history |
| **Phase 2: Community** | 8 weeks | Peer feedback, gamification, privacy controls |
| **Phase 3: Expert** | 8 weeks | Stylist marketplace, premium tiers, style reports |

### MVP Milestone Breakdown

| Week | Focus |
|------|-------|
| 1-2 | Technical architecture, AI integration setup |
| 3-4 | Camera/upload flow, context input UI |
| 5-6 | AI feedback engine, response formatting |
| 7-8 | User profiles, outfit history |
| 9-10 | Polish, testing, prompt refinement |
| 11-12 | Beta launch, iteration based on feedback |

---

## Open Questions

1. **Branding:** "FitCheck" is catchy but may be confused with fitness. Alternatives?
   - StyleCheck
   - OutfitAI
   - MirrorCheck
   - GetDressed
   - ClosetCheck

2. **Face handling:** Default to blur, show, or let user choose per submission?

3. **Minimum viable community size:** How many active feedback-givers needed before community mode feels alive?

4. **Expert stylist recruitment:** How do we onboard initial stylists? Partnerships with fashion schools?

5. **International expansion:** Should we launch US-only or include UK/EU from start?

---

## Appendix A: Competitive Landscape

| Competitor | Focus | Gap We Fill |
|------------|-------|-------------|
| Fits | Digital wardrobe + AI styling | Not real-time "does this look good" |
| Style DNA | Color analysis + shopping | No outfit feedback |
| Combyne | Outfit collages + community | Not real-time; shopping-focused |
| Stitch Fix | Subscription box + stylists | Too slow; shopping-focused |
| Indyx | Human stylists + wardrobe | Expensive ($25+/session); not instant |

---

## Appendix B: AI Prompt Strategy (Summary)

The AI feedback engine will use a multi-prompt approach:

1. **Vision Analysis Prompt:** Analyze image for clothing items, colors, fit, proportions
2. **Context Integration Prompt:** Combine visual analysis with user's stated occasion/goals
3. **Feedback Generation Prompt:** Generate structured, actionable, encouraging feedback
4. **Follow-up Prompt:** Handle clarifying questions with context from initial analysis

Key prompt principles:
- Always be constructive, never harsh
- Be specific ("the blue complements your skin tone") not vague ("looks nice")
- Give actionable suggestions ("try cuffing the sleeves") not just criticism
- Acknowledge user's stated concerns explicitly
- Vary response style to feel less robotic

---

## Appendix C: Sample User Flows

### Flow 1: First-Time User
1. Download app → Onboarding (3 screens)
2. Quick profile setup (skip most, add later)
3. Prompted to try first outfit check
4. Camera opens with guidance
5. Capture → Quick context (occasion only)
6. AI feedback in <10 seconds
7. Prompt to save, try another, or upgrade

### Flow 2: Returning User (Routine Check)
1. Open app → Camera opens immediately
2. Capture (knows the drill)
3. Quick context selection (remembers last occasion)
4. Feedback
5. Optional: Request community input
6. Save or discard

### Flow 3: Event Prep (Power User)
1. Open app → Select "Event Prep" mode
2. Input event details (wedding, evening, outdoor)
3. Check multiple outfits in succession
4. Compare feedback across options
5. Get "Winner" recommendation
6. Save winning outfit with occasion tag

---

*End of PRD*
