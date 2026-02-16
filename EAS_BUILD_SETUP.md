# EAS Build Setup Guide for FitCheck

## Why You Need EAS Builds

`react-native-purchases` contains native code and **will NOT work** in Expo Go. You need to create a development build using Expo Application Services (EAS).

---

## Prerequisites

1. **Expo Account**: Sign up at https://expo.dev
2. **EAS CLI**: Install globally
   ```bash
   npm install -g eas-cli
   ```
3. **Login to EAS**:
   ```bash
   eas login
   ```

---

## Step 1: Configure EAS

Run this from the `fitcheck-app/` directory:

```bash
cd fitcheck-app
eas build:configure
```

This creates `eas.json` with build profiles.

---

## Step 2: Update eas.json

The generated `eas.json` should look like this:

```json
{
  "cli": {
    "version": ">= 5.9.1"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  },
  "submit": {
    "production": {}
  }
}
```

---

## Step 3: Create Development Builds

### For iOS (Simulator)

```bash
eas build --profile development --platform ios
```

This takes 10-20 minutes. Once complete, EAS will provide a download link.

**Install on Simulator:**
1. Download the `.tar.gz` file
2. Extract it to get the `.app` file
3. Drag the `.app` into your iOS Simulator

**OR** use the QR code/link to install directly if building for physical device.

### For Android

```bash
eas build --profile development --platform android
```

This creates an `.apk` file. Download and install on your Android device or emulator.

---

## Step 4: Run the Development Build

### iOS Simulator
1. Open the FitCheck app you installed (not Expo Go)
2. In your terminal, run:
   ```bash
   cd fitcheck-app
   npm start
   ```
3. Press `i` to open in iOS Simulator
4. The dev build will connect to your Metro bundler

### Android
1. Open the FitCheck app on your device/emulator
2. Run `npm start` and press `a` for Android

---

## Step 5: Configure RevenueCat

Before the subscription flow works, you need to set up RevenueCat:

### Create RevenueCat Account
1. Go to https://www.revenuecat.com
2. Sign up (free up to $2.5K MRR)
3. Create a new project "FitCheck"

### Add Apps
1. In RevenueCat dashboard, add your iOS app (Bundle ID: `com.yourcompany.fitcheck`)
2. Add your Android app (Package Name: `com.yourcompany.fitcheck`)
3. Copy the **iOS API Key** and **Android API Key**

### Update Environment Variables

**Backend** (`fitcheck-api/.env`):
```
REVENUECAT_WEBHOOK_AUTH_TOKEN=generate_random_secret_here
REVENUECAT_API_KEY=your_secret_api_key_from_revenuecat
```

**Frontend** (`fitcheck-app/.env`):
```
EXPO_PUBLIC_REVENUECAT_IOS_KEY=your_ios_public_key_here
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=your_android_public_key_here
```

### Configure Products in App Store Connect / Google Play Console

1. **App Store Connect** (iOS):
   - Create subscription products:
     - `fitcheck_plus_monthly` ($5.99/month)
     - `fitcheck_plus_annual` ($49.99/year)
     - `fitcheck_pro_monthly` ($14.99/month)
     - `fitcheck_pro_annual` ($119.99/year)

2. **Google Play Console** (Android):
   - Same products with same IDs

### Configure in RevenueCat

1. Go to RevenueCat → Products
2. Add each product ID from App Store/Play Store
3. Create two **Entitlements**:
   - `plus`
   - `pro`
4. Map products to entitlements:
   - `fitcheck_plus_monthly` → `plus` entitlement
   - `fitcheck_plus_annual` → `plus` entitlement
   - `fitcheck_pro_monthly` → `pro` entitlement
   - `fitcheck_pro_annual` → `pro` entitlement
5. Create an **Offering** with both packages

### Configure Webhook

1. In RevenueCat dashboard → Integrations → Webhooks
2. Add webhook URL: `https://your-api-domain.com/api/webhooks/revenuecat`
3. Set Authorization header: `Bearer your_random_secret_from_env`

---

## Step 6: Testing Subscriptions

### Sandbox Testing (Recommended)

**iOS:**
1. Go to iPhone Settings → App Store → Sandbox Account
2. Create a test account in App Store Connect → Users and Access → Sandbox Testers
3. Sign in with the test account
4. Make test purchases in your dev build

**Android:**
1. Add your Google account to license testers in Play Console
2. Make test purchases

**Important:** Sandbox subscriptions renew on accelerated schedule:
- Monthly = 5 minutes
- Annual = 1 hour

### Webhook Testing

Use RevenueCat dashboard's "Send Test Webhook" feature to simulate events:
1. Go to RevenueCat → Integrations → Webhooks
2. Click "Send Test Event"
3. Check your backend logs to verify the webhook was received
4. Check your database `subscription_events` table

---

## Common Issues

### "react-native-purchases" not found

**Solution:** You're using Expo Go. You MUST use a development build.

### Can't see products in the app

**Solution:**
1. Make sure products are configured in App Store Connect / Play Console
2. Products must be in "Ready to Submit" state (iOS) or "Active" (Android)
3. Check RevenueCat dashboard to verify products are synced
4. Check console logs for RevenueCat errors

### Webhook not firing

**Solution:**
1. Verify webhook URL is publicly accessible (use ngrok for local testing)
2. Check Authorization header matches your `.env` secret
3. View webhook logs in RevenueCat dashboard

---

## Next Steps

1. Create development builds for iOS and Android
2. Set up RevenueCat account and configure products
3. Test subscription flow in sandbox mode
4. Deploy backend with webhook endpoint
5. Test end-to-end flow

---

## Quick Reference

| Task | Command |
|------|---------|
| Build iOS dev | `eas build --profile development --platform ios` |
| Build Android dev | `eas build --profile development --platform android` |
| Build both | `eas build --profile development --platform all` |
| Check build status | `eas build:list` |
| Run dev server | `npm start` (in fitcheck-app/) |

---

## Cost Note

- **EAS Builds**: Free tier includes 30 builds/month
- **RevenueCat**: Free up to $2.5K MRR
- **App Store/Play Store**: Annual developer fees ($99 iOS, $25 Android one-time)
