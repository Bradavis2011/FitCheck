# Post-Deployment Configuration Guide

**Backend URL:** `https://fitcheck-production-0f92.up.railway.app/`

This guide covers the essential configuration steps to connect your deployed backend with Clerk authentication and RevenueCat subscriptions.

---

## ✅ Step 1: Frontend Configuration (COMPLETE)

The frontend `.env` has been updated to point to production:

```env
EXPO_PUBLIC_API_URL=https://fitcheck-production-0f92.up.railway.app
```

**Important:** Make sure your Clerk publishable key is set correctly:
- Line 4 in `fitcheck-app/.env` has the actual Clerk key commented out
- Line 5 has a placeholder
- **Action needed:** Uncomment line 4 and remove line 5, OR update line 5 with your actual key

---

## 🔐 Step 2: Configure Clerk Webhook

Clerk needs to notify your backend when users sign up, update profiles, or delete accounts.

### 2.1 Access Clerk Dashboard

1. Go to: https://dashboard.clerk.com
2. Select your "Or This?" application
3. Navigate to **Webhooks** in the left sidebar

### 2.2 Create Webhook Endpoint

Click **"Add Endpoint"** and configure:

| Field | Value |
|-------|-------|
| **Endpoint URL** | `https://fitcheck-production-0f92.up.railway.app/api/auth/clerk-webhook` |
| **Description** | Production user sync webhook |

### 2.3 Subscribe to Events

Select these events (these are what your backend handles):

- ✅ `user.created` - Creates user in your database when they sign up
- ✅ `user.updated` - Updates user profile data when changed
- ✅ `user.deleted` - Marks user as deleted (optional, for GDPR compliance)

### 2.4 Get Signing Secret

After creating the webhook:

1. Click on the newly created webhook
2. Copy the **Signing Secret** (starts with `whsec_...`)
3. Go to Railway → Your Service → **Variables** tab
4. Find `CLERK_WEBHOOK_SECRET` and verify it matches
5. If not set, add it:
   - Variable name: `CLERK_WEBHOOK_SECRET`
   - Value: `whsec_...` (paste the secret you copied)

### 2.5 Test the Webhook

1. In Clerk dashboard webhook settings, click **"Send Test Event"**
2. Select `user.created` event
3. Click **Send**
4. Check Railway logs (should see: "Clerk webhook: user.created")
5. If successful, you'll see a 200 response

**Troubleshooting:**
- 401 error → Check `CLERK_WEBHOOK_SECRET` matches in Railway
- 404 error → Verify endpoint URL is correct (should include `/api/auth/clerk-webhook`)
- 500 error → Check Railway logs for database connection issues

---

## 💳 Step 3: Configure RevenueCat Webhook

RevenueCat needs to notify your backend about subscription events (purchases, renewals, cancellations).

### 3.1 Access RevenueCat Dashboard

1. Go to: https://app.revenuecat.com
2. Select your "Or This?" project

### 3.2 Configure Webhook

1. Navigate to **Settings** → **Integrations**
2. Scroll to **Webhooks** section
3. Click **"+ Add"**

Configure the webhook:

| Field | Value |
|-------|-------|
| **Webhook URL** | `https://fitcheck-production-0f92.up.railway.app/api/webhooks/revenuecat` |
| **Authorization Header** | Leave blank (endpoint validates via RevenueCat signature) |

### 3.3 Subscribe to Events

Select these events:

- ✅ `INITIAL_PURCHASE` - First subscription purchase
- ✅ `RENEWAL` - Subscription renewed
- ✅ `CANCELLATION` - Subscription cancelled
- ✅ `EXPIRATION` - Subscription expired
- ✅ `PRODUCT_CHANGE` - User upgraded/downgraded tier

### 3.4 Get Webhook Secret (Optional but Recommended)

RevenueCat doesn't use signing secrets by default, but you can add authorization:

