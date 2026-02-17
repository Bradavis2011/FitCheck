# Agent Automation Plan — Or This?

A plan for deploying discrete AI agents to automate core business processes, reduce manual overhead, and scale operations without scaling headcount.

---

## Architecture Overview

Each agent is a standalone process that runs on a schedule or in response to events. They share the same Postgres database and can call external APIs (Gemini, Clerk, RevenueCat, Expo Push). They are designed to be deployed as Railway cron services, serverless functions (Vercel/AWS Lambda), or long-running workers alongside the main API.

```
┌─────────────────────────────────────────────────────┐
│                    Event Sources                     │
│  Database triggers · Cron schedules · Webhooks       │
└──────────┬──────────────────────────────┬───────────┘
           │                              │
     ┌─────▼──────┐              ┌────────▼────────┐
     │  Moderation │              │  Calibration    │
     │  Agent      │              │  Agent          │
     └─────┬──────┘              └────────┬────────┘
           │                              │
     ┌─────▼──────┐              ┌────────▼────────┐
     │  Retention  │              │  Support        │
     │  Agent      │              │  Agent          │
     └─────┬──────┘              └────────┬────────┘
           │                              │
     ┌─────▼──────┐              ┌────────▼────────┐
     │  Community  │              │  Growth         │
     │  Quality    │              │  Agent          │
     └─────┬──────┘              └────────┬────────┘
           │                              │
     ┌─────▼──────┐              ┌────────▼────────┐
     │  Stylist    │              │  Revenue        │
     │  Matching   │              │  Intelligence   │
     └────────────┘              └─────────────────┘
```

---

## Agent 1: Content Moderation Agent

**Problem:** Reports go into the `reports` table with `status: "pending"` but nothing processes them. As the community grows, unreviewed reports become a liability (App Store policy, legal exposure, user trust).

**What it does:**
- Runs every 5 minutes, pulls all `pending` reports
- For `targetType: "outfit"` — fetches the image and runs it through a vision model to check for nudity, violence, hate symbols, or non-outfit content (e.g., screenshots, memes)
- For `targetType: "user"` — checks the reported user's recent activity (spam patterns, mass low-scoring, abusive comments)
- Auto-resolves clear-cut cases (obvious NSFW → hide outfit + notify user; obvious spam → shadowban)
- Escalates ambiguous cases by flagging them as `status: "needs_review"` and sending you a Slack/email digest

**Implementation:**

```
Schedule:    */5 * * * * (every 5 minutes)
Input:       SELECT * FROM reports WHERE status = 'pending'
AI Model:    Gemini 2.0 Flash (vision) for image review
             Gemini 2.0 Flash (text) for comment/behavior analysis
Actions:     - Update report status
             - Soft-delete flagged outfits (isDeleted = true)
             - Send notification to reported user with reason
             - Send digest to admin (you) via email/Slack webhook
Cost:        ~$0.01 per report (one vision call + one text call)
```

**Decision matrix:**

| Signal | Confidence | Action |
|--------|-----------|--------|
| NSFW image detected | High (>90%) | Auto-hide outfit, notify user, resolve report |
| Spam comment pattern | High | Shadowban user (hide their feedback from others) |
| Non-outfit image | Medium | Auto-hide, notify user to resubmit |
| Ambiguous content | Low | Flag as `needs_review`, include in admin digest |
| False report (content is fine) | High | Resolve report, no action on target |

**Database changes needed:**
- Add `status: "needs_review"` as valid report status
- Add `moderationReason` text field to Report model
- Add `isShadowbanned` boolean to User model

---

## Agent 2: AI Calibration Agent

**Problem:** The `CalibrationSnapshot` model exists but nothing populates it. Over time, AI scores may drift from what the community considers accurate. If AI consistently scores 8/10 on outfits the community rates 5/10, user trust erodes.

**What it does:**
- Runs daily at 2 AM
- Queries all outfits from the past week that have both an AI score and 3+ community ratings
- Calculates the delta (AI score minus community average) and Pearson correlation
- Stores a `CalibrationSnapshot` record for the period
- If the delta exceeds a threshold (e.g., AI scores 1.5+ points higher than community on average), it generates a prompt adjustment recommendation
- Sends a weekly calibration report to you

**Implementation:**

```
Schedule:    0 2 * * * (daily at 2 AM)
Input:       outfit_checks WHERE community_score_count >= 3
             AND ai_processed_at > NOW() - INTERVAL '7 days'
AI Model:    None for data collection; Gemini for generating prompt tweaks
Actions:     - Insert CalibrationSnapshot record
             - If drift detected, generate suggested prompt modifications
             - Email weekly calibration report
Cost:        ~$0.00 for data aggregation, ~$0.01 for prompt analysis (once/week)
```

