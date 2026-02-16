# Quick Start: Test Your Deployed Backend

**Backend:** https://fitcheck-production-0f92.up.railway.app/
**Status:** ✅ Deployed and Running

---

## 🚀 Immediate Next Steps (5 Minutes)

### Step 1: Fix Frontend Clerk Key

Your frontend is currently using a placeholder Clerk key. Fix this now:

1. Open `fitcheck-app/.env`
2. Find line 4-5:
   ```env
   # Line 4 (commented out - has real key):
   # EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_cG9zaXRpdmUtc29sZS03NC5jbGVyay5hY2NvdW50cy5kZXYk

   # Line 5 (active - placeholder):
   EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_placeholder
   ```

3. **Option A** - Uncomment the real key:
   ```env
   EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_cG9zaXRpdmUtc29sZS03NC5jbGVyay5hY2NvdW50cy5kZXYk
   ```

4. **Option B** - Get fresh key from Clerk dashboard:
   - Go to https://dashboard.clerk.com
   - Copy publishable key (starts with `pk_test_` or `pk_live_`)
   - Replace line 5 with the real key

### Step 2: Configure Clerk Webhook (2 Minutes)

Your backend needs to know when users sign up:

1. Go to https://dashboard.clerk.com
2. Click **Webhooks** → **Add Endpoint**
3. Enter URL: `https://fitcheck-production-0f92.up.railway.app/api/auth/clerk-webhook`
4. Subscribe to events:
   - ✅ `user.created`
   - ✅ `user.updated`
5. Copy the **Signing Secret** (starts with `whsec_`)
6. Go to Railway → Your service → **Variables**
7. Verify `CLERK_WEBHOOK_SECRET` matches the secret from step 5
8. Click **"Send Test Event"** in Clerk to verify (should see 200 response)

### Step 3: Test the App (3 Minutes)

1. Start frontend:
   ```bash
   cd fitcheck-app
   npm start
   ```

2. Scan QR code with Expo Go app

3. Sign up with a new test account

4. Complete onboarding

5. Go to Camera tab → Upload a photo

6. Select occasion/context → Submit

7. Wait for AI feedback (10-20 seconds)

**Expected Result:**
- You should see AI score (1-10) and feedback
- Railway logs should show: "Analyzing outfit [id]"
- Database should have new OutfitCheck record

---

## ⚠️ What Will Work vs. Won't Work

### ✅ Will Work Right Now (After Steps 1-3)
- Sign up / Sign in with Clerk
- Onboarding flow
- Camera capture and gallery upload
- AI outfit feedback (powered by Gemini)
- Follow-up questions
- Outfit history
- Favorites
- User profile and stats

### ⚠️ Won't Work Yet (Needs Configuration)
- **Subscriptions** - RevenueCat webhook not configured
  - Free tier limits will work (3 checks/day)
  - But upgrading to Plus/Pro won't work until webhook is set up
  - See `POST_DEPLOYMENT_SETUP.md` Step 3 for RevenueCat setup

- **Image Loading May Be Slow** - Using base64 in database
  - Works but not optimal for production
  - Consider setting up S3/R2 for better performance
  - See `POST_DEPLOYMENT_SETUP.md` Step 5

### ❌ Won't Work (Removed in Sprint 1)
- Live streaming (deferred to Phase 3)
- Trends endpoints (removed for security)
- Legacy JWT auth (removed - Clerk only)

---

## 🔍 Verify Everything Works

### Test 1: Health Check
```bash
curl https://fitcheck-production-0f92.up.railway.app/health
```
**Expected:** `{"status":"ok","timestamp":"..."}`

### Test 2: Authentication (After Signing Up)

In your app, after signing up, check Railway logs for:
```
Clerk webhook: user.created
User created: user_xxxxxxxxxxxxx
```

### Test 3: Outfit Check

After submitting a photo, check Railway logs for:
```
Analyzing outfit: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Gemini API call successful
AI analysis complete: score X
```

### Test 4: Database

Go to Railway → PostgreSQL → Data tab:

Check `User` table:
- Should have your test user
- `tier` should be `"free"`
- `email` should match your sign-up email

Check `OutfitCheck` table:
- Should have your uploaded outfit
- `aiScore` should be 1-10
- `aiWhatsWorking` should have JSON array
- `imageData` should contain very long base64 string (if S3 not configured)

---

## 🐛 Common Issues

### "Network request failed"
- Check `fitcheck-app/.env` has: `EXPO_PUBLIC_API_URL=https://fitcheck-production-0f92.up.railway.app`
- Restart Expo: Press `r` in terminal or shake device → reload

### "Invalid or expired token"
- Sign out and sign back in
- Verify Clerk publishable key is correct in `.env`
- Check Railway has `CLERK_SECRET_KEY` set

### Outfit analysis fails with 500 error
- Check Railway logs for error details
- Verify `GEMINI_API_KEY` is set in Railway variables
- Try a different photo (some formats may fail)

### Clerk webhook shows 401/403 error
- Verify `CLERK_WEBHOOK_SECRET` in Railway matches Clerk dashboard
- Check Railway logs for "Clerk webhook: ..." messages

---

## 📊 Monitor in Real-Time

### Watch Railway Logs
```bash
# Open Railway dashboard and click "View Logs"
# Or install Railway CLI and run:
railway logs
```

Look for:
- ✅ `🚀 Or This? API server running on port 3000`
- ✅ `Analyzing outfit...`
- ✅ `Gemini API call successful`
- ✅ `Clerk webhook: user.created`
- ⚠️ `S3 not configured - using base64 fallback`

### Check Database
Railway → PostgreSQL → Data:
- `User` table for new signups
- `OutfitCheck` table for submissions
- `FollowUp` table for questions
- `UserStats` table for points/streaks

---

## ✅ Success Criteria

You'll know everything is working when:

1. ✅ You can sign up with a new account
2. ✅ You receive Clerk verification email
3. ✅ Onboarding completes successfully
4. ✅ You can upload a photo
5. ✅ AI feedback appears within 20 seconds
6. ✅ Feedback has score 1-10 and 3 sections
7. ✅ You can ask a follow-up question
8. ✅ Outfit appears in History tab
9. ✅ You can favorite the outfit
10. ✅ After 3 checks, you see "daily limit reached"

---

## 🎯 After Testing Successfully

Once the above test passes, you're ready for **Sprint 3: Polish & App Store Prep**.

See `DEPLOYMENT_STATUS.md` for Sprint 3 tasks.

Key Sprint 3 tasks:
1. Hide incomplete features (Wardrobe, etc.)
2. Verify onboarding flow edge cases
3. Align RevenueCat product IDs
4. Prepare app store screenshots and metadata

**Estimated time for Sprint 3:** 1-2 days
