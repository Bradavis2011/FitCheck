# FitCheck Monetization Testing Checklist

## Prerequisites ✅

- [x] Backend running on port 3000
- [x] Subscription endpoints deployed
- [x] RevenueCat Android app configured
- [ ] Android dev build ready (.apk downloaded)
- [ ] Android device/emulator ready

---

## Step 1: Install the Development Build

### Download Your .apk
Once your build completes, download from:
- **EAS Dashboard**: https://expo.dev → Builds
- **Direct link**: Will be in the build completion message

### Install on Android
**Option A: Physical Device**
1. Transfer .apk to your phone
2. Enable "Install from Unknown Sources" in Settings
3. Tap the .apk to install
4. Open "FitCheck"

**Option B: Android Emulator**
1. Open Android Studio → Virtual Device Manager
2. Start an emulator
3. Drag the .apk onto the emulator window
4. Wait for installation
5. Open "FitCheck" from app drawer

---

## Step 2: Start the Dev Server

```bash
cd fitcheck-app
npm start
```

Press **'a'** for Android when prompted.

The app should connect and load.

---

## Step 3: Test Authentication Flow

1. ✅ **Launch app** - should redirect to login
2. ✅ **Login/Register** - use dev mode (email/password)
3. ✅ **Verify you're authenticated** - should see Home screen

**Expected**: You're now on the Home tab as a **free tier** user.

---

## Step 4: Test Free Tier Limits

### Daily Check Limit (3 per day)
1. Go to **Camera** tab
2. Take a photo or choose from gallery
3. Submit context (occasion, etc.)
4. **Repeat 3 times**
5. On the **4th attempt**, you should see:
   - ❌ "Daily limit reached. Upgrade to Plus for unlimited checks!"
   - 🔗 Alert should have a button/link

**Expected**: Free tier is limited to 3 checks/day ✅

### Follow-up Limit (3 per check)
1. View feedback for any outfit
2. Tap "Ask a follow-up question"
3. Ask 3 questions
4. On the **4th attempt**, you should see:
   - ❌ "Follow-up limit reached. Tap to upgrade for more questions!"
   - Message should be **tappable**

**Expected**: Free tier gets 3 follow-ups per check ✅

### History Limit (7 days)
1. Go to **History** tab
2. If you have outfits older than 7 days, they should be **hidden**
3. Only last 7 days visible

**Expected**: Free tier sees only last 7 days ✅

---

## Step 5: Test Paywall Screen

### Access from Home Screen
1. Go to **Home** tab
2. Scroll down to see "Upgrade to Plus" gradient card
3. Tap it
4. **Should navigate to `/upgrade` screen**

**Expected**: Beautiful paywall with Free/Plus/Pro tiers ✅

### Access from Profile Screen
1. Go to **Profile** tab
2. Scroll down to "Upgrade to Plus" card
3. Tap it
4. **Should navigate to `/upgrade`**

**Expected**: Same paywall opens ✅

### Access from Limit Messages
1. Hit a limit (daily checks or follow-ups)
2. Tap the limit message
3. **Should navigate to `/upgrade`**

**Expected**: All limit CTAs lead to paywall ✅

---

## Step 6: Test Paywall UI

On the `/upgrade` screen:

### Visual Check
- [ ] Three tiers shown: **Free**, **Plus**, **Pro**
- [ ] Monthly/Annual toggle present (defaults to Annual)
- [ ] Plus card has "MOST POPULAR" badge
- [ ] Pro card has "BEST VALUE" badge
- [ ] Prices loaded from RevenueCat (not hardcoded)
- [ ] "Restore Purchases" link at bottom

### Toggle Annual/Monthly
- [ ] Tap Monthly → prices update to monthly
- [ ] Tap Annual → prices update to annual (shows "Save 30%" badge)

### Free Tier Card
- [ ] Shows "Current Plan" button (grayed out)
- [ ] Lists features: 3 checks/day, 3 follow-ups, 7-day history, ads

**Expected**: Paywall looks polished ✅

---

## Step 7: Test Sandbox Purchase (Android)

### Set Up Google Play Sandbox
1. Go to **Google Play Console** → Testing → License Testing
2. Add your Gmail account to testers
3. On your Android device, sign in with that Gmail

### Make a Test Purchase
1. On paywall, tap **"Start Free Trial"** on Plus tier
2. Google Play payment sheet appears
3. Should show sandbox test card
4. Complete purchase

**Expected Results:**
- ✅ Purchase succeeds (sandbox mode)
- ✅ App shows "Welcome to Plus!" alert
- ✅ Navigates back from paywall
- ✅ RevenueCat SDK updates customer info

---

## Step 8: Verify Tier Upgrade

