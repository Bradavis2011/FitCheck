# Product Requirements Document: Or This?
## AI-Powered Outfit Feedback App

**Version:** 2.0
**Date:** February 17, 2026
**Status:** Updated to reflect current build state
**Previous Version:** 1.0 (January 29, 2026) — original concept document

---

## Executive Summary

**Or This?** is a mobile application that gives women instant, honest outfit feedback at the exact moment they need it — standing in front of the mirror, about to leave the house.

The original concept (FitCheck, v1.0) described a 3-phase vision: AI bootstrap, community feedback, and expert stylists. That vision has been fully realized. **All three phases are built.** The product has been rebranded to "Or This?" — a name that captures the central user behavior: holding up an outfit and asking, *"or this one?"*

This is not a concept document. Or This? is a complete product ready for deployment.

### What's Been Built

A full-stack mobile application with:
- **37 app screens** covering the complete user journey
- **16 backend API domains** — auth, outfits, social, live streaming, wardrobe, events, challenges, expert reviews, and more
- **3-tier subscription model** with tier enforcement throughout (RevenueCat + backend validation)
- **Live streaming** for real-time outfit feedback from the community (LiveKit/WebRTC)
- **Expert stylist marketplace** — apply, get verified, request paid reviews
- **Wardrobe management** and outfit builder
- **Event planning mode** with AI-powered outfit comparison (Gemini)
- **Community features** — feed, A/B comparisons, challenges with voting, leaderboard
- **Full gamification** — XP, levels, streaks, badges, give-to-get feedback system
- **Privacy controls** — face blur, visibility tiers, auto-delete
- **Google Mobile Ads** for free tier monetization

### Core Value Proposition

> "Never leave the house wondering if your outfit works. Get instant, honest feedback in 30 seconds."

**Tagline:** Confidence in every choice.

### Key Differentiator

Unlike AI styling apps that focus on wardrobe management and shopping recommendations, Or This? solves the **moment-of-decision problem**: "I'm dressed and about to leave — does this actually look good?" It's the only app combining instant AI feedback with community validation, live streaming, and professional stylist access in one product.

---

## Problem Statement

### The Pain Point

Women frequently face the "outfit anxiety" moment — standing in front of a mirror, unsure if their outfit works for the occasion, if the fit looks right, or if the colors coordinate. Current solutions are inadequate:

| Current Solution | Why It Fails |
|-----------------|--------------|
| Ask a friend/partner | Not always available; may not be honest; interrupts their day |
| Reddit (r/fashionadvice, r/femalefashionadvice) | Hours/days for feedback; public posting feels vulnerable; dominated by younger demographics |
| Instagram/TikTok Live | Requires existing following; attracts unwanted attention; shallow feedback |
| AI Styling Apps (Fits, Style DNA, etc.) | Focus on wardrobe organization and shopping — not "does this look good right now?" |
| Human Stylists | $100–250/session; appointment-based; overkill for daily outfit decisions |

### Market Validation

- r/malefashionadvice and r/femalefashionadvice have millions of users posting outfit photos for feedback — organic demand proven at scale
- The Virtual Personal Styling Services market was $4.5B in 2024, growing at 20% CAGR
- AI-Based Personalized Stylist market projected to reach $2.8B by 2034 at 36.5% CAGR
- US retailers saw $890B in returns in 2024 — much driven by "doesn't look right on me" regret
*(Market data sourced from 2024 reports)*

### Target User

**Primary:** Women 25–45 who:
- Care about their appearance but aren't fashion experts
- Have disposable income but not for personal stylists
- Experience regular outfit anxiety moments
- Are comfortable with technology but time-constrained

**Secondary:**
- Professional women needing confidence for meetings or presentations
- Women preparing for high-stakes events (interviews, dates, weddings)
- Fashion-forward users who want community validation and social engagement

### Competitive Landscape

| Competitor | Focus | What We Do Better |
|------------|-------|-------------------|
| Fits | Digital wardrobe + AI styling | Real-time "does this work?" feedback; live community |
| Style DNA | Color analysis + shopping | Outfit feedback, not just color seasons |
| Combyne | Outfit collages + community | AI feedback, not just browsing; expert access |
| Stitch Fix | Subscription box + stylists | Instant feedback; no subscription box required |
| Indyx | Human stylists + wardrobe | 3 feedback modes in one app; significantly lower cost |

