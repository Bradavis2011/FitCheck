# Monetization Implementation Summary

## ✅ What Was Built (Sprint 1-2: RevenueCat Subscriptions)

All 6 implementation steps are now complete!

---

## Backend Changes (Steps 1-3)

### 1. Tier Configuration System
**Created:** `fitcheck-api/src/constants/tiers.ts`

Centralized tier limits:
- **Free**: 3 checks/day, 3 follow-ups/check, 7-day history
- **Plus**: Unlimited checks, 5 follow-ups, unlimited history, no ads
- **Pro**: Unlimited checks, 10 follow-ups, unlimited history, 5 expert reviews/month

### 2. Database Schema Updates
**Modified:** `fitcheck-api/prisma/schema.prisma`

Added to User model:
- `revenuecatId` (String?, unique)
- `subscriptionProductId` (String?)
- `subscriptionStore` (String?)

New model:
- `SubscriptionEvent` - audit log for all webhook events

**Migration:** Applied with `npx prisma db push`

### 3. Subscription Service & Endpoints
**Created:**
- `fitcheck-api/src/services/subscription.service.ts`
  - `processWebhookEvent()` - handles RevenueCat webhook events
  - `syncSubscriptionFromClient()` - client-initiated sync on app launch

- `fitcheck-api/src/controllers/subscription.controller.ts`
  - `POST /api/webhooks/revenuecat` - webhook handler (Bearer auth)
  - `POST /api/subscription/sync` - client sync (Clerk auth)
  - `GET /api/subscription/status` - returns tier + limits

- `fitcheck-api/src/routes/subscription.routes.ts`

**Modified:** `fitcheck-api/src/server.ts`
- Webhook registered BEFORE rate limiter
- Subscription routes registered with other authenticated routes

### 4. Refactored Tier Enforcement
**Modified:**
- `fitcheck-api/src/controllers/outfit.controller.ts`
  - Line 144: Daily check limit now uses `getTierLimits()`
  - Line 324: Follow-up limit now uses `getTierLimits()`
  - Line 252-296: History gating (free tier sees only last 7 days)

- `fitcheck-api/src/controllers/user.controller.ts`
  - Line 128: Daily checks limit calculation uses `getTierLimits()`

---

## Frontend Changes (Steps 4-6)

### 5. RevenueCat SDK Integration
**Installed:** `react-native-purchases` (with `--legacy-peer-deps`)

**Created:**
- `fitcheck-app/src/services/purchases.service.ts`
  - Wrapper around RevenueCat SDK
  - `initializePurchases()`, `getOfferings()`, `purchasePackage()`, `restorePurchases()`
  - `getTierFromCustomerInfo()` - maps entitlements to tiers

- `fitcheck-app/src/stores/subscriptionStore.ts` (Zustand)
  - State: `tier`, `offerings`, `customerInfo`, `limits`
  - Actions: `initialize()`, `purchase()`, `restore()`, `syncWithBackend()`

**Modified:**
- `fitcheck-app/src/services/api.service.ts`
  - Added `subscriptionService` with `syncSubscription()` and `getSubscriptionStatus()`

- `fitcheck-app/src/hooks/useApi.ts`
  - Added `useSubscriptionStatus()` query hook
  - Added `useSyncSubscription()` mutation hook

- `fitcheck-app/app/_layout.tsx`
  - `AuthGate` (Clerk): initializes RevenueCat after sign-in
  - `DevAuthGate` (dev mode): initializes RevenueCat after auth

