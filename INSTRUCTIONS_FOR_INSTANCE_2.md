# Or This? — Instructions for Instance 2

> Hand-off document as of **February 17, 2026**.
> Written by Claude Instance 1 for the next working session.

---

## What This App Is

**Or This?** is an AI-powered outfit feedback app.
- Users photograph an outfit → AI (Google Gemini) scores it 1–10 → feedback on what works and what to fix
- Community feed, "Or This?" A/B comparison voting, Inner Circle (close friends), Style DNA profile
- Monetised via RevenueCat (free tier: 3 checks/day; pro: unlimited)

**Stack:**
- Frontend: `fitcheck-app/` — Expo SDK 54, React Native, expo-router, Clerk auth, Zustand, React Query
- Backend: `fitcheck-api/` — Node.js, Express, TypeScript, PostgreSQL (Neon), Prisma ORM
- Web: `orthis-web/` — Next.js 15, deployed on Vercel
- Storage: Cloudflare R2 (S3-compatible)
- Backend hosting: Railway (auto-deploys from `master` branch)

---

## Current Deployment Status

| Service | Status | URL / Notes |
|---------|--------|-------------|
| Backend API | ✅ Deployed (Railway) | `https://fitcheck-api-production.up.railway.app` |
| Web (orthis-web) | ✅ Deployed (Vercel) | `https://orthis.app` |
| iOS App | 🔄 EAS build not yet submitted to App Store |
| Android App | 🔄 EAS build not yet submitted to Google Play |
| Database | ✅ Neon PostgreSQL connected | Migrations applied via `npx prisma migrate deploy` on startup |

---

## What Was Completed (This Session)

### Features Built
- ✅ **Push notifications** — enabled in `usePushNotifications.native.ts`, fires after AI analysis, taps deep-link to outfit screen
- ✅ **"Or This?" comparison posts** — full stack (DB schema → migration → backend API → frontend). Users post two outfit photos and community votes A or B
- ✅ **Inner Circle** — DB model added (`inner_circle_members`), community feed filter works
- ✅ **Clear History endpoint** — `DELETE /api/user/history` soft-deletes all outfit checks, wired to Privacy Settings screen
- ✅ **Delete Account endpoint** — `DELETE /api/user/account`, hard deletes user, wired to Privacy Settings screen (calls Clerk `signOut()` after)
- ✅ **Community screen** — shows comparison section at top + outfit feed with filters: Recent / Popular / Top Rated / Inner Circle
- ✅ **App Store screenshots** — HTML mockups in `fitcheck-app/store-assets/screenshots/` (01–05, 1290×2796px)
- ✅ **orthis-web `/delete-account` page** — required by Google Play data safety form; live at `https://orthis.app/delete-account`

### Backend Fixes
- ✅ **Removed `bad-words` package** — was crashing server with CJS/ESM incompatibility; replaced with inline word list in `social.controller.ts`
- ✅ **Railway build fixed** (3 iterations):
  - Added `fitcheck-api/nixpacks.toml` — forces `npm ci --include=dev` so TypeScript + `@types/*` are installed even when `NODE_ENV=production`
  - Fixed `railway.json` build command — removed duplicate `npm ci` that caused `EBUSY` lock error
  - Hardened `AuthenticatedRequest` type in `src/types/index.ts` — explicitly declares `body`, `query`, `params`, `headers: any` so compilation works even if `@types/express` isn't resolved

### Database Migrations Applied
- `0_init` — base schema
- `20260216224511_add_gamification_fields`
- `20260217000000_add_comparison_posts` — `comparison_posts`, `comparison_votes` tables
- `20260217064444_add_inner_circle` — `inner_circle_members` table

---

## What Still Needs to Be Done

### 1. Verify Railway Deployment (PRIORITY)
The last push (`f3ecbce`) fixed all known build issues. **Check Railway dashboard to confirm the latest build succeeded.**
- Look for: `🚀 Or This? API server running on port ...` in deploy logs
- Health check: `GET https://fitcheck-api-production.up.railway.app/health`
- If it's still failing, check the build log for any new TypeScript errors

### 2. EAS Production Build — iOS
```bash
cd fitcheck-app
eas build --platform ios --profile production
```
- Bundle ID: `com.bradavis.orthis`
- EAS Project ID: `bd6e74d0-ce99-492d-aad3-ada5bad060d4`
- EAS owner: `outfitcheck`
- **Requires:** Apple Developer account credentials set up in EAS

Previous EAS fixes already applied:
- Sentry Gradle plugin removed from app.json (was breaking Android build)
- `expo-dev-client` removed
- Node 22 + `--legacy-peer-deps` set in eas.json profiles

### 3. EAS Production Build — Android
```bash
cd fitcheck-app
eas build --platform android --profile production
```
- Package: `com.bradavis.orthis`

### 4. App Store Submit (iOS)
```bash
eas submit --platform ios --latest
```
- Set app rating to **17+** (Mature/Suggestive Themes) in App Store Connect
- Screenshots: use the HTML files in `fitcheck-app/store-assets/screenshots/` — open each in a browser and screenshot at 1290×2796, or capture via headless Chrome

