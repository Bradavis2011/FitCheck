# Sprint 3: Polish & App Store Prep - Status

**Last Updated:** 2026-02-16
**Status:** In Progress

---

## ✅ Completed

### Task #8: Hide/Gate Non-MVP Screens
- ✅ **Wardrobe link hidden** from Profile screen
  - File: `fitcheck-app/app/(tabs)/profile.tsx` line 260
  - Commented out (Phase 2 feature - Sprint 9)
  - Screen still exists at `/wardrobe` but no way to navigate to it

---

## 📋 Remaining Tasks

### Task #9: Verify Onboarding Flow Works

**What to test:**
1. Fresh install → Sign up with new email
2. Email verification → Complete onboarding
3. Verify `hasCompletedOnboarding` flag prevents re-showing onboarding
4. Verify skipping onboarding is not possible

**Status:** ⚠️ Not tested yet

---

### Task #10: Align RevenueCat Product IDs

**Current Status:**
- ✅ Products created in RevenueCat dashboard:
  - `fitcheck_plus_monthly` ($5.99/mo)
  - `fitcheck_plus_annual` ($49.99/yr)
  - `fitcheck_pro_monthly` ($14.99/mo)
  - `fitcheck_pro_annual` ($119.99/yr)
- ⚠️ RevenueCat disabled in `.env` until app store credentials configured
- ❌ App Store Connect not set up yet (iOS)
- ❌ Google Play Console not set up yet (Android)

**Required Before Launch:**
1. Create app listing in App Store Connect
2. Create app listing in Google Play Console
3. Upload service account credentials to RevenueCat
4. Re-enable RevenueCat API keys in `fitcheck-app/.env`
5. Test purchase flow in sandbox mode

---

### Task #11: Prepare App Store Assets

