# Or This? — Handoff Instructions for Instance 1

## What This Is

**Or This?** is an AI-powered outfit feedback app. Users take a photo of an outfit, describe the occasion/vibe, and get an AI score + structured feedback. It also has social features: community feed, inner circle sharing, follow/block, comparisons, leaderboard, and push notifications.

- **Frontend**: `fitcheck-app/` — Expo SDK 54 + React Native + expo-router + Clerk Auth + Zustand + React Query
- **Backend**: `fitcheck-api/` — Node.js + Express + TypeScript + Prisma + PostgreSQL (Railway) + Google Gemini AI
- **Landing page**: `orthis-web/` — static site with privacy policy and terms
- **Repo**: https://github.com/Bradavis2011/FitCheck
- **Branch**: `master` locally, `main` on GitHub. Railway deploys from `main`. Always push with `git push origin master:main`.

---

## What's Built and Working

### Frontend (`fitcheck-app/`)

**Auth**
- Sign-up, sign-in, email verification — all via `@clerk/clerk-expo`
- Onboarding flow with style preferences

**Core Flow**
- `app/(tabs)/camera.tsx` — Camera capture or gallery pick, resizes to 1024px before sending to AI
- `app/context.tsx` — Occasion, setting, weather, vibe, concerns input. Also has "Who sees this?" sharing selector (Just Me / Inner Circle / Community)
- `app/feedback.tsx` — Score display, what's working, consider, quick fixes. Has retry analysis button for failed AI responses
- `app/(tabs)/history.tsx` — Past outfit checks, filterable by All / Favorites / occasion

**Social**
- `app/(tabs)/community.tsx` — Community feed with tabs: Trending / Latest / Following / Inner Circle
- `app/user/[username].tsx` — User profiles with follow/block/inner circle controls
- `app/give-feedback.tsx` — Leave feedback on others' outfits
- `app/leaderboard.tsx` — Top users by feedback score
- `app/notifications.tsx` — Push notification inbox

**Other Screens**
- `app/outfit/[id].tsx` — Single outfit detail
- `app/create-comparison.tsx` — Side-by-side outfit comparisons
- `app/challenges.tsx`, `app/wardrobe.tsx`, `app/recommendations.tsx` — Extended features
- `app/style-evolution.tsx`, `app/style-profile.tsx`, `app/style-preferences.tsx` — Profile features
- `app/upgrade.tsx` — Subscription/paywall screen
- `app/privacy-settings.tsx`, `app/help.tsx`, `app/community-guidelines.tsx`

**Reusable Components** (`fitcheck-app/src/components/`)
- `PillButton`, `ScoreDisplay`, `FeedbackCard`, `OutfitCard`, `LoadingOverlay`, `ProgressDots`, `OrThisLogo`

### Backend (`fitcheck-api/`)

**Infrastructure**
- Deployed on Railway (PostgreSQL + Node service)
- `railway.json`: build = `npm install && npx prisma generate && npm run build`, deploy = `npx prisma migrate deploy && npm start`
- Prisma migrations are auto-applied on deploy

**API Endpoints**
- `POST /api/auth/...` — Clerk webhook sync, token exchange
- `POST /api/outfits/check` — Submit outfit photo + context → Gemini AI → score + feedback
- `GET /api/outfits/history` — User's past checks
- `GET /api/social/community/feed` — Community feed (supports filter: trending/latest/following/inner_circle)
- `POST /api/social/community/feedback` — Submit feedback comment (profanity filtered)
- `GET /api/social/users/search` — Search users by username
- `POST /api/social/users/:username/follow` — Follow/unfollow
- `POST /api/social/users/:username/block` — Block/unblock
- `POST /api/social/users/:username/inner-circle` — Add to inner circle
- `DELETE /api/social/users/:username/inner-circle` — Remove from inner circle
- `GET /api/social/inner-circle` — Get your inner circle members
- `POST /api/social/report` — Report content
- `GET /api/social/leaderboard` — Top users
- `GET /api/subscriptions/...` — Subscription status
- `POST /api/push/register` — Register push token
- `GET /api/trends/...` — Style trends

**AI**
- Uses Google Gemini (not OpenAI) — key in `GEMINI_API_KEY`
- Returns structured JSON: score (1-10), what's working, what to consider, quick fixes, tags

**Moderation**
- Profanity filtering on community feedback comments (inline filter, no external package — `bad-words` was removed due to CJS/ESM issues)

**Rate Limiting**
- Free tier: 3 outfit checks/day, 3 follow-up messages/outfit

### Image Storage

- Images are uploaded to **AWS S3** (`fitcheck-images` bucket)
- Env vars required: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, `AWS_REGION`
- S3 is set up and configured in the backend service

### In-App Purchases

- `react-native-purchases` (RevenueCat) is installed but **not yet connected**
- Google Play products not yet created
- `app/upgrade.tsx` exists but paywall is not live

---

## Current Build Status

### Android (EAS)
- **Latest build**: Production build triggered after removing Sentry Gradle plugin
- **What was fixed**: 5 rounds of EAS build failures resolved:
  1. Missing `npm_config_legacy_peer_deps` in non-development EAS profiles → fixed in `eas.json`
  2. `expo-doctor` failing on `@react-native-community/netinfo` version mismatch → fixed via `npx expo install`
  3. Metro config overriding `sourceExts` → simplified to default config
  4. `expo-dev-client` in plugins adding unnecessary overhead → removed
  5. `@sentry/react-native` Gradle plugin calling `sentry-cli --org` at build time → **removed from plugins in `app.json`**
- **Current status**: Build in progress (or just triggered) after commit `2b72fee`
- **Output**: Signed `.aab` file for Google Play

### iOS
- Not yet built — Apple Developer Program payment issue unresolved

