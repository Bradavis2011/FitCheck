# Or This? — Build Plan Status
> Last updated: 2026-02-17 (by Claude, end of Phase 4)

## Overview
This file tracks the implementation plan for "Or This?" (AI-powered outfit feedback app). The plan was created to fix legal risk from the upgrade screen promising undeliverable features, and to build out the full feature set.

**App**: Expo SDK 54 + React Native + Clerk Auth + Zustand + React Query
**Backend**: Node.js + Express + TypeScript + Prisma + PostgreSQL
**Repo**: https://github.com/Bradavis2011/FitCheck
**Branch**: local `master` → push to `origin/main` (`git push origin master:main`)
**Key rule**: NativeWind v4 doesn't work with Expo 54 — use `StyleSheet.create()` everywhere.
**Backend URL**: Deployed on Railway. DB is Railway PostgreSQL. S3 optional.

---

## ✅ COMPLETED PHASES

### Phase 0 — Fix Upgrade Screen (legal cleanup) ✅
- Removed undeliverable promises from `upgrade.tsx`
- Free tier: no "with ads" lie, clean feature list
- Plus: Unlimited checks, 5 follow-ups, unlimited history, ad-free
- Pro: Everything in Plus + 10 follow-ups + 5 expert reviews/month + Style DNA
- Updated already-subscribed view subtitles

### Phase 1 — Tier Enforcement ✅
- **Community feedback** (social.controller.ts): free users blocked from giving feedback → upgrade prompt
- **Style analytics** (user.controller.ts, trends.controller.ts): gated to pro tier
- **Priority processing**: free uses base model, paid uses better Gemini model tier
- **Frontend gates**: `give-feedback.tsx`, `style-profile.tsx`, `style-evolution.tsx`, `recommendations.tsx`

### Phase 2 — Ad Integration ✅
- Installed `react-native-google-mobile-ads`
- `app.json`: Added plugin with Google test App IDs (replace before release)
- `src/lib/adManager.ts`: Session counter — interstitial shows every 2nd check
- `src/components/AdBanner.tsx`: Banner ad, renders null for non-free users (`limits?.hasAds`)
- `app/(tabs)/index.tsx`: AdBanner between upgrade and invite cards
- `app/(tabs)/history.tsx`: AdBanner as ListFooterComponent
- `app/feedback.tsx`: Interstitial loads on mount for free users, shows after new analysis completes
- `upgrade.tsx`: "Ad-free experience" added to Plus/Pro feature lists

### Phase 3 — Live Streaming ✅
- **Backend**: `live.routes.ts` mounted in `server.ts` (`/api/live`)
- **Backend**: `initializeSocketService(httpServer)` called in `server.ts`
- **Backend**: `live.controller.ts` — free users blocked from hosting live sessions
- **Frontend**: `@livekit/react-native` v2.9.6 + `livekit-client` v2.17.1 installed
- **Frontend**: Moved live screens from `live-disabled-for-native-builds/` → `app/live/`
  - `app/live/index.tsx` — start/host live session (Plus/Pro gated)
  - `app/live/[id].tsx` — join/watch stream, end stream if host
  - `app/live/browse.tsx` — browse active sessions
- **Fixes**:
  - `src/lib/api.ts`: exported `API_BASE_URL`
  - `src/services/socket.service.ts`: fixed import path to `'../lib/api'`
  - `src/services/live.service.ts`, `push.service.ts`: use named import `{ api }`
  - `src/hooks/useLiveStream.ts`: `Room, RoomEvent` from `livekit-client`, no invalid connect options
  - `app/live/[id].tsx`: `cameraPublication?.track` cast to `VideoTrack`
- **LiveKit infrastructure**: Still needs env vars in Railway: `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL`
  - Sign up at https://livekit.io (free tier: 50 participants/month)

### Phase 4 — Expert Stylist System ✅
- **Prisma schema**: Added `Stylist` and `ExpertReview` models (`fitcheck-api/prisma/schema.prisma`)
  - Stylist: userId (unique), bio, specialties[], instagramUrl, verified, rating, reviewCount
  - ExpertReview: outfitCheckId, userId (requester), stylistId, status, score, feedback, completedAt
  - User gets `stylistProfile Stylist?` and `expertReviewsRequested ExpertReview[]`
  - OutfitCheck gets `expertReviews ExpertReview[]`
  - **⚠️ MIGRATION NEEDED**: `npx prisma migrate dev --name add_stylist_expert_review` (local) or push schema to Railway for production DB
