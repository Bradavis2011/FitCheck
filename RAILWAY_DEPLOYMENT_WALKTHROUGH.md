# Railway Deployment - Step-by-Step Walkthrough

Follow these steps to deploy the Or This? backend to Railway in ~45 minutes.

---

## ✅ Pre-Flight Checklist

Before starting, have these ready:
- [ ] GitHub account (for Railway integration)
- [ ] Clerk account with publishable & secret keys
- [ ] RevenueCat API key & webhook auth token
- [ ] Google Gemini API key (free from aistudio.google.com)
- [ ] AWS S3 or Cloudflare R2 credentials (optional but recommended)

---

## Step 1: Create Railway Account & Project (5 minutes)

### 1.1 Sign Up for Railway

1. Go to **https://railway.app**
2. Click **"Login with GitHub"**
3. Authorize Railway to access your GitHub repositories
4. You'll land on the Railway dashboard

### 1.2 Create New Project

1. Click **"New Project"** button (top right)
2. Select **"Deploy from GitHub repo"**
3. Railway will show your GitHub repositories
4. Search for **"FitCheck"** (or `Bradavis2011/FitCheck`)
5. Click on your repository to select it
6. Railway will analyze your repo and detect it contains both frontend and backend

### 1.3 Configure Service

1. Railway detects multiple services - select **"fitcheck-api"** (backend)
2. Click **"Add variables"** (we'll set these up next)
3. Railway will show a deployment starting - this will fail initially (that's expected - we need to configure environment variables first)

**✅ Checkpoint:** You should see a Railway project with a failed deployment. That's normal!

---

## Step 2: Add PostgreSQL Database (3 minutes)

### 2.1 Add Database to Project

1. In your Railway project dashboard, click **"New"** button
2. Select **"Database"** → **"PostgreSQL"**
3. Railway provisions a PostgreSQL instance automatically
4. Wait ~30 seconds for the database to be ready (green status)

### 2.2 Link Database to Backend Service

1. Click on your **backend service** (fitcheck-api)
2. Go to **"Variables"** tab
3. Click **"New Variable"** → **"Add Reference"**
4. Select the PostgreSQL service
5. Choose **"DATABASE_URL"**
6. Railway automatically creates: `DATABASE_URL=${{Postgres.DATABASE_URL}}`

**✅ Checkpoint:** Variables tab should show `DATABASE_URL` with value `${{Postgres.DATABASE_URL}}`

---

## Step 3: Configure Environment Variables (10 minutes)

In your backend service → **"Variables"** tab, add each of these:

### 3.1 Required Variables

Click **"New Variable"** for each:

**Clerk Authentication:**
```
CLERK_SECRET_KEY=sk_test_NRHo5FZsbBnorRUPZuffehVeubEMjgfmvBz71FoCVu
CLERK_PUBLISHABLE_KEY=pk_test_cG9zaXRpdmUtc29sZS03NC5jbGVyay5hY2NvdW50cy5kZXYk
CLERK_WEBHOOK_SECRET=whsec_G7oevn/rRj879RdlPPwg6kVfB94ueozP
```

**AI Service:**
```
GEMINI_API_KEY=your_gemini_api_key_here
```

**RevenueCat:**
```
REVENUECAT_API_KEY=sk_zYeYCyAFalojEeUrVfwKzBAJSetEp
REVENUECAT_WEBHOOK_AUTH_TOKEN=VF5bPlW2Ll8pd2tcQ8f3
```

**App Configuration:**
```
NODE_ENV=production
PORT=3000
CORS_ORIGIN=*
```

*(Note: We'll update CORS_ORIGIN later when you know your production app URL)*

**Rate Limiting (optional but recommended):**
```
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=60
```

### 3.2 Cloud Storage (Critical - Prevents Base64 Fallback)

You have two options:

**Option A: AWS S3** (Skip to Option B for cheaper alternative)
```
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<your AWS access key>
AWS_SECRET_ACCESS_KEY=<your AWS secret>
AWS_S3_BUCKET=orthis-production-images
```

**Option B: Cloudflare R2** (Recommended - cheaper, free egress)
```
AWS_REGION=auto
AWS_ACCESS_KEY_ID=<your R2 access key>
AWS_SECRET_ACCESS_KEY=<your R2 secret>
AWS_S3_BUCKET=orthis-images
```

**For now, you can skip cloud storage** - the app will use base64 fallback. You can add it later.

**✅ Checkpoint:** You should have ~10 environment variables set

---

## Step 4: Configure Build Settings (3 minutes)

### 4.1 Set Root Directory

1. Backend service → **"Settings"** tab
2. Scroll to **"Service Settings"**
3. **Root Directory:** `fitcheck-api`
4. Click **"Update"**

### 4.2 Verify Build & Start Commands

Railway should auto-detect these, but verify:

1. **Build Command:**
   ```
   npm install && npx prisma generate && npx prisma migrate deploy
   ```

2. **Start Command:**
   ```
   npm start
   ```

3. **Healthcheck Path:** `/health`

If they're not set, click **"Configure"** and add them.

**✅ Checkpoint:** Settings should show correct root directory and commands

---

## Step 5: Deploy! (5 minutes)

### 5.1 Trigger Deployment

1. Go to **"Deployments"** tab
2. Click **"Deploy"** or trigger by pushing to GitHub
3. Watch the build logs in real-time

### 5.2 Monitor Build Logs

Watch for these successful steps:
```
✓ npm install completed
✓ npx prisma generate completed
✓ npx prisma migrate deploy completed
✓ Build succeeded
```

Then watch startup logs:
```
🚀 Or This? API server running on port 3000
📍 Environment: production
🔗 Health check: http://localhost:3000/health
⚠️  S3 not configured - using base64 fallback
```

*(The S3 warning is expected if you haven't set up cloud storage yet)*

### 5.3 Get Your Backend URL

1. Go to **"Settings"** tab
2. Scroll to **"Domains"**
3. Railway auto-generates a URL like: `https://fitcheck-api-production-xxxx.up.railway.app`
4. **Copy this URL** - you'll need it for webhooks

**✅ Checkpoint:** Deployment should show "Success" with green checkmark

---

## Step 6: Test Deployment (3 minutes)

### 6.1 Test Health Check

Open in browser or use curl:
```
https://your-app.up.railway.app/health
```

Should return:
```json
{"status":"ok","timestamp":"2026-02-15T..."}
```

### 6.2 Check Database Migration

In Railway logs, verify you see:
```
✓ Prisma migrations applied successfully
```

**✅ Checkpoint:** Health check returns 200 OK

---

## Step 7: Configure Clerk Webhook (5 minutes)

### 7.1 Add Webhook in Clerk Dashboard

1. Go to **https://dashboard.clerk.com**
2. Select your application
3. Left sidebar → **"Webhooks"**
4. Click **"Add Endpoint"**

### 7.2 Configure Endpoint

**Endpoint URL:**
```
https://your-app.up.railway.app/api/auth/clerk-webhook
```

**Events to subscribe to:**
- ✅ `user.created`
- ✅ `user.updated`

Click **"Create"**

### 7.3 Update Webhook Secret

1. Clerk shows a **Signing Secret** (starts with `whsec_...`)
2. Copy it
3. Go back to Railway → Backend service → **"Variables"**
4. Update `CLERK_WEBHOOK_SECRET` with the new value
5. Railway will auto-redeploy

### 7.4 Test Webhook

1. In Clerk dashboard → Your webhook → **"Testing"** tab
2. Click **"Send test event"** for `user.created`
3. Check Railway logs - you should see:
   ```
   ✓ Created user <user-id> (test@example.com)
   ```

**✅ Checkpoint:** Clerk webhook test succeeds

---

## Step 8: Configure RevenueCat Webhook (3 minutes)

### 8.1 Add Webhook in RevenueCat

1. Go to **https://app.revenuecat.com**
2. Your project → **"Integrations"** → **"Webhooks"**
3. Click **"+ Add Webhook"**

### 8.2 Configure Webhook

**URL:**
```
https://your-app.up.railway.app/api/webhooks/revenuecat
```

**Authorization Header:**
Use the value from your `REVENUECAT_WEBHOOK_AUTH_TOKEN` env variable

**Events:** Select all

Click **"Save"**

**✅ Checkpoint:** RevenueCat webhook configured

---

## Step 9: Set Up Cloud Storage (Optional - 10 minutes)

### Option A: AWS S3

#### 9.1 Create S3 Bucket

1. AWS Console → **S3** → **"Create bucket"**
2. **Bucket name:** `orthis-production-images`
3. **Region:** `us-east-1` (or your preference)
4. **Block Public Access:** Turn OFF (images need public URLs)
5. Click **"Create bucket"**

#### 9.2 Create IAM User

1. AWS Console → **IAM** → **"Users"** → **"Create user"**
2. **User name:** `orthis-s3-uploader`
3. **Permissions:** Attach `AmazonS3FullAccess` policy
4. Click **"Create user"**

#### 9.3 Create Access Key

1. Click on the user → **"Security credentials"** tab
2. **"Create access key"** → **"Application running outside AWS"**
3. Copy **Access Key ID** and **Secret Access Key**

#### 9.4 Update Railway Variables

Add to Railway:
```
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=orthis-production-images
```

Railway will auto-redeploy. Check logs for:
```
☁️  S3 configured - images will be stored in: orthis-production-images
```

### Option B: Cloudflare R2 (Cheaper)

#### 9.1 Create R2 Bucket

1. Cloudflare Dashboard → **R2** → **"Create bucket"**
2. **Bucket name:** `orthis-images`
3. Click **"Create bucket"**

#### 9.2 Create API Token

1. R2 → **"Manage R2 API Tokens"** → **"Create API token"**
2. **Token name:** `OrThis Production`
3. **Permissions:** Object Read & Write
4. **TTL:** Never expire
5. Click **"Create API token"**
6. Copy **Access Key ID** and **Secret Access Key**

#### 9.3 Update Railway Variables

```
AWS_REGION=auto
AWS_ACCESS_KEY_ID=<R2 access key>
AWS_SECRET_ACCESS_KEY=<R2 secret key>
AWS_S3_BUCKET=orthis-images
```

**✅ Checkpoint:** Logs show "☁️ S3 configured" (no warning)

---

## Step 10: Update Frontend to Use Production Backend (5 minutes)

### 10.1 Update Frontend .env

In `fitcheck-app/.env`:
```
EXPO_PUBLIC_API_URL=https://your-app.up.railway.app
```

### 10.2 Update Backend CORS

In Railway → Backend variables → Update `CORS_ORIGIN`:
```
CORS_ORIGIN=http://localhost:8081,https://your-production-app.com
```

*(Include both dev and production URLs, comma-separated)*

Railway will auto-redeploy.

**✅ Checkpoint:** Frontend can connect to production backend

---

## 🎉 Deployment Complete!

### Verification Checklist

- [ ] Health check returns 200 OK
- [ ] Database migrations applied successfully
- [ ] Clerk webhook test succeeds (check Railway logs)
- [ ] RevenueCat webhook configured
- [ ] S3/R2 configured OR base64 fallback acknowledged
- [ ] Frontend connects to production backend

### What's Next?

1. **Test End-to-End:**
   - Sign up with Clerk from mobile app
   - Upload outfit photo
   - Receive AI feedback
   - Check history

2. **Monitor:**
   - Railway dashboard → View metrics (CPU, memory, requests)
   - Check logs for errors

3. **Optimize (Later):**
   - Add custom domain
   - Enable Railway's CDN
   - Set up monitoring alerts

---

## Troubleshooting

### "Prisma migration failed"
**Symptom:** Build fails during `prisma migrate deploy`
**Fix:**
1. Railway → PostgreSQL service → **"Data"** tab → Verify database is running
2. Check `DATABASE_URL` variable is set correctly
3. Manually run migration: Railway → Backend → **"Console"** → `npx prisma migrate deploy`

### "Clerk webhook 401 Unauthorized"
**Symptom:** Webhook fails in Clerk dashboard
**Fix:**
1. Verify `CLERK_WEBHOOK_SECRET` matches Clerk dashboard
2. Check webhook URL is exact: `/api/auth/clerk-webhook` (not `/auth/clerk-webhook`)
3. Redeploy after changing env vars

### "S3 upload failed"
**Symptom:** Logs show "S3 upload failed" when uploading outfit photo
**Fix:**
1. Verify all 4 AWS variables are set: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`
2. Test AWS credentials with AWS CLI: `aws s3 ls s3://your-bucket-name`
3. Ensure bucket has public read access (for S3) or R2 is configured correctly

### "CORS error" in frontend
**Symptom:** Frontend shows network error when calling API
**Fix:**
1. Update `CORS_ORIGIN` in Railway to include your app's domain
2. Ensure no trailing slash in URL
3. Check browser console for exact CORS error message

### High memory usage
**Symptom:** Railway shows high memory (>500MB)
**Fix:**
1. This is normal for Node.js + Prisma + image processing
2. Railway Hobby plan includes 8GB RAM - you're fine
3. If you exceed, upgrade to Pro plan or optimize image processing

---

## Cost Summary

**Current Setup:**
- Railway Hobby: $20/month (includes PostgreSQL)
- Cloudflare R2: ~$1.50/month (100GB storage)
- **Total: $21.50/month**

**Free Tiers:**
- Clerk: 10,000 MAU free
- RevenueCat: Unlimited revenue free
- Google Gemini: Free tier (rate limited)

---

## Next Steps

Once deployed and tested:
- ✅ Continue to **Sprint 3: Polish & App Store Prep**
- ✅ Hide incomplete features
- ✅ Verify onboarding flow
- ✅ Test subscription flow
- ✅ Prepare for app store submission
