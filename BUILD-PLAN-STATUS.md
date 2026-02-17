# Or This? — Build Plan Status
> Last updated: 2026-02-17 (by Claude, end of Phase 9)

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

### Phase 5 — Challenges System ✅
**Status**: Complete.

- **Prisma**: `Challenge`, `ChallengeSubmission`, `ChallengeVote` models added. Run `npx prisma migrate dev --name add_challenges` to apply.
- **Backend**: `challenge.controller.ts` + `challenge.routes.ts`, mounted at `/api/challenges` in `server.ts`
  - `GET /api/challenges?status=active|upcoming|ended`
  - `GET /api/challenges/active` — convenience for current tab
  - `GET /api/challenges/:id/leaderboard`
  - `GET /api/challenges/:id/my-submission`
  - `POST /api/challenges/:id/submit` — body: `{ outfitCheckId }`
  - `POST /api/challenges/:id/submissions/:subId/vote`
  - `POST /api/challenges` (admin) — create challenge
  - `POST /api/challenges/:id/end` (admin) — end challenge early
- **Frontend**: `challengeService` + TypeScript types in `api.service.ts`; `useActiveChallenge`, `useChallenges`, `useChallengeLeaderboard`, `useMySubmission`, `useSubmitChallengeEntry`, `useVoteForSubmission` in `useApi.ts`
- **challenges.tsx**: Fully wired to API — live leaderboard, outfit picker modal for submissions, vote buttons, empty states, loading states.

---

### Phase 6 — Wardrobe & Outfit Builder ✅
**Status**: Complete.

- **Prisma**: `WardrobeItem` model added. Run `npx prisma migrate dev --name add_wardrobe` then `npx prisma generate`.
- **Backend**: `wardrobe.controller.ts` + `wardrobe.routes.ts`, mounted at `/api/wardrobe`
  - `GET /api/wardrobe?category=tops` — list items (optional category filter)
  - `GET /api/wardrobe/:id` — get single item
  - `POST /api/wardrobe` — create item (name, category, color, imageUrl)
  - `PUT /api/wardrobe/:id` — update item
  - `DELETE /api/wardrobe/:id` — remove item
  - `POST /api/wardrobe/:id/wear` — log a wear (increments timesWorn, sets lastWorn)
- **Frontend**: `WardrobeItem` type, `wardrobeService`, `WardrobeCategory` in `api.service.ts`; `useWardrobeItems`, `useAddWardrobeItem`, `useUpdateWardrobeItem`, `useDeleteWardrobeItem`, `useLogWear` in `useApi.ts`
- **wardrobe.tsx**: Fully wired — real item list, category filter, Add Item modal (name/color/category), item detail Alert (log wear + delete), loading/empty states
- **outfit-builder.tsx**: Loads all wardrobe items, groups by category client-side, shows real items in slots, handles empty wardrobe state, shuffle works with real data, selected item highlights
- **Profile**: Wardrobe link was already live (`router.push('/wardrobe')`)

---

### Phase 7 — Event Planning Mode ✅
**Status**: Complete. Pro-gated end to end.

- **Prisma**: `Event` + `EventOutfit` models added. Run `npx prisma migrate dev --name add_events` then `npx prisma generate`.
- **Backend**: `event.controller.ts` + `event.routes.ts`, mounted at `/api/events`. All endpoints Pro-gated.
  - `GET /api/events?status=upcoming|past` — list user's events (auto-transitions past events)
  - `GET /api/events/:id` — event detail with all attached outfits
  - `POST /api/events` — create event (title, date, dressCode, type, notes)
  - `PUT /api/events/:id` — update event
  - `DELETE /api/events/:id` — delete event
  - `POST /api/events/:id/outfits` — attach outfit check to event
  - `DELETE /api/events/:id/outfits/:outfitCheckId` — remove outfit from event
  - `POST /api/events/:id/compare` — Gemini AI compares all attached outfits vs event context; result cached 24h