1. In Railway, add a new variable:
   - Name: `REVENUECAT_WEBHOOK_SECRET`
   - Value: Generate a random string (use a password generator)
2. In RevenueCat webhook config, set **Authorization Header**:
   - Value: `Bearer YOUR_RANDOM_STRING`
3. Update `fitcheck-api/src/routes/webhook.routes.ts` to verify this header (optional security enhancement)

### 3.5 Test the Webhook

1. In RevenueCat, make a test purchase in sandbox mode
2. Check Railway logs for: "RevenueCat webhook: INITIAL_PURCHASE"
3. Verify user tier was updated in database

**Troubleshooting:**
- No webhook received → Check URL is correct, verify RevenueCat project matches app
- 500 error → Check Railway logs for database issues
- User tier not updating → Verify product IDs match between RevenueCat and `fitcheck-api/src/constants/tiers.ts`

---

## 🧪 Step 4: End-to-End Testing

Now test the complete flow:

### 4.1 Test Authentication Flow

1. **Start the frontend:**
   ```bash
   cd fitcheck-app
   npm start
   ```

2. **Sign up with a new account:**
   - Email: `test@example.com` (or your personal email)
   - Verify email via link sent by Clerk
   - Complete onboarding

3. **Verify in Railway logs:**
   ```
   Clerk webhook: user.created
   User created: [user-id]
   ```

4. **Verify in database:**
   - Go to Railway → PostgreSQL → Data tab
   - Check `User` table for new record
   - Verify `tier` is set to `"free"` by default

### 4.2 Test Outfit Check Flow

1. **In the app, go to Camera tab**
2. **Upload a photo** (or take one)
3. **Select context:**
   - Occasion: "Casual Hangout"
   - Weather: "Mild (60-75°F)"
   - Vibe: "Relaxed"
4. **Submit**

5. **Verify in Railway logs:**
   ```
   Analyzing outfit [outfit-id]
   Gemini API call successful
   AI analysis complete: score [1-10]
   ```

6. **Check feedback screen:**
   - Should see AI score (1-10)
   - "What's Working" section
   - "Consider" section
   - "Quick Fixes" section

7. **Test follow-up question:**
   - Tap "Ask a question"
   - Type: "What shoes would go well with this?"
   - Verify AI response

### 4.3 Test Free Tier Limits

1. **Submit 3 outfit checks** (free tier limit)
2. **On the 4th attempt**, should see:
   - Error: "Daily limit reached. Upgrade to Plus for unlimited checks!"
   - Upgrade prompt appears

### 4.4 Test Subscription Flow (Optional - requires real payment setup)

1. **Tap "Upgrade" button**
2. **Select "Plus" tier** ($5.99/month)
3. **Complete purchase** (sandbox mode if testing)
4. **Verify in Railway logs:**
   ```
   RevenueCat webhook: INITIAL_PURCHASE
   User tier updated: free → plus
   ```

5. **Test unlimited checks:**
   - Submit more than 3 outfit checks
   - Should work without limit

---

## 🔍 Step 5: Verify S3 Fallback (Current State)

Your backend is currently using **base64 fallback** for image storage because S3 is not configured. This works for testing but is **NOT recommended for production**.

**Current behavior:**
- Images are stored as base64 strings in PostgreSQL
- Increases database size significantly
- Slower image loading in app

**Production recommendation:**
- Set up Cloudflare R2 or AWS S3 (covered in Sprint 2 documentation)
- Add environment variables to Railway:
  ```
  AWS_REGION=us-east-1
  AWS_ACCESS_KEY_ID=your_key
  AWS_SECRET_ACCESS_KEY=your_secret
  AWS_S3_BUCKET=orthis-images
  ```

**To verify current state:**
- Check Railway logs: Should see "⚠️ S3 not configured - using base64 fallback"
- After first outfit upload, check PostgreSQL `OutfitCheck` table
- `imageData` column will contain base64 string (very long text)