**Or This? is the only product combining instant AI, community, live streaming, and professional stylists in a single mobile experience.**

---

## What's Built — Product Overview

This section describes the actual, implemented product as of February 17, 2026.

### Core Experience

**Outfit Capture**
- In-app camera with full-body capture
- Gallery upload from camera roll
- Preview before submission

**Context Input**
- Occasion (Work, Casual, Date, Event, Interview, Other)
- Setting (Indoor, Outdoor, Mixed)
- Weather (Hot, Warm, Cool, Cold)
- Vibe/Goal (Professional, Trendy, Classic, Relaxed, Sexy, Elegant)
- Free-text concerns ("worried about the color combo")

**AI-Powered Feedback**
- GPT-4 Vision analysis of outfit image + context
- Structured output: Overall score, What's Working, Consider, Quick Fixes, Verdict
- Score display with color coding (≥8 green, ≥6 amber, <6 red)
- Follow-up conversation (3/5/10 per check depending on tier)

**Outfit History**
- Full history with filtering by occasion, favorites
- Outfit detail view with full feedback and conversation thread
- Favorites tagging

---

### Community & Social

**Community Feed**
- Browse recent, popular, and top-rated outfit posts
- Submit outfit to community for peer feedback
- Rating system with helpful/vote tracking

**"Or This?" A/B Comparisons**
- The signature feature: post two outfit options side-by-side
- Community votes on which works better
- Matches the brand name's core concept

**User Profiles & Social Graph**
- Public profiles with outfit history and stats
- Follow/unfollow, inner circles (trusted reviewer network)
- Content reporting and user blocking

**Leaderboard**
- Community ranking by style points and feedback quality

**Give-to-Get System**
- Free users earn bonus outfit checks by giving community feedback
- 1 bonus check per 3 feedbacks given per day

---

### Live Streaming

- **Browse active sessions** — find live outfit reviews in progress
- **Host a live session** (Plus/Pro only) — stream your outfit for real-time community feedback
- **Join/watch** — comment and rate outfits live
- Powered by LiveKit (WebRTC)

---

### Gamification & Engagement

- **Points & XP** — earned for outfit checks, feedback given, helpful votes received
- **Levels** — Style Newbie → Fashion Friend → Style Expert → Fashion Icon
- **Streaks** — daily check streaks with visual tracking
- **Daily Goals** — feedback targets with progress bars
- **Badges** — milestones for outfit submissions, feedback given, streaks, first actions
- **Challenges** — themed community style challenges with community voting and leaderboard

---

### Expert Stylist Marketplace

- **Apply to become a stylist** — submit bio, specialties, Instagram profile
- **Admin verification** — verified stylists appear in the marketplace
- **Request an expert review** (Pro tier — 5 included/month)
- **Review queue** — stylists work through their assigned reviews
- Stylist profiles with rating and review count

---

### Wardrobe Management

- **Wardrobe catalog** — add clothing items with name, color, category (tops, bottoms, shoes, accessories, outerwear)
- **Category filtering** — browse by clothing type
- **Wear logging** — track times worn and last worn date
- **Outfit Builder** — combine wardrobe items into virtual outfits by category slot

---

### Event Planning Mode (Pro)

- **Create events** — title, date, dress code, event type, notes
- **Attach outfit checks** to events from history
- **AI outfit comparison** — Gemini compares all attached outfits against the event context (dress code, type)
- Returns: winner, ranked options, styling tips
- Comparison results cached 24 hours to avoid redundant AI calls

---

### Style Analytics (Pro)

- Style DNA — personal style breakdown and pattern recognition
- Style evolution — trend tracking across outfit checks
- Personalized recommendations based on feedback history

---

### Privacy Controls

- **Face blur** — toggle per submission or set as default in settings
- **Visibility tiers** — public (all), followers only, trusted community members only
- **Auto-delete** — outfit checks automatically purged after 24h, 7d, or 30d
- Lazy purge at list load time — no cron job required

---

### Monetization Infrastructure

- **Google Mobile Ads** — interstitial (every 2nd check for free users) + banner ads
- **RevenueCat** — subscription management, entitlement validation
- **Tier enforcement** — backend validates tier on all gated endpoints, frontend gates UI

---

## Feature Inventory