- **Frontend**: `Event`, `EventOutfitOption`, `CompareResult` types + `eventService` in `api.service.ts`; 8 hooks in `useApi.ts`
- **`event-planner.tsx`**: Pro gate with upgrade CTA, event list (upcoming/past tabs), create modal (type picker, dress code picker, date input), long-press to delete
- **`event/[id].tsx`**: Event detail with outfit grid, add outfit modal (from history), long-press to remove, "Compare with AI" button, full results display (winner, rankings, styling tip), cached result reuse
- **`upgrade.tsx`**: "Event planning mode" added to Pro feature list + subscribed subtitle
- **`profile.tsx`**: Event Planner card added after Wardrobe (→ `/event-planner`)

---

### Phase 8 — Privacy Controls ✅
**Status**: Complete.

- **`user.controller.ts`**: Added `privacySettings` to `UpdateProfileSchema` (blurFaceDefault/visibility/autoDelete fields). Returns `privacySettings` in both `getProfile` and `updateProfile` responses.
- **Outfit creation (`outfit.controller.ts`)**:
  - Reads `user.privacySettings` at creation time
  - Sets `blurFace` from `privacySettings.blurFaceDefault` (default: true)
  - Sets `expiresAt` from `privacySettings.autoDelete` (24h/7d/30d mapped to future timestamps; never → null)
  - Sets outfit `visibility` from `privacySettings.visibility` when sharing publicly ('all'/'followers'/'trusted')
- **Auto-delete**: `purgeExpiredOutfits(userId)` helper soft-deletes outfit checks where `expiresAt <= now`. Called at the start of every `listOutfitChecks` request (lazy purge pattern — no cron needed).
- **Feed visibility filtering (`social.controller.ts`)**: Community feed now:
  - Shows `visibility='all'` outfits to everyone
  - Shows `visibility='followers'` outfits only to users who follow the poster
  - Shows `visibility='trusted'` outfits only to users with `totalHelpfulVotes >= 5` (active community reviewers)
- **Frontend** (`privacy-settings.tsx`): Already complete — face blur toggle, visibility radio buttons, auto-delete radio buttons, save button all wired to `updateProfileMutation`.

---

### Phase 9 — Full Gamification ✅
**Status**: Complete.

- **Give-to-get** (`outfit.controller.ts`): Before enforcing daily check limit, reads user's `UserStats.dailyFeedbackCount` (for today). Awards +1 bonus check per 3 feedbacks given that day (`Math.floor(count / 3)`). Error message updated to tell users they can earn bonus checks via feedback.
- **Outfit badges** (`gamification.service.ts`):
  - New exported `checkOutfitBadges(userId, outfitCount)` — awards `first_outfit`, `ten_outfits`, `fifty_outfits` based on submission count
  - Called non-blocking after every outfit submission in `outfit.controller.ts`
  - Added `first_feedback` badge to `checkAndAwardBadges` (triggered from `awardFeedbackPoints` path)
  - New badges in `BADGE_METADATA`: `first_outfit` (👕), `ten_outfits` (🔟), `fifty_outfits` (👗), `first_feedback` (💬)
- **Frontend hooks** (`useApi.ts`): Uncommented and typed `useBadges` and `useDailyGoals` hooks — both live-wired to `/api/user/badges` and `/api/user/daily-goals`
- **Profile badges + daily goals** (`app/(tabs)/profile.tsx`):
  - `useBadges` and `useDailyGoals` now enabled
  - Daily goals section: feedback count with progress bar + streak counter
  - Badges grid: shows earned badges with emoji icon + name (max 6 shown)
- **Home screen streak + goals widget** (`app/(tabs)/index.tsx`):
  - Chip row below daily checks counter: flame chip showing streak days, chat chip showing feedbacks given today
  - Only renders when streak > 0 or feedbacks given > 0
  - Refreshes on pull-to-refresh alongside other data

---

## DEPLOYMENT CHECKLIST (Before App Store Submission)

### Backend (Railway)
- [ ] Run `npx prisma migrate deploy` for Phase 4 Stylist/ExpertReview tables (or run migration in Railway console)
- [ ] Run `npx prisma migrate deploy` for Phase 5 Challenge/ChallengeSubmission/ChallengeVote tables
- [ ] Run `npx prisma migrate deploy` for Phase 6 WardrobeItem table
- [ ] Run `npx prisma migrate deploy` for Phase 7 Event + EventOutfit tables
- [ ] **After each schema change**: run `npx prisma generate` locally so TypeScript picks up new models
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