---

## 📊 Step 6: Monitor Production

### Railway Logs

Watch for:
- ✅ `🚀 Or This? API server running on port 3000`
- ✅ `Clerk webhook: user.created`
- ✅ `Analyzing outfit [id]`
- ✅ `Gemini API call successful`
- ⚠️ Any 500 errors or stack traces

### Database Monitoring

Check these tables in Railway PostgreSQL:

| Table | What to Monitor |
|-------|----------------|
| `User` | New signups, tier distribution |
| `OutfitCheck` | Total checks, average scores |
| `FollowUp` | Follow-up question usage |
| `UserStats` | Streak tracking, points, levels |

### Key Metrics to Track

- **Daily Active Users (DAU):** Count of users who submitted outfit checks today
- **Free → Paid Conversion:** Users who upgraded from free to Plus/Pro
- **Average Score:** Mean AI score across all outfit checks
- **Follow-up Rate:** % of outfit checks that receive follow-up questions

---

## 🚨 Common Issues & Solutions

### Issue: "Network request failed" in app

**Cause:** Frontend can't reach backend

**Solutions:**
1. Check `fitcheck-app/.env` has correct `EXPO_PUBLIC_API_URL`
2. Test backend health: `curl https://fitcheck-production-0f92.up.railway.app/health`
3. Check Railway service is running (not crashed)
4. Verify no CORS errors in Railway logs

### Issue: "Invalid or expired token" when making requests

**Cause:** Clerk authentication issue

**Solutions:**
1. Verify `CLERK_PUBLISHABLE_KEY` in frontend `.env` is correct
2. Check `CLERK_SECRET_KEY` in Railway matches your Clerk dashboard
3. Sign out and sign back in to get fresh token
4. Check Railway logs for specific Clerk error messages

### Issue: Outfit check fails with 500 error

**Cause:** Database connection or Gemini API issue

**Solutions:**
1. Check Railway logs for error details
2. Verify `DATABASE_URL` is set correctly in Railway
3. Verify `GEMINI_API_KEY` is set and valid (test at https://aistudio.google.com)
4. Check PostgreSQL service is running in Railway

### Issue: User tier not updating after purchase

**Cause:** RevenueCat webhook not configured or product IDs mismatch

**Solutions:**
1. Verify RevenueCat webhook is configured (Step 3)
2. Check product IDs in `fitcheck-app/app/upgrade.tsx` match RevenueCat dashboard:
   - `fitcheck_plus_monthly`
   - `fitcheck_plus_annual`
   - `fitcheck_pro_monthly`
   - `fitcheck_pro_annual`
3. Check Railway logs for "RevenueCat webhook" messages
4. Manually update user tier in database for testing:
   ```sql
   UPDATE "User" SET tier = 'plus' WHERE email = 'test@example.com';
   ```

---

## ✅ Post-Configuration Checklist

Before moving to Sprint 3:

- [ ] Frontend `.env` points to production backend URL
- [ ] Clerk publishable key is set correctly in frontend
- [ ] Clerk webhook is configured and tested
- [ ] RevenueCat webhook is configured (if using subscriptions)
- [ ] End-to-end flow tested: sign up → upload photo → get feedback
- [ ] Free tier limits tested (3 checks/day)
- [ ] Backend health check accessible: https://fitcheck-production-0f92.up.railway.app/health
- [ ] Railway logs show no critical errors
- [ ] Database contains test user and outfit check data

---

## 🎯 Next: Sprint 3 - Polish & App Store Prep

Once this configuration is complete and tested, you're ready for:

1. **Hide/gate non-MVP screens** (Wardrobe, unfinished features)
2. **Verify onboarding flow** works with Clerk auth
3. **Align RevenueCat product IDs** with App Store Connect
4. **Prepare app store assets** (screenshots, descriptions, privacy policy)

See `SPRINT_3_PLAN.md` (to be created) for details.