| Feature | Free | Plus | Pro |
|---------|------|------|-----|
| AI outfit checks per day | 3 | Unlimited | Unlimited |
| Follow-ups per check | 3 | 5 | 10 |
| Outfit history | 7 days | Unlimited | Unlimited |
| Ads (interstitial + banner) | Yes | No | No |
| Priority AI processing | No | Yes | Yes |
| Community feedback (give + receive) | No | Yes | Yes |
| Live streaming (hosting) | No | Yes | Yes |
| Live streaming (watching) | Yes | Yes | Yes |
| "Or This?" A/B comparisons | No | Yes | Yes |
| Style challenges | View only | Full access | Full access |
| Give-to-get bonus checks | Yes | N/A | N/A |
| Wardrobe management | Yes | Yes | Yes |
| Outfit builder | Yes | Yes | Yes |
| Event planning mode | No | No | Yes |
| AI event outfit comparison | No | No | Yes |
| Expert stylist reviews/month | 0 | A la carte | 5 included |
| Style DNA / analytics | No | No | Yes |
| Privacy controls (full) | Basic | Full | Full |

---

## Tech Stack & Architecture

### Frontend
- **Framework:** Expo SDK 54 + React Native
- **Routing:** Expo Router (file-based, `app/` directory)
- **Auth:** Clerk (`@clerk/clerk-expo`)
- **State:** Zustand (global store) + React Query (server state)
- **Styling:** `StyleSheet.create()` — NativeWind v4 incompatible with Expo 54
- **Ads:** `react-native-google-mobile-ads` (Google Mobile Ads / AdMob)
- **Subscriptions:** RevenueCat (`react-native-purchases`)
- **Live:** `@livekit/react-native` v2.9.6 + `livekit-client` v2.17.1
- **Screens:** 37 routes (35 screens + 2 layout files)

### Backend
- **Runtime:** Node.js + Express + TypeScript
- **ORM:** Prisma
- **Database:** PostgreSQL (Railway)
- **Auth middleware:** JWT
- **API domains:** 16 (auth, outfits, social, user, comparison, live, challenges, wardrobe, events, expert-review, stylist, subscription, notification, push, trends, admin)

### AI & External Services
- **Outfit analysis:** OpenAI GPT-4 Vision
- **Event outfit comparison:** Google Gemini
- **Live streaming:** LiveKit (WebRTC, cloud-hosted)
- **Auth:** Clerk
- **Payments:** RevenueCat
- **Ads:** Google AdMob
- **Hosting:** Railway (backend + PostgreSQL)

---

## Monetization Strategy

### Subscription Tiers

| Tier | Price | Key Limits |
|------|-------|------------|
| **Free** | $0/month | 3 AI checks/day, 3 follow-ups/check, 7-day history, ads |
| **Plus** | $4.99/month | Unlimited checks, 5 follow-ups, unlimited history, ad-free, community, live streaming |
| **Pro** | $14.99/month | Everything in Plus, 10 follow-ups, 5 expert reviews/month, event planning, style analytics |

*Tier limits are enforced in `fitcheck-api/src/constants/tiers.ts` and validated on every gated API endpoint.*

### Additional Revenue Streams

1. **Expert Reviews (a la carte)** — Pro tier includes 5/month; additional reviews purchasable independently
2. **Affiliate/Shopping Integration** — AI suggests specific items with affiliate links (future)
3. **Brand Partnerships** — sponsored styling tips, clearly labeled (future)
4. **Data Insights (B2B)** — anonymized aggregate trend data to fashion retailers (future)

---

## Design System

### Brand Colors
| Name | Hex | Usage |
|------|-----|-------|
| Decision Coral | `#E85D4C` | Primary actions, highlights |
| Coral Light | `#FF7A6B` | Gradients, secondary accent |
| Coral Dark | `#C94A3A` | Pressed states |
| Confidence Cream | `#FBF7F4` | Background |
| Cream Dark | `#F5EDE7` | Card backgrounds |
| Clarity Black | `#1A1A1A` | Primary text |
| Charcoal | `#2D2D2D` | Secondary text |
| Soft Sage | `#A8B5A0` | Tertiary accent |
| Sage Light | `#C4CFBD` | Subtle backgrounds |

### Typography
- **Body:** DM Sans
- **Display/Headings:** Playfair Display Italic

