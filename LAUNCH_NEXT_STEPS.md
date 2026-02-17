# Launch Next Steps

Detailed instructions for completing the remaining launch tasks after the audit readiness changes.

---

## 1. Install New Dependencies

The Sentry packages were added to `package.json` but not yet installed.

```bash
# Backend
cd fitcheck-api
npm install

# Frontend
cd ../fitcheck-app
npm install
```

Verify both projects still build cleanly:

```bash
# Backend
cd fitcheck-api
npm run build

# Frontend
cd ../fitcheck-app
npx expo start
```

---

## 2. Create a Sentry Project

1. Go to [sentry.io](https://sentry.io) and create a free account (or log in)
2. Create an **organization** called `orthis` (or your preferred name)
3. Create **two projects**:

### Mobile App Project
- Platform: **React Native**
- Project name: `orthis-mobile`
- After creation, copy the **DSN** (looks like `https://abc123@o123456.ingest.sentry.io/789`)
- Add it to your local `.env`:
  ```
  EXPO_PUBLIC_SENTRY_DSN=https://your-actual-dsn@o0.ingest.sentry.io/0
  ```
- Add the same value in your EAS build secrets (if using EAS Build)

### API Project
- Platform: **Node.js / Express**
- Project name: `orthis-api`
- Copy the DSN
- Add it to Railway environment variables:
  ```
  SENTRY_DSN=https://your-actual-dsn@o0.ingest.sentry.io/0
  ```

### Verify Sentry Works
- **Backend:** Start the API locally with `SENTRY_DSN` set and trigger a test error. Check the Sentry dashboard for the event.
- **Frontend:** Run the app and call `Sentry.captureMessage('test')` from a useEffect temporarily. Confirm it appears in the dashboard, then remove the test code.

---

## 3. Set CORS_ORIGIN in Railway

1. Open [Railway dashboard](https://railway.app/dashboard)
2. Select your `orthis-api` service
3. Go to **Variables**
4. Add or update:
   ```
   CORS_ORIGIN=https://orthis.app,https://www.orthis.app
   ```
   If you also have a staging frontend, include that domain too:
   ```
   CORS_ORIGIN=https://orthis.app,https://www.orthis.app,https://staging.orthis.app
   ```
5. Railway will auto-redeploy. Verify by hitting the `/health` endpoint.

> **Note:** CORS only affects browser-based requests. The React Native mobile app is not affected by CORS, but the landing page web app at `orthis.app` will be.

---

## 4. Deploy Privacy Policy & Terms of Service Pages

The App Store and Google Play both require live URLs for your privacy policy and terms of service.

### If using the `orthis-web` landing page (already in repo):

1. Verify the pages exist:
   - `orthis-web/` should have routes for `/privacy` and `/terms`
2. Deploy to your hosting provider (Vercel, Netlify, etc.)
3. Confirm these URLs return content:
   - `https://orthis.app/privacy`
   - `https://orthis.app/terms`

### If pages don't exist yet:

Create them in your web project. At minimum they need:
- **Privacy Policy:** What data you collect (email, photos, usage analytics), how it's stored, how users can delete their data (the delete account feature you now have), and third-party services (Clerk, Sentry, RevenueCat, Google Gemini)
- **Terms of Service:** Acceptable use, content ownership, subscription terms, liability limitations

> **Important:** Apple will reject your app if these URLs return 404.

---

## 5. Take App Store Screenshots

You need screenshots for every required device size. Use the Expo development build or the iOS Simulator.

### Required Sizes

| Device Class | Resolution | Required For |
|---|---|---|
| iPhone 6.7" | 1290 x 2796 | iPhone 15 Pro Max (required) |
| iPhone 6.5" | 1242 x 2688 | iPhone 11 Pro Max (required) |
| iPad 12.9" | 2048 x 2732 | iPad Pro (if supporting tablet) |

### Screens to Capture

Capture these 6 screens in order (they tell a story):

1. **Home screen** — Shows the greeting, CTA card, and daily checks counter
2. **Camera screen** — Viewfinder with the silhouette guide visible
3. **Feedback results** — A real outfit score with the detailed breakdown expanded
4. **Style DNA** — The style profile page showing top colors and archetypes
5. **Community feed** — Public outfits with community ratings visible
6. **Profile + gamification** — Badges, streaks, and leaderboard rank

### How to Capture

```bash
# Run on iOS Simulator for pixel-perfect screenshots
npx expo run:ios --device "iPhone 15 Pro Max"
```

Then use `Cmd+S` in Simulator to save screenshots, or use Fastlane's `snapshot` tool for automation.

### Tips
- Use a real account with actual outfit data — empty states look bad
- Make sure the status bar shows a clean time (set Simulator time to 9:41 AM)
- Don't include any debug UI or dev banners

---

## 6. Submit to Apple App Store

### Prerequisites
- Apple Developer account ($99/year) at [developer.apple.com](https://developer.apple.com)
- EAS CLI installed: `npm install -g eas-cli`
- Logged in: `eas login`

### Build for Production

```bash
cd fitcheck-app

# Configure EAS Build (first time only)
eas build:configure

# Build for iOS
eas build --platform ios --profile production
```

### Submit to App Store Connect

```bash
# Submit the build
eas submit --platform ios
```

Or manually:
1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Create a new app with bundle ID `com.bradavis.orthis`
3. Fill in metadata from `APP_STORE_METADATA.md`:
   - App name: `Or This?`
   - Subtitle: `Instant AI Outfit Feedback`
   - Description, keywords, categories
   - Privacy policy URL: `https://orthis.app/privacy`
   - Support URL: `https://orthis.app/help`
4. Upload screenshots for each required device size
5. Set age rating to **4+**
6. Under **App Privacy**, declare data collection (see `APP_STORE_METADATA.md`)
7. Select the build you uploaded
8. Submit for review

### Common Rejection Reasons to Watch For
- Privacy policy URL returns 404
- No way to delete account (you now have this)
- Screenshots show placeholder/mock data
- App crashes on launch (test the production build first)
- In-app purchases not configured in App Store Connect (set up RevenueCat products)

---

## 7. Submit to Google Play Store

### Prerequisites
- Google Play Developer account ($25 one-time) at [play.google.com/console](https://play.google.com/console)

### Build for Production

```bash
cd fitcheck-app

# Build for Android
eas build --platform android --profile production
```

### Submit to Google Play Console

```bash
eas submit --platform android
```

Or manually:
1. Go to [Google Play Console](https://play.google.com/console)
2. Create a new app
3. Fill in metadata from `APP_STORE_METADATA.md`:
   - Short description (80 chars max)
   - Full description
   - Category: Lifestyle
4. Upload the AAB file from the EAS build
5. Add screenshots (minimum 2, recommended 6)
6. Set content rating to **Everyone**
7. Set up pricing (Free with in-app purchases)
8. Complete the Data Safety questionnaire (matches `APP_STORE_METADATA.md` privacy section)
9. Submit for review

---

## 8. Configure RevenueCat Products (if not done)

Both stores need in-app purchase products configured before you can test or ship subscriptions.

### Apple App Store Connect
1. Go to **App Store Connect > Your App > In-App Purchases**
2. Create subscription group: `orthis_subscriptions`
3. Add products:
   - `orthis_plus_monthly` — Plus tier, monthly
   - `orthis_plus_yearly` — Plus tier, yearly
   - `orthis_pro_monthly` — Pro tier, monthly
   - `orthis_pro_yearly` — Pro tier, yearly
4. Set pricing for each

### Google Play Console
1. Go to **Monetization > Subscriptions**
2. Create matching products with the same IDs

### RevenueCat Dashboard
1. Go to [app.revenuecat.com](https://app.revenuecat.com)
2. Connect both stores under your project
3. Create **Entitlements**: `plus`, `pro`
4. Map each store product to the correct entitlement
5. Verify the webhook URL is set to your Railway deployment:
   ```
   https://your-api.up.railway.app/api/webhooks/revenuecat
   ```

---

## 9. Pre-Launch Testing Checklist

Run through this before submitting to either store:

- [ ] Production build installs and launches without crashes
- [ ] Sign up / sign in flow works end-to-end
- [ ] Camera permission prompt appears and functions correctly
- [ ] Photo capture and gallery pick both work
- [ ] Outfit check submits and returns AI feedback
- [ ] Follow-up questions work
- [ ] Community feed loads public outfits
- [ ] Push notification permission prompt appears (physical device only)
- [ ] Subscription paywall displays correct pricing
- [ ] Purchase flow completes (use sandbox/test accounts)
- [ ] Delete account works and signs user out
- [ ] Clear history works and resets outfit count
- [ ] Privacy settings save correctly
- [ ] Deep links work (if applicable)
- [ ] App handles no network gracefully
- [ ] No console errors or warnings in production build

---

## 10. Post-Launch Monitoring

After both stores approve and the app goes live:

1. **Watch Sentry** for crash reports in the first 24-48 hours
2. **Check Railway logs** for API errors
3. **Monitor RevenueCat** for subscription events
4. **Reply to early reviews** on both stores
5. **Track daily active users** via Sentry session tracking or add analytics (Mixpanel, PostHog, etc.)
