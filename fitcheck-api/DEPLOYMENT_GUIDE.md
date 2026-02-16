# Production Deployment Guide - Railway

## Prerequisites

- [ ] GitHub account connected to Railway
- [ ] Clerk production application created (https://dashboard.clerk.com)
- [ ] Google Gemini API key (https://ai.google.dev)
- [ ] AWS account with S3 bucket created
- [ ] Railway account (https://railway.app)

---

## Step 1: Create Railway Project

1. Go to https://railway.app and sign in
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Authorize Railway to access your GitHub account
5. Select repository: **`Bradavis2011/FitCheck`**
6. Railway will detect the `fitcheck-api` directory automatically

---

## Step 2: Add PostgreSQL Database

1. In your Railway project, click **"+ New"**
2. Select **"Database"** → **"PostgreSQL"**
3. Railway will provision a PostgreSQL database
4. The `DATABASE_URL` environment variable will be automatically set

**Wait for database to be fully provisioned before proceeding** (green checkmark)

---

## Step 3: Configure Environment Variables

Go to your Railway service → **"Variables"** tab and add the following:

### Required Environment Variables

```bash
# Clerk Authentication (Production Keys)
CLERK_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxx
CLERK_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxx

# Google Gemini AI
GEMINI_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXX

# AWS S3 (CRITICAL - Required for image storage)
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_S3_BUCKET=fitcheck-images-prod
AWS_REGION=us-east-1

# App Configuration
NODE_ENV=production
PORT=3000

# CORS (Update after first deployment)
CORS_ORIGIN=exp://your-expo-app-url

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### How to Get Each Variable:

#### Clerk Keys:
1. Go to https://dashboard.clerk.com
2. Select your **production** application (or create one)
3. Navigate to **API Keys** in the left sidebar
4. Copy `CLERK_SECRET_KEY` (starts with `sk_live_`)
5. Go to **Webhooks** → Create endpoint for user events → Copy `CLERK_WEBHOOK_SECRET`

#### Gemini API Key:
1. Go to https://ai.google.dev/gemini-api/docs/api-key
2. Click **"Get API Key"**
3. Create new key or use existing key

#### AWS S3:
1. Log in to AWS Console → IAM
2. Create new IAM user: **"fitcheck-prod-s3-user"**
3. Attach policy: **AmazonS3FullAccess** (or create custom policy for specific bucket)
4. Create access key → Copy `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
5. Go to S3 → Create bucket: **"fitcheck-images-prod"** (region: us-east-1)
6. Configure bucket CORS:
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"]
  }
]
```

---

## Step 4: Deploy Backend

### Automatic Deployment

Railway will automatically deploy when you push to GitHub. The deployment process:

1. **Build Phase** (defined in `railway.json`):
   ```bash
   npm install
   npx prisma generate
   npm run build
   ```

2. **Deploy Phase**:
   ```bash
   npx prisma migrate deploy  # Apply database migrations
   npm start                   # Start server
   ```

### Monitor Deployment

1. Go to Railway project → **"Deployments"** tab
2. Watch build logs in real-time
3. Wait for deployment to show **"Success"** (green)
4. Click on deployment → **"View Logs"** to see runtime logs

### Verify Deployment

1. Railway will assign a public URL: `https://fitcheck-api-production-xxxx.up.railway.app`
2. Test health endpoint:
   ```bash
   curl https://your-railway-url.up.railway.app/health
   ```
   Should return: `{"status":"ok","timestamp":"2026-02-16T..."}`

3. Verify database migrations applied:
   - Check logs for: `"Running prisma migrate deploy"`
   - Should see: `"2 migrations applied"` or similar

---

## Step 5: Update Frontend Configuration

### Update API Base URL

1. Open `fitcheck-app/.env.production`
2. Update with your Railway URL:
   ```bash
   EXPO_PUBLIC_API_URL=https://your-railway-url.up.railway.app
   EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxx
   ```

3. Go back to Railway → **Variables** → Update `CORS_ORIGIN`:
   ```bash
   CORS_ORIGIN=exp://your-expo-app-url,https://your-frontend-domain.com
   ```
   (Or use `*` for development, restrict in production)

---

## Step 6: Test Production API

### Test Authentication Flow

```bash
# 1. Test health check
curl https://your-railway-url.up.railway.app/health

# 2. Test protected endpoint (should return 401)
curl https://your-railway-url.up.railway.app/api/user/stats

# 3. Test with valid Clerk token (get from app)
curl -H "Authorization: Bearer YOUR_CLERK_JWT" \
     https://your-railway-url.up.railway.app/api/user/stats
```

### Test from Mobile App

1. Update `fitcheck-app/.env.production`
2. Restart Expo dev server: `npm start`
3. Try logging in with Clerk
4. Try submitting feedback on an outfit
5. Check Railway logs for incoming requests

---

## Step 7: Database Verification

### Check Migrations Applied

```bash
# SSH into Railway container (if needed)
railway run bash

# Inside container:
npx prisma migrate status
# Should show all migrations applied ✅
```

### Verify Gamification Tables

Railway PostgreSQL should have:
- `user_stats` table with 12 gamification fields
- Indexes on `weekly_points`, `monthly_points`, `points`

---

## Monitoring & Debugging

### View Logs
```bash
railway logs
# Or in dashboard: Deployments → Click deployment → View Logs
```

### Common Issues

#### Issue: "Port already in use"
- **Fix**: Railway automatically assigns PORT, ensure `process.env.PORT` is used in server.js

#### Issue: "DATABASE_URL not found"
- **Fix**: Ensure PostgreSQL plugin is added and linked to service

#### Issue: "Prisma Client not generated"
- **Fix**: Check build logs for `npx prisma generate` step

#### Issue: CORS errors from frontend
- **Fix**: Update `CORS_ORIGIN` in Railway variables

#### Issue: Clerk authentication fails
- **Fix**: Verify using production keys (`sk_live_`, not `sk_test_`)

---

## Rollback Procedure

If deployment fails:

1. Railway Dashboard → **Deployments** tab
2. Find last successful deployment
3. Click **"..."** menu → **"Redeploy"**

---

## Production Checklist

Before going live:

- [ ] All environment variables set in Railway
- [ ] PostgreSQL database connected and migrations applied
- [ ] Backend deployed successfully (green status)
- [ ] Health endpoint returns 200 OK
- [ ] AWS S3 bucket created and accessible
- [ ] Clerk production app configured
- [ ] Frontend updated with production API URL
- [ ] Test authentication flow end-to-end
- [ ] Test outfit submission with image upload
- [ ] Test gamification (give feedback, earn points)
- [ ] Verify rate limiting works (try exceeding daily limits)
- [ ] Check error logging in Railway logs

---

## Post-Deployment

### Enable Custom Domain (Optional)

1. Railway Dashboard → Settings → **"Domains"**
2. Add custom domain: `api.orthis.app`
3. Configure DNS:
   - Type: CNAME
   - Name: api
   - Value: your-railway-url.up.railway.app

### Set Up Monitoring

1. Railway has built-in metrics (CPU, Memory, Network)
2. Consider adding:
   - Sentry for error tracking
   - LogDNA/Datadog for advanced logging
   - UptimeRobot for uptime monitoring

---

## Cost Estimate

**Railway Pricing** (as of 2026):
- Free tier: $5 credit/month
- Hobby plan: $5/month (recommended for production)
- Includes: 500 hours compute + 1GB RAM

**AWS S3 Costs**:
- Storage: ~$0.023/GB/month
- Requests: ~$0.005/1000 PUT requests
- Estimate: <$5/month for small user base

**Total**: ~$10/month for production backend + storage

---

## Support

- Railway docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Prisma docs: https://www.prisma.io/docs
- Report issues: https://github.com/Bradavis2011/FitCheck/issues