### Logo
"Or" in DM Sans Medium + "This?" in Playfair Display Italic (coral) + oversized italic ? mark

### App Icon
White italic ? on coral gradient (`#E85D4C` → `#FF7A6B`)

### Score Colors
- ≥ 8: Green (`#10B981`)
- ≥ 6: Amber (`#F59E0B`)
- < 6: Red (`#EF4444`)

---

## Success Metrics

*These are launch targets. No production data exists yet.*

### North Star Metric
**Weekly Active Users (WAU) who receive outfit feedback they rate as "helpful"**

### Primary Metrics

| Metric | Target (Month 6) | Target (Month 12) |
|--------|------------------|-------------------|
| Monthly Active Users (MAU) | 50,000 | 250,000 |
| Daily outfit checks | 10,000 | 75,000 |
| AI feedback helpfulness rating | > 4.0/5 | > 4.2/5 |
| D7 retention | 30% | 40% |
| D30 retention | 15% | 25% |

### Secondary Metrics
- Time to AI feedback (target: < 10 seconds)
- Session duration (target: 2–4 minutes)
- Free-to-paid conversion (target: 5% of MAU)
- Challenge participation rate
- Live session engagement (viewers per session)
- A/B comparison vote rate
- Community feedback response rate
- NPS score (target: > 50)

---

## Go-to-Market Strategy

### Launch Strategy
1. **Private Beta (4 weeks):** 500 users from fashion subreddits, Instagram fashion communities
2. **Public Beta (8 weeks):** ProductHunt launch, TikTok creator partnerships
3. **Full Launch:** Paid marketing, influencer partnerships

### Channel Strategy
- **TikTok:** "Or This?" framing maps naturally to TikTok's "would you wear this?" content format — strong organic potential
- **Instagram:** Before/after outfit transformations; stylist marketplace as social proof
- **Reddit:** Organic community building in r/femalefashionadvice, r/malefashionadvice
- **Podcasts:** Women-focused lifestyle, fashion, and confidence shows

### Viral Growth Mechanisms
- **"Or This?" A/B comparisons** — shareable format designed for organic spread
- **Live outfit reviews** — time-limited, FOMO-driven community engagement
- **Challenge system** — themed competitions drive regular re-engagement and sharing
- **Give-to-get** — incentivizes free users to participate in community, growing content supply

### Positioning
"Your honest friend in your pocket. Instant outfit feedback, anytime."

---

## Deployment Status

The product is built and code-complete. The following steps are required before app store submission.

### Backend (Railway)
- [ ] Run `npx prisma migrate deploy` for Phase 4 Stylist/ExpertReview tables
- [ ] Run `npx prisma migrate deploy` for Phase 5 Challenge/ChallengeSubmission/ChallengeVote tables
- [ ] Run `npx prisma migrate deploy` for Phase 6 WardrobeItem table
- [ ] Run `npx prisma migrate deploy` for Phase 7 Event + EventOutfit tables
- [ ] Set `ADMIN_USER_IDS` env var (user IDs allowed to verify stylists)
- [ ] Set `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL` (LiveKit cloud account required)

### Frontend (EAS Native Build)
- [ ] `npx eas build --platform ios` and `--platform android`
  - *Required: `react-native-google-mobile-ads` and `@livekit/react-native` do not work in Expo Go*
- [ ] Replace placeholder AdMob App IDs in `app.json` with real IDs from AdMob dashboard
- [ ] Replace placeholder interstitial ad unit IDs in `feedback.tsx`
- [ ] Set Clerk publishable key for production in `.env`
- [ ] Set `API_BASE_URL` to production Railway URL in `src/lib/api.ts`

### App Store
- [ ] App store listings (screenshots, descriptions, category selection)
- [ ] App Store review (note: live streaming and ads may trigger additional review scrutiny)
- [ ] Age rating configuration

---

## Future Roadmap

The following capabilities are not yet built but represent logical next phases post-launch:

- **Video capture** — 5–15 second video for 360° outfit view (outfit capture currently photo only)
- **Style reports** — monthly/quarterly PDF-style analysis of outfit patterns, best colors, occasions
- **Onboarding optimization** — guided first-run experience, A/B tested flows
- **AI prompt A/B testing** — systematic improvement of feedback quality and tone
- **Push notification strategy** — infrastructure exists (`push.routes.ts`), content strategy and scheduling not yet designed
- **International expansion** — US-first launch; UK/EU/AU secondary markets
- **Shopping/affiliate integration** — AI suggests specific purchasable items with tracked affiliate links
- **Brand partnerships** — sponsored styling tips, must be clearly labeled

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| AI feedback quality insufficient | Medium | High | Prompt engineering tuning; user feedback loop; follow-up conversation recovers weak initial responses |
| Users feel AI is impersonal | Medium | Medium | Frame as "instant AI feedback"; community and expert tiers add human validation |
| Community feedback becomes toxic | Medium | High | Reporting system built; privacy controls built; trusted-reviewer visibility tier limits exposure |
| Live streaming abuse | Medium | Medium | Plus/Pro gate for hosting reduces bad actors; reporting built in |
| Cold start — no community | High | High | AI bootstrap phase covers this; give-to-get incentivizes early feedback participation |
| Competition from established players | Medium | Medium | Speed and breadth of features; "Or This?" brand is distinctive; no direct competitor combines all 3 feedback modes |
| Privacy concerns deter signups | Medium | Medium | Face blur default; visibility controls; auto-delete; privacy-first positioning |
| App store rejection (ads + live streaming) | Low | High | Both are standard app features with clear precedent; test build early |
| Database migration failures on Railway | Low | High | Run migrations locally first; Railway has migration history rollback |
| LiveKit infrastructure costs at scale | Low | Medium | LiveKit free tier covers initial users; pricing is per-minute not per-seat |

---

## Appendix A: Competitive Landscape (Detailed)

| Competitor | Category | What They Do | Where We Win |
|------------|----------|--------------|-------------|
| Fits | AI wardrobe | Digital closet, AI outfit suggestions | Real-time feedback on what you're wearing NOW |
| Style DNA | Color analysis | Color season analysis, shopping | Outfit critique, not just color theory |
| Combyne | Social/outfit collages | Browse and create outfit mood boards | AI feedback, live community, expert access |
| Stitch Fix | Subscription box | Curated clothing delivery + stylist notes | Instant; no commitment; feedback on your own clothes |
| Indyx | Human stylist | Book a stylist, get wardrobe advice | Faster, cheaper, 3 modes of feedback in one app |
| Instagram/TikTok Live | Social | Live streaming to followers | Privacy controls; purpose-built for outfit feedback; no following required |

---

## Appendix B: Sample User Flows

These flows reflect the actual implemented screens.

### Flow 1: First-Time User
1. Download → Onboarding screen (value prop, permission requests)
2. Sign up via Clerk (email or OAuth)
3. Home tab → "Check My Outfit" → Camera screen
4. Capture photo → Context screen (occasion, vibe, concerns)
5. AI feedback in < 10 seconds → Feedback screen
6. Optional: Ask follow-up question
7. Save to history or share to community

### Flow 2: Daily Check (Returning User)
1. Open app → Home tab shows daily check count
2. Camera → Capture → Context (pre-filled from last session)
3. Feedback → Done in under 60 seconds
4. Optionally: share to community for additional votes

### Flow 3: Community Engagement (Plus/Pro)
1. Community tab → browse recent/popular outfits
2. Give feedback on an outfit → earn points
3. Post own outfit for community feedback
4. Create "Or This?" comparison post → two outfits, community votes
5. Check leaderboard standing

### Flow 4: Event Prep (Pro User)
1. Profile → Event Planner → Create event (title, date, dress code)
2. Camera → check outfit 1 → save to history
3. Camera → check outfit 2 → save to history
4. Event detail → attach both outfits
5. "Compare with AI" → Gemini returns winner + rankings + styling tip
6. Save winner with occasion tag

### Flow 5: Live Outfit Review (Plus/Pro Host)
1. Live tab → "Start Session" → set title and go live
2. Community users browse active sessions, join to watch and comment
3. Host shows outfit, receives real-time feedback from viewers
4. End session → summary saved

### Flow 6: Expert Review (Pro User)
1. Feedback screen → "Get Expert Review" CTA
2. Request Expert Review screen → browse verified stylists by specialty
3. Submit request → stylist receives in queue
4. Stylist completes review → user notified
5. Expert review card appears on outfit feedback screen

---

*End of PRD v2.0*