- **tiers.ts**: `expertReviewsPerMonth: 5` for Pro (was 0)
- **Backend controllers**:
  - `fitcheck-api/src/controllers/stylist.controller.ts` — apply, get/update own profile, list verified, admin verify/unverify
  - `fitcheck-api/src/controllers/expert-review.controller.ts` — request (with monthly limit enforcement), get my reviews, get stylist queue, submit review, cancel, get by outfit ID
- **Backend routes**:
  - `fitcheck-api/src/routes/stylist.routes.ts` → mounted at `/api/stylists`
  - `fitcheck-api/src/routes/expert-review.routes.ts` → mounted at `/api/expert-reviews`
- **Frontend service**: `expertReviewService` added to `api.service.ts` with full TypeScript types (`StylistProfile`, `ExpertReview`)
- **Frontend hooks** added to `useApi.ts`: `useOutfitExpertReview`, `useMyExpertReviews`, `useRequestExpertReview`, `useStylists`
- **Frontend screens**:
  - `fitcheck-app/app/become-stylist.tsx` — bio, specialties picker, Instagram URL, submit application
  - `fitcheck-app/app/request-expert-review.tsx` — Pro-gated, shows stylist list, requests review
- **feedback.tsx**: Shows completed expert review card OR "Get Expert Review" CTA button for Pro users
- **upgrade.tsx**: "5 expert stylist reviews/month" in Pro tier, updated subscribed subtitle
- **Admin verification**: Set `ADMIN_USER_IDS` env var (comma-separated user IDs) in Railway to control who can verify stylists

---

## ❌ REMAINING PHASES

### Phase 5 — Challenges System (Week 4-6)
**Status**: Frontend `challenges.tsx` exists with hardcoded mock data. No backend at all.

**Backend to build**:
- Prisma models: `Challenge` (title, description, theme, startsAt, endsAt, prize, status), `ChallengeSubmission` (challengeId, outfitCheckId, userId, votes)
- `fitcheck-api/src/controllers/challenge.controller.ts` — list challenges, get challenge, submit entry, vote, get leaderboard, admin create/end
- `fitcheck-api/src/routes/challenge.routes.ts` — mount at `/api/challenges`
- Mount in `server.ts`

**Frontend to build**:
- Replace mock data in `fitcheck-app/app/challenges.tsx` with API calls using React Query
- Wire submit button → POST to `/api/challenges/:id/submit`
- Wire vote buttons → POST to `/api/challenges/:id/submissions/:subId/vote`
- Wire leaderboard to `/api/challenges/:id/leaderboard`

---

### Phase 6 — Wardrobe & Outfit Builder (Week 6-8)
**Status**: Frontend `wardrobe.tsx` and `outfit-builder.tsx` exist with mock data. No backend.

**Backend to build**:
- Prisma model: `WardrobeItem` (userId, name, category, color, imageUrl, timesWorn, lastWorn, createdAt)
- `fitcheck-api/src/controllers/wardrobe.controller.ts` — CRUD wardrobe items
- `fitcheck-api/src/routes/wardrobe.routes.ts` — mount at `/api/wardrobe`

**Frontend to build**:
- Replace mock data in `fitcheck-app/app/wardrobe.tsx` with real API calls
- Replace mock data in `fitcheck-app/app/outfit-builder.tsx` with real wardrobe items
- Un-hide wardrobe link on profile screen (currently commented out or hidden)

---

### Phase 7 — Event Planning Mode — Pro Feature (Week 8-9)
**Status**: No code exists at all. Promised in upgrade screen only after this is built.

**To build**:
- Prisma model: `Event` (userId, title, date, dressCode, type, status)
- Backend: `event.controller.ts`, `event.routes.ts`, mount at `/api/events`
- Frontend: `fitcheck-app/app/event-planner.tsx` — create event, attach outfit checks, get AI comparison
- Gate to Pro users only
- Add "Event planning mode" back to upgrade screen Pro features once built

---

### Phase 8 — Privacy Controls (Week 3-4)
**Status**: `isPublic` toggle exists. `privacySettings` JSON field exists in DB. Frontend `privacy-settings.tsx` exists.

