# Or This? - Deployment Status

**Last Updated:** 2026-02-16
**Backend URL:** https://fitcheck-production-0f92.up.railway.app/
**Status:** ✅ Backend Deployed, ⚙️ Configuration Pending

---

## ✅ Completed (Sprint 1 & 2)

### Sprint 1: Security Hardening
- [x] Removed insecure legacy JWT authentication
- [x] Removed `/register` and `/login` endpoints (Clerk-only auth)
- [x] Removed Socket.io and live streaming infrastructure (deferred to Phase 3)
- [x] Removed debug artifacts from frontend (`DevAuthGate`, `DebugPanel`)
- [x] Removed unauthenticated trends endpoints

### Sprint 2: Infrastructure
- [x] Added S3 graceful fallback handling (`isConfigured()` check)
- [x] Created Prisma migrations (`0_init` baseline)
- [x] Deployed backend to Railway
- [x] Configured PostgreSQL database connection
- [x] Fixed TypeScript compilation issues
- [x] Verified health endpoint: `/health` returns 200 OK
- [x] Updated frontend `.env` to point to production backend

---

## ⚙️ Configuration Needed (Before Testing)

### Critical (Required for App to Function)

1. **Clerk Publishable Key** - Frontend
   - File: `fitcheck-app/.env` line 4
   - Action: Uncomment real Clerk key or update placeholder on line 5
   - Status: ⚠️ Using placeholder

2. **Clerk Webhook** - Backend
   - URL: `https://fitcheck-production-0f92.up.railway.app/api/auth/clerk-webhook`
   - Events: `user.created`, `user.updated`, `user.deleted`
   - Action: Configure in Clerk dashboard
   - Status: ⚠️ Not configured

3. **Gemini API Key** - Backend
   - Variable: `GEMINI_API_KEY` in Railway
   - Action: Verify it's set (should already be from deployment)
   - Status: ✅ Should be set (verify in Railway)

### Important (Required for Subscriptions)

4. **RevenueCat Webhook** - Backend
   - URL: `https://fitcheck-production-0f92.up.railway.app/api/webhooks/revenuecat`
   - Events: `INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, etc.
   - Action: Configure in RevenueCat dashboard
   - Status: ⚠️ Not configured

5. **RevenueCat Product IDs** - Frontend
   - File: `fitcheck-app/app/upgrade.tsx`
   - Current IDs: `fitcheck_plus_monthly`, `fitcheck_plus_annual`, etc.
   - Action: Verify these match RevenueCat dashboard
   - Status: ⚠️ Needs verification

### Recommended (For Production Scale)

6. **Cloud Image Storage (S3/R2)** - Backend
   - Current: Using base64 fallback (stores in PostgreSQL)
   - Recommended: Set up Cloudflare R2 or AWS S3
   - Variables needed:
     - `AWS_REGION`
     - `AWS_ACCESS_KEY_ID`
     - `AWS_SECRET_ACCESS_KEY`
     - `AWS_S3_BUCKET`
   - Status: ⚠️ Using fallback (not production-ready)

---

## 🧪 Testing Checklist (After Configuration)

### Authentication Flow
- [ ] Sign up with new email
- [ ] Receive Clerk verification email
- [ ] Complete email verification
- [ ] Complete onboarding flow
- [ ] Verify user created in Railway PostgreSQL
- [ ] Verify Clerk webhook logged in Railway

### Outfit Check Flow
- [ ] Upload photo from camera
- [ ] Select context (occasion, weather, vibe)
- [ ] Submit outfit check
- [ ] Receive AI feedback with score
- [ ] View "What's Working" section
- [ ] View "Consider" section
- [ ] View "Quick Fixes" section
- [ ] Ask follow-up question
- [ ] Receive AI answer

### Free Tier Limits
- [ ] Submit 3 outfit checks (free tier limit)
- [ ] 4th check shows "Daily limit reached" error
- [ ] Upgrade prompt appears
- [ ] Limits reset after 24 hours

### Subscription Flow (If Configured)
- [ ] Tap upgrade button
- [ ] See Plus/Pro tier options
- [ ] Complete purchase (sandbox mode)
- [ ] Verify RevenueCat webhook fires
- [ ] Verify user tier updated in database
- [ ] Verify unlimited outfit checks work

### History & Profile
- [ ] View outfit history
- [ ] Filter by occasion
- [ ] Toggle favorite on outfit
- [ ] View favorites-only
- [ ] View user stats (points, level, streak)
- [ ] Edit profile (name, bio, preferences)

---

## 🚀 Sprint 3: Polish & App Store Prep (Next)

### Task #8: Hide/Gate Non-MVP Screens
- [ ] Profile screen → hide Wardrobe link or add "Coming Soon"
- [ ] Verify Leaderboard works or hide
- [ ] Verify Style Evolution works or hide
- [ ] Remove any dead links to incomplete features

### Task #9: Verify Onboarding Flow
- [ ] Remove `DevAuthGate` usage (already done in Sprint 1)
- [ ] Test fresh install → sign up → onboarding → home screen
- [ ] Verify onboarding can't be skipped
- [ ] Verify `hasCompletedOnboarding` flag works

### Task #10: RevenueCat Product ID Alignment
- [ ] Match product IDs in code to App Store Connect
- [ ] Match product IDs in code to Google Play Console
- [ ] Consider rebranding prefix: `fitcheck_` → `orthis_`
- [ ] Test subscription purchase in sandbox mode

### Task #11: App Store Assets
- [ ] App icon (already configured ✅)
- [ ] iOS screenshots (5 required: 6.7" display)
- [ ] Android screenshots (phone + 7" tablet)
- [ ] Privacy policy URL
- [ ] Terms of service URL
- [ ] App Store description (English)
- [ ] App Store keywords
- [ ] Support URL/email

---

## 🚀 Sprint 4: Testing & Submission (Final)

### Task #12: End-to-End Testing
- [ ] Full E2E test on physical iOS device
- [ ] Full E2E test on physical Android device
- [ ] Test with poor network conditions
- [ ] Test expired token handling
- [ ] Test subscription expiry flow
- [ ] Load testing (optional but recommended)

### iOS App Store Submission
- [ ] Enroll in Apple Developer Program ($99/year)
- [ ] Create App Store Connect app listing
- [ ] Configure App Store metadata
- [ ] Build with EAS: `eas build --platform ios`
- [ ] Upload to App Store Connect
- [ ] Submit for review (1-3 day review time)

### Google Play Submission
- [ ] Enroll in Google Play Console ($25 one-time)
- [ ] Create Play Store app listing
- [ ] Configure Play Store metadata
- [ ] Build with EAS: `eas build --platform android`
- [ ] Upload to Play Console
- [ ] Submit for review (hours to 1-2 days)

---

## 📊 Environment Variables Reference

### Frontend (`fitcheck-app/.env`)
```env
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
EXPO_PUBLIC_API_URL=https://fitcheck-production-0f92.up.railway.app
EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_...
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=goog_...
```

### Backend (Railway Variables)
```env
DATABASE_URL=postgresql://... (auto-configured by Railway)
NODE_ENV=production
PORT=3000 (auto-configured by Railway)
CLERK_SECRET_KEY=sk_live_...
CLERK_WEBHOOK_SECRET=whsec_...
GEMINI_API_KEY=...