### Frontend Verification
1. Go to **Profile** tab
2. Check tier badge - should show **"Plus"** (not "Free")
3. Badge background should be **indigo/blue**
4. "Upgrade to Plus" card should be **hidden**

### Backend Verification (Check Logs)
1. In your terminal (backend logs), you should see:
   ```
   [Subscription] Synced user <userId> to tier plus
   ```

### Database Verification
```bash
# In another terminal
cd fitcheck-api
npx prisma studio
```
1. Open `users` table
2. Find your user
3. Check `tier` field = **"plus"**
4. Check `subscriptionProductId` = **"fitcheck_plus_monthly"** or **"fitcheck_plus_annual"**

**Expected**: User tier updated everywhere ✅

---

## Step 9: Test Plus Tier Features

### Unlimited Daily Checks
1. Go to **Camera** tab
2. Submit 10+ outfit checks
3. **Should NOT be blocked**

**Expected**: No daily limit ✅

### More Follow-ups (5 per check)
1. View any outfit feedback
2. Ask 5 follow-up questions
3. **On 6th attempt**, should see limit message

**Expected**: Plus tier gets 5 follow-ups ✅

### Unlimited History
1. Go to **History** tab
2. All outfits visible (even older than 7 days)

**Expected**: All history visible ✅

### No Ads
1. Browse the app
2. No ads shown anywhere

**Expected**: Ad-free experience ✅

---

## Step 10: Test Webhook (Backend)

### Trigger a Webhook
1. Go to **RevenueCat Dashboard** → Integrations → Webhooks
2. Click "Send Test Event"
3. Select **INITIAL_PURCHASE** event
4. Enter your user's RevenueCat ID (= Clerk user ID)
5. Send webhook

### Verify Webhook Received
Check backend logs for:
```
[Subscription] User <userId> upgraded to plus
```

### Check Database
```sql
-- In Prisma Studio
SELECT * FROM subscription_events
WHERE user_id = '<your-user-id>'
ORDER BY processed_at DESC;
```

**Expected**: Webhook logged in `subscription_events` table ✅

---

## Step 11: Test Restore Purchases

### Simulate Reinstall
1. Uninstall the app
2. Reinstall from the same .apk
3. Login with same account
4. Go to `/upgrade` screen
5. Tap **"Restore Purchases"**

**Expected**:
- ✅ RevenueCat restores subscription
- ✅ Tier updates to Plus
- ✅ Alert: "Purchases Restored"

---

## Step 12: Test Cancellation Flow

### Cancel Subscription (Sandbox)
In Google Play Console:
1. Go to Order Management → Subscriptions
2. Find test subscription
3. Cancel it

**Expected**:
- ✅ RevenueCat sends CANCELLATION webhook
- ✅ User keeps Plus until expiration date
- ✅ After expiration, reverts to Free

---

## Common Issues & Fixes

### Issue: "Offerings not loading"
**Fix**: Check RevenueCat dashboard → Products are configured with correct IDs

### Issue: "Purchase fails immediately"
**Fix**: Make sure you're signed into Google Play with a tester account

### Issue: "Tier not updating after purchase"
**Fix**:
1. Check backend logs for sync errors
2. Verify RevenueCat webhook is configured
3. Check `subscription_events` table for webhook receipt

### Issue: "Free tier limits not working"
**Fix**: Backend tier constants are set correctly (already done ✅)

---

## Success Criteria

- [ ] Free tier: 3 checks/day limit enforced
- [ ] Free tier: 3 follow-ups/check enforced
- [ ] Free tier: 7-day history enforced
- [ ] Paywall accessible from Home, Profile, and limit messages
- [ ] Paywall displays 3 tiers with correct pricing
- [ ] Purchase flow works in sandbox mode
- [ ] Tier updates after purchase (frontend + backend + database)
- [ ] Plus tier: unlimited checks
- [ ] Plus tier: 5 follow-ups per check
- [ ] Plus tier: unlimited history
- [ ] Webhook logs events to database
- [ ] Restore purchases works

---

## Next Steps After Testing

1. **Fix any bugs found** during testing
2. **Set up real App Store Connect / Google Play products** (not sandbox)
3. **Configure RevenueCat webhook** to production API URL
4. **Test on iOS** (requires Apple Developer account + IAP key)
5. **Deploy to production**
6. **Submit to app stores**

---

## Quick Reference

| What | Where |
|------|-------|
| Backend logs | Terminal running `npm run dev` |
| Database | `npx prisma studio` |
| Build status | https://expo.dev → Builds |
| RevenueCat dashboard | https://app.revenuecat.com |
| Webhook logs | RevenueCat → Integrations → Webhooks |
| Subscription events | Prisma Studio → `subscription_events` table |