### Backend (Railway)
- Successfully deployed — TypeScript build errors fixed by downgrading `@types/express` from v5 to v4
- Railway watches `main` branch

---

## Immediate Next Steps (in order)

### 1. Confirm the Android EAS build passed
Run from `fitcheck-app/`:
```
eas build:list --platform android
```
Or check: https://expo.dev/accounts/outfitcheck/projects/orthis/builds

If it failed again, check the new error and fix before proceeding.

### 2. Upload AAB to Google Play Console
- Go to https://play.google.com/console
- App: **Or This?** (`com.bradavis.orthis`)
- Navigate to **Testing → Internal testing → Create new release**
- Upload the `.aab` from EAS (download via `eas build:list` or the Expo dashboard)
- Add test users (your email + any others)
- Roll out to internal testers

### 3. Create subscription products in Google Play
- In Google Play Console → **Monetize → Products → Subscriptions**
- Create:
  - `orthis_pro_monthly` — e.g. $4.99/month
  - `orthis_pro_yearly` — e.g. $39.99/year (or whatever pricing you've decided)
- Note the product IDs exactly

### 4. Connect RevenueCat
- Create account at https://www.revenuecat.com
- Create a new project, add Google Play app
- Link your Google Play subscription products in RevenueCat
- Get your RevenueCat **public SDK key**
- Add to `fitcheck-app/src/services/api.service.ts` or a new `purchases.service.ts`
- Initialize RevenueCat in `fitcheck-app/app/_layout.tsx` with:
  ```typescript
  import Purchases from 'react-native-purchases';
  Purchases.configure({ apiKey: 'your_rc_public_key' });
  ```
- Wire `app/upgrade.tsx` to actually present the paywall and call `Purchases.purchasePackage()`

### 5. Set up Sentry properly (optional, can defer)
To get symbolicated crash reports in production:
- Create account at https://sentry.io
- Create a React Native project
- Get your DSN, org slug, and project slug
- Create a `sentry.properties` file in `fitcheck-app/`:
  ```
  defaults.org=YOUR_ORG_SLUG
  defaults.project=YOUR_PROJECT_SLUG
  ```
- Add `SENTRY_AUTH_TOKEN` as an EAS secret: `eas secret:create --name SENTRY_AUTH_TOKEN --value ...`
- Re-add the Sentry plugin to `app.json`:
  ```json
  ["@sentry/react-native", { "uploadNativeSymbols": false, "autoUpload": true }]
  ```
Note: Sentry **runtime** error capturing already works via DSN even without the plugin.

### 6. Resolve Apple Developer Program payment
- Pay the $99/year fee at https://developer.apple.com
- Once active, run iOS EAS build: `eas build --platform ios --profile production`
- Submit via `eas submit --platform ios`

### 7. Production environment checklist (before public launch)
Verify these env vars are set in Railway:
- [ ] `DATABASE_URL` — Railway PostgreSQL URL
- [ ] `CLERK_SECRET_KEY` — from clerk.com dashboard
- [ ] `CLERK_WEBHOOK_SECRET` — from Clerk webhooks
- [ ] `GEMINI_API_KEY` — from Google AI Studio
- [ ] `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` + `AWS_S3_BUCKET` + `AWS_REGION`
- [ ] `NODE_ENV=production`

### 8. App Store assets
Before submitting to stores you need:
- Screenshots: phone (6.7" for iPhone, 1080×1920 for Android) — at least 3 per platform
- Feature graphic (Android): 1024×500px
- App description (500 chars for short, 4000 for full)
- Privacy policy URL: already live at orthis-web

---

## Known Issues / Technical Debt

| Issue | Status | Notes |
|---|---|---|
| Sentry source maps | Deferred | Runtime reporting works; symbolication requires org config |
| RevenueCat / subscriptions | Not started | `react-native-purchases` installed, not wired up |
| iOS build | Blocked | Apple Developer Program payment pending |
| Follow-up AI conversation | Backend built, not wired to UI | `fitcheck-api/src/services/follow-up.service.ts` exists |
| Wardrobe / recommendations screens | UI shell exists | Not connected to real data |
| Challenges screen | UI shell exists | No backend challenge data |

---

## Key Files Reference

| File | Purpose |
|---|---|
| `fitcheck-app/app.json` | Expo config — plugins, permissions, EAS project ID |
| `fitcheck-app/eas.json` | EAS build profiles (development / preview / production) |
| `fitcheck-app/app/_layout.tsx` | Root layout — Clerk provider, fonts, navigation |
| `fitcheck-app/app/(tabs)/_layout.tsx` | Bottom tab bar config |
| `fitcheck-app/src/store/index.ts` | Zustand global state |
| `fitcheck-app/src/services/api.service.ts` | All API calls to backend |
| `fitcheck-api/src/index.ts` | Express app entry point |
| `fitcheck-api/prisma/schema.prisma` | Database schema |
| `fitcheck-api/railway.json` | Railway build + deploy commands |
| `fitcheck-api/.env.example` | All required environment variables |

---

## Design System (for any UI work)

- **Primary**: `#E85D4C` (coral), `#FF7A6B` (light), `#C94A3A` (dark)
- **Background**: `#FBF7F4` (cream), `#F5EDE7` (cream dark)
- **Text**: `#1A1A1A` (black), `#2D2D2D` (charcoal)
- **Accent**: `#A8B5A0` (sage), `#C4CFBD` (sage light)
- **Fonts**: DM Sans (body) + Playfair Display Italic (headings)
- **Score colors**: ≥8 = `#10B981` green, ≥6 = `#F59E0B` amber, <6 = `#EF4444` red
- **No NativeWind** — use `StyleSheet.create()` only (NativeWind v4 has peer dep conflict with Expo 54)
