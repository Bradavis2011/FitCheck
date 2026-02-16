# Quick Railway Deploy - You're Already Set Up!

Since you already have a Railway database, this is much faster.

---

## What You Already Have ✅

- Railway account
- PostgreSQL database running at `nozomi.proxy.rlwy.net`
- GitHub repo: `Bradavis2011/FitCheck`
- All API keys and credentials

---

## What's Left to Do (20 minutes)

### Step 1: Check Your Railway Project (2 min)

1. Go to **https://railway.app** and sign in
2. You should see your existing project with PostgreSQL
3. Check if there's already a backend service deployed:
   - If YES → we'll update it
   - If NO → we'll add it (Steps 2-4)

**Take a screenshot of your Railway dashboard and let me know what you see.**

---

### Step 2: Deploy Backend Service (If Not Already Deployed)

#### 2.1 Add Service from GitHub

1. In your Railway project, click **"New"**
2. Select **"GitHub Repo"** → `Bradavis2011/FitCheck`
3. Railway will ask which service to deploy
4. Select **"Deploy from root"** or specify root directory: `fitcheck-api`

#### 2.2 Configure Root Directory

1. Click on the newly created service
2. Go to **"Settings"** tab
3. **Root Directory:** `fitcheck-api`
4. **Build Command:** `npm install && npx prisma generate && npx prisma migrate deploy`
5. **Start Command:** `npm start`
6. **Healthcheck Path:** `/health`

---

### Step 3: Copy Environment Variables to Railway (10 min)

Your backend service needs the same env vars you have locally.

#### Option A: Manual Copy (Recommended)

1. Railway → Your backend service → **"Variables"** tab
2. Click **"New Variable"** for each:

```bash
# Link existing database
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Clerk (from your local .env)
CLERK_SECRET_KEY=sk_test_NRHo5FZsbBnorRUPZuffehVeubEMjgfmvBz71FoCVu
CLERK_PUBLISHABLE_KEY=pk_test_cG9zaXRpdmUtc29sZS03NC5jbGVyay5hY2NvdW50cy5kZXYk
CLERK_WEBHOOK_SECRET=whsec_G7oevn/rRj879RdlPPwg6kVfB94ueozP

# Gemini AI
GEMINI_API_KEY=your_gemini_api_key_here

# RevenueCat
REVENUECAT_API_KEY=sk_zYeYCyAFalojEeUrVfwKzBAJSetEp
REVENUECAT_WEBHOOK_AUTH_TOKEN=VF5bPlW2Ll8pd2tcQ8f3

# App Config
NODE_ENV=production
PORT=3000
CORS_ORIGIN=*

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=60
```

**Do NOT copy:**
- `JWT_SECRET` - we removed JWT auth in Sprint 1
- `JWT_EXPIRES_IN` - not needed
- `USE_MOCK_AI` - production should use real AI

#### Option B: Bulk Import

1. Create a file called `railway-vars.txt` with:
```
DATABASE_URL=${{Postgres.DATABASE_URL}}
CLERK_SECRET_KEY=sk_test_NRHo5FZsbBnorRUPZuffehVeubEMjgfmvBz71FoCVu
CLERK_PUBLISHABLE_KEY=pk_test_cG9zaXRpdmUtc29sZS03NC5jbGVyay5hY2NvdW50cy5kZXYk
CLERK_WEBHOOK_SECRET=whsec_G7oevn/rRj879RdlPPwg6kVfB94ueozP
GEMINI_API_KEY=your_gemini_api_key_here
REVENUECAT_API_KEY=sk_zYeYCyAFalojEeUrVfwKzBAJSetEp
REVENUECAT_WEBHOOK_AUTH_TOKEN=VF5bPlW2Ll8pd2tcQ8f3
NODE_ENV=production
PORT=3000
CORS_ORIGIN=*
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=60
```

2. Railway → Variables tab → **"Raw Editor"** → Paste entire file

---

### Step 4: Deploy & Monitor (5 min)

1. Railway will auto-deploy when you add variables
2. Go to **"Deployments"** tab → Watch the logs
3. Wait for:
   ```
   ✓ npm install completed
   ✓ npx prisma generate completed
   ✓ npx prisma migrate deploy completed
   ✓ Build succeeded
   🚀 Or This? API server running on port 3000
   ⚠️  S3 not configured - using base64 fallback
   ```