# Optional (for cloud image storage):
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=orthis-images
```

---

## 🔗 Important Links

- **Backend Health Check:** https://fitcheck-production-0f92.up.railway.app/health
- **Railway Dashboard:** https://railway.app/dashboard
- **Clerk Dashboard:** https://dashboard.clerk.com
- **RevenueCat Dashboard:** https://app.revenuecat.com
- **GitHub Repo:** https://github.com/Bradavis2011/FitCheck
- **Deployment Guide:** `DEPLOYMENT_GUIDE.md`
- **Post-Deployment Setup:** `POST_DEPLOYMENT_SETUP.md`

---

## 🆘 Quick Troubleshooting

| Error | Solution |
|-------|----------|
| "Network request failed" | Check `EXPO_PUBLIC_API_URL` in frontend `.env` |
| "Invalid or expired token" | Verify Clerk keys, sign out and back in |
| 500 error on outfit check | Check Railway logs, verify `GEMINI_API_KEY` |
| User tier not updating | Configure RevenueCat webhook, check product IDs |
| "Daily limit reached" immediately | Check database `dailyChecksUsed` field, verify reset logic |

---

## 📈 Current Architecture

```
┌─────────────────────────────────────────────┐
│           Expo React Native App             │
│     (fitcheck-app - Local/Expo Go)          │
│                                             │
│  Clerk Auth │ RevenueCat │ Zustand Store   │
└──────────────────┬──────────────────────────┘
                   │ HTTPS
                   ├─────────────────────────────────┐
                   │                                 │
                   ▼                                 ▼
      ┌─────────────────────────┐      ┌──────────────────────┐
      │   Railway Backend       │      │   Clerk Auth Server  │
      │  (fitcheck-api)         │◄─────│   (webhook)          │
      │                         │      └──────────────────────┘
      │  Express + TypeScript   │
      │  Clerk verification     │      ┌──────────────────────┐
      │  Gemini AI integration  │◄─────│  RevenueCat Server   │
      │  Base64 image storage   │      │   (webhook)          │
      └─────────┬───────────────┘      └──────────────────────┘
                │
                ▼
      ┌─────────────────────────┐
      │  Railway PostgreSQL     │
      │  (Production Database)  │
      │                         │
      │  Users, OutfitChecks,   │
      │  FollowUps, Stats, etc. │
      └─────────────────────────┘
```

**Next Architecture Addition (Sprint 2 Recommended):**
- Add Cloudflare R2 or AWS S3 for image storage
- Replace base64 storage in PostgreSQL