**To build**:
- **Face blur**: Use `expo-face-detector` or `react-native-vision-camera` to auto-blur faces before uploading community posts. Toggle: "Blur my face in community posts"
- **Who-can-see settings**: Fully wire the "Inner Circle only", "Followers only", "Everyone" radio buttons in `privacy-settings.tsx` to the `privacySettings.visibility` field
- **Auto-delete**: Wire `privacySettings.autoDelete` setting to a backend cron that deletes/marks expired outfit checks
- **Status**: `fitcheck-api/src/controllers/user.controller.ts` already has `updatePrivacySettings()` — frontend just needs to call it properly

---

### Phase 9 — Full Gamification (Week 4-6)
**Status**: Backend has points/levels/leaderboard/streaks in `UserStats`. Missing pieces:

**To build**:
- **Give-to-get**: Award +1 daily check for every X community feedbacks given. Track in `UserStats.dailyFeedbackCount`, enforce in outfit check limit logic
- **Badges**:
  - Backend: Define badge criteria, award on qualifying action (first check, 10 checks, first feedback, streak milestones)
  - Frontend: Badge display on profile screen (`app/(tabs)/profile.tsx`), notifications when earned
- **Streaks**:
  - Backend: Already has `currentStreak`, `lastActiveDate` in UserStats — just needs daily update logic
  - Frontend: Streak counter on home screen (`app/(tabs)/index.tsx`)
- **Daily/Weekly goals**:
  - Backend: `dailyFeedbackCount`, `dailyHelpfulVotes` exist — needs goal thresholds and reset logic
  - Frontend: Goal progress widget on home screen

---

## DEPLOYMENT CHECKLIST (Before App Store Submission)

### Backend (Railway)
- [ ] Run `npx prisma migrate deploy` for Phase 4 Stylist/ExpertReview tables (or run migration in Railway console)
- [ ] Set `ADMIN_USER_IDS` env var (comma-separated user IDs allowed to verify stylists)
- [ ] Set `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL` env vars for live streaming
- [ ] Replace placeholder AdMob IDs in `app.json` with real App IDs from AdMob dashboard
- [ ] Replace `ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX` placeholders in `feedback.tsx` with real interstitial ad unit IDs

### Frontend (EAS Build)
- [ ] `npx eas build --platform ios` and `--platform android`
- [ ] `react-native-google-mobile-ads` and `@livekit/react-native` both require native builds (won't work in Expo Go)
- [ ] Configure Clerk publishable key for production in `.env`
- [ ] Set `API_BASE_URL` to production Railway URL in `src/lib/api.ts`

---

## KEY FILE LOCATIONS

| What | Where |
|------|--------|
| Tab screens | `fitcheck-app/app/(tabs)/` |
| Route/screen files | `fitcheck-app/app/` |
| API service | `fitcheck-app/src/services/api.service.ts` |
| React Query hooks | `fitcheck-app/src/hooks/useApi.ts` |
| Zustand stores | `fitcheck-app/src/stores/` |
| Theme constants | `fitcheck-app/src/constants/theme.ts` |
| Reusable components | `fitcheck-app/src/components/` |
| Backend controllers | `fitcheck-api/src/controllers/` |
| Backend routes | `fitcheck-api/src/routes/` |
| Prisma schema | `fitcheck-api/prisma/schema.prisma` |
| Tier limits | `fitcheck-api/src/constants/tiers.ts` |
| API base | `fitcheck-app/src/lib/api.ts` |
| Auth middleware | `fitcheck-api/src/middleware/auth.ts` |
| Server entry | `fitcheck-api/src/server.ts` |

## CRITICAL NOTES FOR NEXT INSTANCE
1. **Always run `npx tsc --noEmit` in both `fitcheck-api/` and `fitcheck-app/` before committing**
2. **If Prisma generate fails with EPERM**: `rm -f fitcheck-api/node_modules/.prisma/client/query_engine-windows.dll.node` then retry
3. **TypeScript patterns**: Use `req.user!.id`, `req.user!.tier` in controllers (auth middleware guarantees this)
4. **`limits` from subscriptionStore can be null** — always use `limits?.hasAds`, `limits?.followUpsPerCheck`
5. **expo-router routing**: Use `router.push('/screen-name' as any)` for dynamic routes not in the type system
6. **Migration**: Phase 4 added 2 new DB tables — run `npx prisma migrate dev --name add_stylist_expert_review` locally or apply migration SQL to Railway DB