### 5. Google Play Submit (Android)
```bash
eas submit --platform android --latest
```
**Data Safety form answers:**
| Question | Answer |
|----------|--------|
| Data encrypted in transit? | Yes (HTTPS/TLS) |
| Account creation method | OAuth (Clerk — Google/Apple sign-in + email) |
| Delete account URL | `https://orthis.app/delete-account` |
| Delete data without deleting account? | Yes (Clear Outfit History feature) |

**Age targeting:** Set to **18+** with restriction on users who haven't confirmed age.
**Content rating:** Complete the content rating questionnaire — expected result: Mature 17+.

### 6. End-to-End Production Test
Test the full flow against the live Railway API:
1. Sign up with a new account
2. Upload an outfit photo → should get AI analysis
3. Check push notification arrives after analysis
4. Share to community → should appear in community feed
5. Create an "Or This?" comparison post
6. Vote on someone else's comparison post
7. Check History screen shows the outfit
8. Go to Profile → Settings → Privacy & Data → Clear History → confirm it clears
9. Check orthis.app/delete-account loads correctly

---

## Key File Locations

### Backend (`fitcheck-api/`)
| File | Purpose |
|------|---------|
| `src/server.ts` | Express app entry, registers all routes |
| `src/types/index.ts` | `AuthenticatedRequest` type — **has `body/query/params/headers: any` overrides** |
| `src/middleware/auth.ts` | Clerk token verification + auto user-sync |
| `src/controllers/comparison.controller.ts` | Or This? comparison post CRUD + voting |
| `src/controllers/social.controller.ts` | Community feed, sharing, inner circle |
| `src/controllers/user.controller.ts` | Profile, clear history, delete account |
| `src/controllers/notification.controller.ts` | Push notification creation/delivery |
| `src/services/ai-feedback.service.ts` | Gemini AI outfit analysis — fires push notification on completion |
| `prisma/schema.prisma` | Full DB schema incl. ComparisonPost, ComparisonVote, InnerCircleMember |
| `railway.json` | Railway build/start commands |
| `nixpacks.toml` | Forces `npm ci --include=dev` — **critical for Railway build** |

### Frontend (`fitcheck-app/`)
| File | Purpose |
|------|---------|
| `app/(tabs)/community.tsx` | Community feed with comparison section + inner circle filter |
| `app/create-comparison.tsx` | Create "Or This?" post — wired to real API |
| `app/privacy-settings.tsx` | Clear history + delete account — wired to real API |
| `src/services/api.service.ts` | All API calls incl. `comparisonService`, `userService.clearHistory/deleteAccount` |
| `src/hooks/useApi.ts` | React Query hooks incl. `useComparisonFeed`, `useVoteOnComparison` |
| `src/hooks/usePushNotifications.native.ts` | Push notification registration + deep link handler |
| `store-assets/screenshots/` | HTML mockup screenshots 01–05 for App Store |

### Web (`orthis-web/`)
| File | Purpose |
|------|---------|
| `app/page.tsx` | Landing page |
| `app/privacy/page.tsx` | Privacy Policy |
| `app/terms/page.tsx` | Terms of Service |
| `app/delete-account/page.tsx` | Account deletion instructions (Google Play requirement) |

---

## Environment Variables

### Railway (backend)
All set in Railway dashboard. Key ones:
- `DATABASE_URL` — Neon PostgreSQL connection string
- `CLERK_SECRET_KEY` — Clerk backend secret
- `CLERK_WEBHOOK_SECRET` — for Clerk user sync webhook
- `GEMINI_API_KEY` — Google Gemini AI
- `CLOUDFLARE_R2_*` / `AWS_*` — R2 image storage (configured as S3-compatible)
- `REVENUECAT_API_KEY`, `REVENUECAT_WEBHOOK_AUTH_TOKEN`
- `NODE_ENV=production`
- `CORS_ORIGIN` — should include the app's scheme + orthis.app

### Expo / EAS
- All secrets managed via `eas secret` or EAS dashboard
- Clerk publishable key in `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
- API base URL in `EXPO_PUBLIC_API_URL`

---

## Design System Reference
- **Primary**: `#E85D4C` (Decision Coral)
- **Background**: `#FBF7F4` (Confidence Cream)
- **Text**: `#1A1A1A` (Clarity Black)
- **Accent**: `#A8B5A0` (Soft Sage)
- **Logo**: "Or" in DM Sans Medium (black) + "This?" in Playfair Display Italic (coral)
- **Scores**: ≥8 green `#10B981`, ≥6 amber `#F59E0B`, <6 red `#EF4444`

---

## Git / Repo
- **Repo**: `https://github.com/Bradavis2011/FitCheck`
- **Branch**: `master` (Railway auto-deploys from this)
- **Last commit**: `f3ecbce` — Fix Railway build: install devDeps + harden AuthenticatedRequest type