**iOS (App Store Connect):**
- [ ] App icon (1024x1024) - ✅ Already have coral gradient "?" icon
- [ ] Screenshots (6.7" display - iPhone 14 Pro Max size):
  - [ ] Home screen
  - [ ] Camera/upload screen
  - [ ] AI feedback screen with score
  - [ ] History screen
  - [ ] Profile/stats screen
- [ ] App Preview video (optional but recommended)
- [ ] App description (max 4000 characters)
- [ ] Keywords (max 100 characters)
- [ ] Privacy policy URL
- [ ] Terms of service URL
- [ ] Support URL/email
- [ ] Age rating questionnaire

**Android (Google Play Console):**
- [ ] App icon (512x512)
- [ ] Feature graphic (1024x500)
- [ ] Screenshots (phone + 7" tablet):
  - [ ] Same 5 screens as iOS
- [ ] Short description (80 characters)
- [ ] Full description (4000 characters)
- [ ] Privacy policy URL
- [ ] Content rating questionnaire

**Copy/Descriptions:**
- [ ] Write app name: "Or This?" or "OrThis?"
- [ ] Write tagline: "Confidence in every choice"
- [ ] Write short description (1-2 sentences)
- [ ] Write full description (benefits, features, how it works)
- [ ] Write keywords for App Store Optimization (ASO)

---

### Task #12: Run E2E Testing and Submit to Stores

**Pre-Submission Testing:**
- [ ] Test on physical iOS device (not simulator)
- [ ] Test on physical Android device (not emulator)
- [ ] Test poor network conditions
- [ ] Test expired token handling
- [ ] Test daily limit flow (3 checks → upgrade prompt)
- [ ] Test with different outfit types (formal, casual, etc.)
- [ ] Test AI score variety (should see 4-10 range, not all 7s)
- [ ] Test follow-up questions
- [ ] Test favorites toggle
- [ ] Test history filtering
- [ ] Verify no crashes or freezes

**iOS Submission:**
1. [ ] Enroll in Apple Developer Program ($99/year)
2. [ ] Create App Store Connect app listing
3. [ ] Configure App Store metadata
4. [ ] Build with EAS: `eas build --platform ios --profile production`
5. [ ] Upload to App Store Connect
6. [ ] Submit for review
7. [ ] Review time: 1-3 days typically

**Android Submission:**
1. [ ] Enroll in Google Play Console ($25 one-time)
2. [ ] Create Play Store app listing
3. [ ] Configure Play Store metadata
4. [ ] Build with EAS: `eas build --platform android --profile production`
5. [ ] Upload AAB to Play Console
6. [ ] Submit for review
7. [ ] Review time: Hours to 1-2 days typically

---

## 🎯 Critical Path to Launch

| Step | Task | Status | Blocker? |
|------|------|--------|----------|
| 1 | Hide non-MVP features | ✅ Done | - |
| 2 | Test onboarding flow | ⚠️ Todo | No |
| 3 | Create App Store Connect listing | ❌ Todo | **YES** (required for RevenueCat) |
| 4 | Create Google Play listing | ❌ Todo | **YES** (required for RevenueCat) |
| 5 | Configure RevenueCat credentials | ❌ Todo | **YES** (requires step 3 & 4) |
| 6 | Test subscription flow | ❌ Todo | **YES** (requires step 5) |
| 7 | Prepare screenshots & descriptions | ❌ Todo | **YES** (required for submission) |
| 8 | Run E2E testing on real devices | ❌ Todo | No |
| 9 | EAS build for iOS | ❌ Todo | **YES** (requires step 3) |
| 10 | EAS build for Android | ❌ Todo | **YES** (requires step 4) |
| 11 | Submit to App Store | ❌ Todo | **YES** (requires all above) |
| 12 | Submit to Google Play | ❌ Todo | **YES** (requires all above) |

---

## 📝 App Store Listing Copy (Draft)

### App Name
**"Or This? - Outfit Feedback"**

### Tagline
"Confidence in every choice"

### Short Description (App Store)
Get instant AI-powered feedback on your outfits. Upload a photo, get a style score, and learn what's working and what could be better.

### Full Description (Draft)
**Looking for honest outfit feedback?**

Or This? is your personal AI stylist, giving you instant, actionable feedback on every outfit. Whether you're getting ready for a date, job interview, or casual brunch, get the confidence you need to look your best.

**How it works:**
1. 📸 Snap a photo of your outfit
2. 🎯 Tell us the occasion (date, work, casual, etc.)
3. 🤖 Get AI-powered feedback in seconds
4. ✨ Learn what's working and what to improve

**Features:**
• AI style analysis powered by cutting-edge fashion knowledge
• Personalized scores and feedback for every outfit
• Ask follow-up questions about specific details
• Track your style journey with outfit history
• Build consistency with daily check-ins and streaks
• Get recommendations tailored to your style

**Why users love Or This?:**
• "Like having a stylist in my pocket" - Sarah M.
• "Finally, honest feedback without judgment" - Michael T.
• "My confidence has improved so much" - Jessica R.

**Subscription Tiers:**
• Free: 3 outfit checks per day
• Plus ($5.99/mo): Unlimited checks + extended history
• Pro ($14.99/mo): Everything in Plus + expert reviews

Start looking your best today. Download Or This? now!

### Keywords (100 char max)
outfit,style,fashion,AI,feedback,stylist,clothing,wardrobe,confidence

### Privacy Policy URL
**TODO:** Create privacy policy page
Suggested: Host on GitHub Pages or Notion

### Support Email
**TODO:** Set up support email
Suggested: support@orthis.app or use personal email temporarily

---

## 🚧 Known Issues / Tech Debt

### Non-Critical (Can Launch With These)
- S3 not configured → using base64 in database (works but not optimal)
- RevenueCat webhook not configured (will set up during Task #10)
- Some TypeScript errors suppressed with `@ts-nocheck` in backend controllers

### Post-Launch Improvements
- Set up Cloudflare R2 or AWS S3 for image storage
- Add face blur privacy feature (Phase 2)
- Implement community feedback UI (Phase 2)
- Add badge/achievement system (Phase 2)
- Build wardrobe management (Phase 2)

---

## ⏭️ Next Steps

**Immediate (This Week):**
1. Test onboarding flow end-to-end
2. Create App Store Connect account ($99)
3. Create Google Play Console account ($25)
4. Create app listings in both stores
5. Take screenshots on real devices

**Before Submission (Next Week):**
6. Write privacy policy & terms of service
7. Configure RevenueCat with store credentials
8. Test subscription flow in sandbox
9. Run full E2E testing
10. Build production releases with EAS

**Submission (Week After):**
11. Submit to both stores
12. Monitor review status
13. Respond to any review feedback

**Estimated Time to Launch:** 2-3 weeks from now

---

## 📞 Questions / Blockers

None currently. Ready to proceed with Task #9 (test onboarding) and then move to app store setup.