**Environment Variables Added:**
- `EXPO_PUBLIC_REVENUECAT_IOS_KEY`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`

### 6. Paywall Screen
**Created:** `fitcheck-app/app/upgrade.tsx`

Features:
- Monthly/Annual toggle (defaults to annual for better conversion)
- Three tier comparison:
  - **Free** (for comparison) - current plan badge
  - **Plus** - "MOST POPULAR" badge, highlighted border
  - **Pro** - "BEST VALUE" badge
- Prices fetched from RevenueCat (with fallbacks)
- "Start Free Trial" buttons
- "Restore Purchases" link
- For subscribed users: shows current plan + "Manage Subscription" link

### 7. Wired All Upgrade CTAs
**Modified:**
- `fitcheck-app/app/(tabs)/index.tsx` (Home)
  - Upgrade card only shows for `tier === 'free'`
  - Wrapped in TouchableOpacity → navigates to `/upgrade`
  - Button text: "See Plans" (was "Coming Soon")

- `fitcheck-app/app/(tabs)/profile.tsx` (Profile)
  - Upgrade card only shows for free tier
  - Tier badge colors: indigo for Plus, pink for Pro
  - Navigates to `/upgrade`

- `fitcheck-app/src/components/FollowUpModal.tsx`
  - Limit-reached message is now tappable
  - Closes modal and navigates to `/upgrade`
  - Added chevron icon to indicate tapability

- `fitcheck-app/app/feedback.tsx`
  - `maxFollowUps` prop now dynamic: `limits?.followUpsPerCheck ?? 3`

---

## Files Created (8)

| File | Purpose |
|------|---------|
| `fitcheck-api/src/constants/tiers.ts` | Tier limits config |
| `fitcheck-api/src/services/subscription.service.ts` | Webhook processing + sync logic |
| `fitcheck-api/src/controllers/subscription.controller.ts` | API endpoints |
| `fitcheck-api/src/routes/subscription.routes.ts` | Route definitions |
| `fitcheck-app/src/services/purchases.service.ts` | RevenueCat SDK wrapper |
| `fitcheck-app/src/stores/subscriptionStore.ts` | Subscription state (Zustand) |
| `fitcheck-app/app/upgrade.tsx` | Paywall screen |
| `EAS_BUILD_SETUP.md` | Build instructions |

---

## Files Modified (13)

| File | Changes |
|------|---------|
| `fitcheck-api/prisma/schema.prisma` | Added subscription fields + SubscriptionEvent model |
| `fitcheck-api/src/server.ts` | Registered webhook + subscription routes |
| `fitcheck-api/src/controllers/outfit.controller.ts` | Centralized tier limits |
| `fitcheck-api/src/controllers/user.controller.ts` | Centralized tier limits |
| `fitcheck-api/.env` | Added RevenueCat env vars |
| `fitcheck-app/src/services/api.service.ts` | Added subscriptionService |
| `fitcheck-app/src/hooks/useApi.ts` | Added subscription hooks |
| `fitcheck-app/app/_layout.tsx` | Initialize RevenueCat after auth |
| `fitcheck-app/app/(tabs)/index.tsx` | Wired upgrade card |
| `fitcheck-app/app/(tabs)/profile.tsx` | Wired upgrade card + tier badge colors |
| `fitcheck-app/src/components/FollowUpModal.tsx` | Made limit message tappable |
| `fitcheck-app/app/feedback.tsx` | Dynamic maxFollowUps |
| `fitcheck-app/.env` | Added RevenueCat env vars |

---

## Environment Variables Required

### Backend (`fitcheck-api/.env`)
```
REVENUECAT_WEBHOOK_AUTH_TOKEN=your_random_secret_here_change_this_in_production
REVENUECAT_API_KEY=your_revenuecat_secret_api_key_here
```

### Frontend (`fitcheck-app/.env`)
```
EXPO_PUBLIC_REVENUECAT_IOS_KEY=your_ios_api_key_here
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=your_android_api_key_here
```

---

## External Setup Still Required

1. **RevenueCat Account**
   - Sign up at https://www.revenuecat.com
   - Create project
   - Add iOS and Android apps
   - Get API keys

2. **App Store Connect** (iOS)
   - Create subscription products:
     - `fitcheck_plus_monthly` ($5.99/month)
     - `fitcheck_plus_annual` ($49.99/year)
     - `fitcheck_pro_monthly` ($14.99/month)
     - `fitcheck_pro_annual` ($119.99/year)

3. **Google Play Console** (Android)
   - Same products with same IDs

4. **RevenueCat Configuration**
   - Create entitlements: `plus`, `pro`
   - Map products to entitlements
   - Create offering with both packages
   - Configure webhook URL

5. **EAS Development Builds**
   - Install EAS CLI: `npm install -g eas-cli`
   - Login: `eas login`
   - Configure: `eas build:configure` (in fitcheck-app/)
   - Build iOS: `eas build --profile development --platform ios`
   - Build Android: `eas build --profile development --platform android`

See `EAS_BUILD_SETUP.md` for detailed instructions.

---

## Testing Checklist

### Backend
- [ ] Start backend: `cd fitcheck-api && npm run dev`
- [ ] Test webhook endpoint: `curl -X POST http://localhost:3001/api/webhooks/revenuecat -H "Authorization: Bearer your_secret"`
- [ ] Verify `subscription_events` table populated
- [ ] Test tier limits: manually update user tier in DB, verify limits change

### Frontend (requires EAS dev build)
- [ ] App launches → RevenueCat initializes (check logs)
- [ ] Navigate to `/upgrade` → offerings load with real prices
- [ ] Make sandbox purchase → customer info updates → backend sync fires
- [ ] Home/Profile upgrade cards navigate to paywall
- [ ] Daily limit alert shows → links to paywall
- [ ] Follow-up limit message is tappable → navigates to paywall
- [ ] Paid user sees correct tier badge color
- [ ] Paid user doesn't see upgrade cards

### Subscription Flow
- [ ] Free tier: 3 checks/day, 3 follow-ups, 7-day history
- [ ] Plus tier: unlimited checks, 5 follow-ups, unlimited history
- [ ] Pro tier: unlimited checks, 10 follow-ups, unlimited history
- [ ] Tier badge shows correct color
- [ ] RevenueCat webhook updates user tier
- [ ] Backend syncs tier on app launch

---

## Next Steps (Beyond Sprint 1-2)

According to your roadmap:

**Sprint 3-4 (Weeks 3-4):**
- Add Pro tier with trials
- Implement annual plan pricing
- Build tier comparison UI
- A/B test pricing

**Sprint 5-6 (Weeks 5-6):**
- Integrate affiliate commerce
- Add referral system
- Implement usage analytics

**Sprint 7-8 (Weeks 7-8):**
- Production deployment
- App Store submission
- Marketing site

---

## Cost Summary

- **EAS Builds**: Free tier (30 builds/month)
- **RevenueCat**: Free up to $2.5K MRR
- **App Store**: $99/year
- **Google Play**: $25 one-time
- **Backend Hosting**: Railway/Vercel free tier for MVP

---

## Key Decisions Made

1. **Follow-up limits**: Free tier gets 3 (not 1 as in original PRD) per your request
2. **Paywall shows Free tier**: For comparison, per your request
3. **Default to annual pricing**: Better conversion framing
4. **Tier badge colors**: Indigo for Plus, Pink for Pro
5. **Webhook before rate limiter**: RevenueCat may burst-send events
6. **Database:** Used `db push` instead of migrations (detected drift)

---

## Architecture Notes

- **RevenueCat is source of truth** for subscription state
- **Backend syncs via webhooks** (server-initiated) + client sync (app launch)
- **Backend enforces limits** on API requests (not client-side)
- **Frontend displays state** and handles purchases
- **Zustand store** caches subscription info to avoid repeated API calls
- **React Query** manages backend sync invalidation