**Alert thresholds:**

| Metric | Yellow | Red |
|--------|--------|-----|
| Avg delta (AI - community) | > 1.0 | > 2.0 |
| Correlation coefficient | < 0.6 | < 0.4 |
| Sample size | < 20/week | < 5/week |

**Output example:**
```
Weekly Calibration Report — 2026-W08
  Sample size: 147 outfits
  Avg AI score: 7.2
  Avg community score: 6.8
  Delta: +0.4 (within tolerance)
  Correlation: 0.72 (good)
  Recommendation: No prompt changes needed.
```

---

## Agent 3: Retention & Re-engagement Agent

**Problem:** Users churn silently. No system detects a user going cold or intervenes before they unsubscribe.

**What it does:**
- Runs daily at 10 AM
- Identifies at-risk users based on behavioral signals:
  - Haven't opened the app in 3 days (streak about to break)
  - Haven't submitted an outfit in 7 days
  - Subscription renewing in 3 days but usage dropped 50%+
  - Completed onboarding but never submitted first outfit
- Sends targeted push notifications via the existing Expo push system
- Tracks which messages were sent to avoid spamming (max 1 retention push per user per 3 days)

**Implementation:**

```
Schedule:    0 10 * * * (daily at 10 AM)
Input:       Users table + UserStats + OutfitCheck activity
AI Model:    Gemini (text) to personalize message copy based on user's style profile
Actions:     - Send push notification via existing notification service
             - Log notification with type: "retention"
             - Track send timestamps to enforce cooldown
Cost:        ~$0.005 per personalized message, ~$0 for template messages
```

**Message templates by trigger:**

| Trigger | Message |
|---------|---------|
| Streak about to break (3 days inactive) | "Your {X}-day streak is about to end! Quick outfit check to keep it going?" |
| First outfit never submitted | "Still thinking about it? Your first outfit check takes 30 seconds." |
| Subscription renewal + low usage | "You've got unlimited checks — try one before your next billing date!" |
| 7 days no outfit | "Missing your style updates! What are you wearing today?" |
| High-scorer gone quiet | "The community loved your last fit ({score}/10). Show them what's next!" |

---

## Agent 4: Community Quality Agent

**Problem:** As the community scales, low-effort feedback ("nice", "cool", "7") degrades the experience. Currently there's no automated quality enforcement — only passive incentives (helpful votes, badges).

**What it does:**
- Runs in near-real-time (triggered after each new `CommunityFeedback` insert, or as a batch every 10 minutes)
- Scores each piece of feedback on quality (length, specificity, actionability)
- Low-quality feedback gets deprioritized in display order (not deleted)
- Repeat low-quality contributors get a gentle coaching notification
- Chronic low-quality contributors get feedback-submission rate-limited

**Implementation:**

```
Schedule:    */10 * * * * (every 10 minutes, batch)
             OR event-driven via database trigger/webhook
Input:       New CommunityFeedback records since last run
AI Model:    Gemini 2.0 Flash (text) — classify feedback quality
Actions:     - Tag feedback with quality score (1-5)
             - If quality < 2, mark as deprioritized
             - If user has 5+ low-quality feedbacks in a row,
               send coaching notification
             - Update UserStats with quality metrics
Cost:        ~$0.002 per feedback classification
```

**Quality scoring criteria:**

| Factor | Weight | Example (high) | Example (low) |
|--------|--------|----------------|---------------|
| Specificity | 40% | "The navy blazer pairs well with those chinos — the color contrast is clean" | "looks good" |
| Actionability | 30% | "Try rolling the sleeves to balance the proportions" | "maybe change shoes" |
| Length (20+ words) | 15% | Full sentence | Single word |
| Relevance to outfit | 15% | References visible garments | Generic praise |

**Database changes needed:**
- Add `qualityScore` integer (1-5) to CommunityFeedback model
- Add `feedbackQualityAvg` float to UserStats model

---

## Agent 5: Customer Support Agent

**Problem:** No support system exists. Users who hit issues have no way to get help except emailing, which requires manual responses.

**What it does:**
- Receives inbound support emails (via SendGrid/Postmark inbound webhook)
- Classifies the issue type (account, billing, bug report, feature request, abuse report)
- For common issues, auto-responds with a resolution:
  - "How do I delete my account?" → Link to privacy settings
  - "I was charged but can't access Plus" → Check RevenueCat status, trigger sync
  - "My outfit check is stuck" → Check for failed AI processing, trigger retry