4. Copy your Railway URL from **"Settings"** → **"Domains"**
   - Example: `https://fitcheck-api-production-xxxx.up.railway.app`

---

### Step 5: Test Deployment (2 min)

**Test health check:**
```bash
curl https://your-app.up.railway.app/health
```

Should return:
```json
{"status":"ok","timestamp":"2026-02-15T..."}
```

**Or open in browser:**
```
https://your-app.up.railway.app/health
```

✅ **If you see this, your backend is live!**

---

### Step 6: Update Clerk Webhook URL (3 min)

Since your backend URL might have changed:

1. Go to **https://dashboard.clerk.com**
2. Your app → **"Webhooks"**
3. Find existing webhook OR click **"Add Endpoint"**
4. **Update URL to:**
   ```
   https://your-app.up.railway.app/api/auth/clerk-webhook
   ```
5. **Subscribe to:** `user.created`, `user.updated`
6. **Copy the Signing Secret** (starts with `whsec_...`)
7. If it's different from your local one, update Railway:
   - Railway → Variables → Update `CLERK_WEBHOOK_SECRET`

**Test webhook:**
- Clerk dashboard → Your webhook → **"Testing"** tab
- Send test event for `user.created`
- Check Railway logs for: `✓ Created user ...`

---

### Step 7: Update RevenueCat Webhook URL (2 min)

1. Go to **https://app.revenuecat.com**
2. Your project → **"Integrations"** → **"Webhooks"**
3. Find existing webhook OR add new one
4. **Update URL to:**
   ```
   https://your-app.up.railway.app/api/webhooks/revenuecat
   ```
5. **Authorization:** Use value from `REVENUECAT_WEBHOOK_AUTH_TOKEN`

---

### Step 8: Update Frontend (2 min)

In `fitcheck-app/.env`:
```bash
EXPO_PUBLIC_API_URL=https://your-app.up.railway.app
```

Then restart your Expo dev server:
```bash
cd fitcheck-app
npm start
```

---

## ✅ Deployment Complete!

### Test End-to-End

1. **Sign up** from mobile app (creates user via Clerk webhook)
2. **Upload outfit photo** (stores in DB as base64 for now)
3. **Get AI feedback** (Gemini API)
4. **Check history** (PostgreSQL query)

### What About S3/R2?

You're currently using **base64 fallback** for images. This works but:
- ❌ Increases database size
- ❌ Slower performance
- ❌ Won't scale past ~1000 users

**Add S3/R2 later** (15 min setup):
1. Create Cloudflare R2 bucket (cheaper) or AWS S3
2. Get access keys
3. Add to Railway variables:
   ```
   AWS_REGION=auto
   AWS_ACCESS_KEY_ID=...
   AWS_SECRET_ACCESS_KEY=...
   AWS_S3_BUCKET=orthis-images
   ```
4. Railway redeploys → logs show "☁️ S3 configured"

---

## Troubleshooting

### "Build failed - Prisma error"
**Fix:** Railway → PostgreSQL service → Verify it's running (green status)

### "Module not found" errors
**Fix:** Railway → Settings → Verify root directory is `fitcheck-api`

### "CORS error" in app
**Fix:** Railway → Variables → Update `CORS_ORIGIN` to include your app domain

### "Clerk webhook fails"
**Fix:**
1. Verify webhook URL ends with `/api/auth/clerk-webhook`
2. Check `CLERK_WEBHOOK_SECRET` matches Clerk dashboard
3. Redeploy after changing env vars

---

## Cost Check

You're currently paying:
- **Railway Hobby:** $20/month (includes PostgreSQL + backend)
- **Cloudflare R2:** $0/month (not set up yet)
- **Total:** $20/month

Free tiers you're using:
- Clerk: 10,000 MAU
- RevenueCat: Unlimited revenue
- Gemini: Free tier

---

## Next Steps

Once deployed and tested:

1. **Test everything works:**
   - Sign up → upload photo → get feedback → check history

2. **Add S3/R2 storage** (optional but recommended)

3. **Continue to Sprint 3:**
   - Hide incomplete features
   - Verify onboarding flow
   - Test subscriptions
   - Prepare app store assets

---

## Quick Command Reference

**Check Railway logs:**
```bash
railway logs
```

**Link local project to Railway:**
```bash
cd fitcheck-api
railway link
```

**View Railway variables:**
```bash
railway variables
```

**Redeploy:**
```bash
git push origin main
# Railway auto-deploys on push
```