- For complex issues, drafts a response for your approval before sending
- Logs all interactions in a support ticket table

**Implementation:**

```
Trigger:     Inbound email webhook (SendGrid/Postmark)
Input:       Email subject + body + sender email
AI Model:    Claude API (Haiku for classification, Sonnet for response drafting)
Actions:     - Classify issue
             - Auto-respond for known patterns
             - Draft response for unknown patterns
             - Create support ticket record
             - Escalate urgent issues via Slack/push
Cost:        ~$0.01-0.05 per ticket depending on complexity
```

**Auto-resolution patterns:**

| Pattern | Detection | Auto-Response |
|---------|-----------|---------------|
| Account deletion | Keywords: "delete", "remove account" | Link to Settings → Privacy → Delete Account |
| Billing dispute | Keywords: "charged", "refund", "subscription" | Check RevenueCat, provide status, link to App Store subscription management |
| Stuck analysis | Keywords: "loading", "stuck", "no feedback" | Look up user's latest outfit, trigger reanalysis if stuck >5 min |
| Password/login | Keywords: "can't log in", "password" | Link to Clerk password reset flow |
| Bug report | Keywords: "crash", "error", "broken" | Acknowledge, create ticket, ask for device/OS info |

**Database changes needed:**
- New `SupportTicket` model (id, userId, email, subject, body, status, category, response, createdAt, resolvedAt)

---

## Agent 6: Growth & Content Agent

**Problem:** App store optimization (ASO), social media presence, and content marketing all require consistent effort that's easy to neglect as a solo founder.

**What it does:**
- Runs weekly on Monday mornings
- Analyzes the past week's data: top-scoring outfits, trending styles, new user milestones, community activity
- Generates social media posts (Instagram captions, X/Twitter threads) highlighting trends
- Generates ASO keyword suggestions based on trending fashion terms in the community
- Drafts a weekly email newsletter for opted-in users with their personal stats + community highlights

**Implementation:**

```
Schedule:    0 9 * * MON (Monday 9 AM)
Input:       Aggregated data from OutfitCheck, StyleDNA, UserStats, CommunityFeedback
AI Model:    Claude Sonnet for long-form content generation
Actions:     - Generate 3-5 social media post drafts → save to a content queue table
             - Generate ASO keyword report
             - Draft weekly newsletter
             - Send all drafts to your email/Slack for review before publishing
Cost:        ~$0.10-0.20 per weekly run
```

**Content types generated:**

| Content | Format | Example |
|---------|--------|---------|
| Style trend recap | Instagram carousel caption | "This week's top-scoring looks all had one thing in common: tonal layering. Here's why it works..." |
| Community milestone | X/Twitter post | "Or This? community hit 1,000 outfit checks this week! The most popular occasion? Date night." |
| Style tip | Short-form video script | "3 quick fixes that boosted outfit scores by 2+ points this week" |
| ASO update | Internal report | "Rising search terms: 'outfit check app', 'AI fashion advice', 'what to wear today'" |

---

## Agent 7: Stylist Matching Agent (Phase 3)

**Problem:** The Pro tier promises expert stylist reviews but there's no system to match users with stylists, manage availability, or route requests.

**What it does:**
- When a Pro user requests an expert review, this agent finds the best available stylist
- Matches based on: stylist's specialty (casual, formal, streetwear), user's style profile, stylist availability, and past satisfaction ratings
- Assigns the review, notifies the stylist, and sets an SLA timer (24-hour response)
- If the stylist doesn't respond in time, auto-reassigns to the next best match
- Tracks stylist performance metrics (response time, user satisfaction, review quality)

**Implementation:**

```
Trigger:     Pro user submits outfit with "expert review" flag
Input:       User's StyleDNA, occasion, stylist roster + availability
AI Model:    Simple scoring algorithm (no LLM needed for matching)
             Gemini for quality-checking stylist responses before delivery
Actions:     - Score each available stylist for compatibility
             - Assign top match, send notification
             - Start 24-hour SLA timer
             - On timeout, reassign
             - After delivery, request user satisfaction rating
Cost:        ~$0.01 per match (quality check of stylist response)
```

**Database changes needed:**
- New `Stylist` model (id, userId, specialties, availability, avgRating, totalReviews)
- New `ExpertReview` model (id, outfitCheckId, stylistId, status, assignedAt, dueAt, completedAt, response, userRating)

---

## Agent 8: Revenue Intelligence Agent

**Problem:** RevenueCat events are logged in `SubscriptionEvent` but nobody analyzes them. You're flying blind on conversion rates, churn patterns, and revenue health.

**What it does:**
- Runs daily at 6 AM
- Calculates key business metrics from SubscriptionEvent + User tables:
  - MRR (monthly recurring revenue)
  - Churn rate (7-day rolling)
  - Trial-to-paid conversion rate
  - Average revenue per user (ARPU)
  - Cohort retention curves
- Detects anomalies (sudden spike in cancellations, billing failures)
- Sends a daily business health dashboard to your email/Slack

**Implementation:**

```
Schedule:    0 6 * * * (daily at 6 AM)
Input:       SubscriptionEvent, User tables
AI Model:    None for metrics; Gemini for anomaly explanation if detected
Actions:     - Calculate metrics
             - Compare to 7-day and 30-day averages
             - Flag anomalies (>2 standard deviations)
             - Send formatted daily report
Cost:        ~$0.00 (pure SQL aggregation + optional $0.01 for anomaly explanation)
```

**Daily report format:**

```
Or This? — Daily Business Health — Feb 17, 2026

Revenue
  MRR: $X,XXX (+X% vs last week)
  New subscribers: X (Plus: X, Pro: X)
  Churned: X
  Net: +X

Conversion
  Free → Plus: X.X%
  Free → Pro: X.X%
  Trial → Paid: X.X%

Engagement
  Daily active users: X,XXX
  Outfit checks today: X,XXX
  Community feedbacks: X,XXX
  Avg AI score: X.X

Alerts
  ⚠️  Billing failures up 40% vs 7-day avg (X failures)
  ✅  All other metrics within normal range
```

---

## Deployment Priority

Ordered by impact-to-effort ratio for a solo founder:

| Priority | Agent | Why First | Effort | Impact |
|----------|-------|-----------|--------|--------|
| **1** | Content Moderation | App Store requirement, legal liability, trust | Medium | Critical |
| **2** | Revenue Intelligence | Can't optimize what you don't measure | Low | High |
| **3** | Retention & Re-engagement | Directly impacts MRR via churn reduction | Medium | High |
| **4** | AI Calibration | Maintains core product quality | Low | High |
| **5** | Community Quality | Improves experience as community scales | Medium | Medium |
| **6** | Customer Support | Reduces manual support burden | Medium | Medium |
| **7** | Growth & Content | Marketing leverage, but not urgent pre-launch | Low | Medium |
| **8** | Stylist Matching | Phase 3 feature, not needed until Pro tier has users | High | Low (for now) |

---

## Tech Stack Recommendation

| Component | Tool | Why |
|-----------|------|-----|
| Agent runtime | Railway cron services | Already using Railway; simple to add workers |
| Scheduling | node-cron or Railway cron | No extra infrastructure |
| AI (vision + classification) | Google Gemini 2.0 Flash | Already integrated, cheap, fast |
| AI (long-form content) | Claude Sonnet API | Better at nuanced writing and analysis |
| AI (support classification) | Claude Haiku API | Cheapest for simple classification |
| Alerting | Slack webhook or email (SendGrid) | Zero-config, immediate |
| Monitoring | Sentry (already set up) | Catches agent failures |

---

## Estimated Monthly Cost at Scale

At 10,000 monthly active users:

| Agent | Frequency | Est. Monthly Cost |
|-------|-----------|-------------------|
| Content Moderation | ~500 reports/mo | $5 |
| AI Calibration | Daily | $1 |
| Retention | Daily, ~2,000 messages/mo | $10 |
| Community Quality | ~10,000 feedbacks/mo | $20 |
| Customer Support | ~200 tickets/mo | $5 |
| Growth & Content | Weekly | $1 |
| Revenue Intelligence | Daily | $0 |
| **Total** | | **~$42/mo** |

Compare this to hiring one part-time community manager ($2,000+/mo) or support agent ($1,500+/mo). The agents handle the volume while you handle the judgment calls.

---

## Getting Started

To build Agent 1 (Content Moderation) first:

1. Add the new database fields to the Prisma schema (`isShadowbanned`, `moderationReason`)
2. Create `fitcheck-api/src/agents/moderation.agent.ts`
3. Wire it up as a Railway cron service or a script triggered by `tsx`
4. Test with synthetic reports before enabling on production
5. Set up a Slack webhook for the escalation digest

Each agent follows the same pattern: **read state → make decision → take action → log result**. Start simple, monitor, and iterate.
