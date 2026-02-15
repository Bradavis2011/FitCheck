# Backend Deployment Guide - Railway

This guide covers deploying the Or This? backend to Railway with PostgreSQL.

## Prerequisites

- GitHub account (for connecting Railway)
- Clerk account with app configured
- RevenueCat account with products configured
- Google Gemini API key
- AWS S3 bucket or Cloudflare R2 bucket (recommended)

---

## Step 1: Set Up Railway Account

1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Create a new project: **"New Project" → "Deploy from GitHub repo"**
4. Select your repository: `Bradavis2011/FitCheck`
5. Railway will detect the Node.js backend automatically

---

## Step 2: Add PostgreSQL Database

1. In your Railway project, click **"New"** → **"Database"** → **"PostgreSQL"**
2. Railway will provision a PostgreSQL instance
3. Copy the **DATABASE_URL** from the PostgreSQL service's **"Connect"** tab
4. Format: `postgresql://postgres:password@host:port/database`

---

## Step 3: Configure Environment Variables

In Railway, go to your backend service → **"Variables"** tab and add:

### Required Variables

```bash
# Database (auto-populated by Railway if you use ${{Postgres.DATABASE_URL}})
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Clerk Authentication
CLERK_SECRET_KEY=sk_live_xxxxxxxxx
CLERK_PUBLISHABLE_KEY=pk_live_xxxxxxxxx
CLERK_WEBHOOK_SECRET=whsec_xxxxxxxxx

# AI Service
GEMINI_API_KEY=AIzaSyxxxxxxxxx

# RevenueCat
REVENUECAT_WEBHOOK_AUTH_TOKEN=your_token
REVENUECAT_API_KEY=sk_xxxxxxxxx

# Cloud Storage (CRITICAL - without this, images stored as base64)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=orthis-production-images

# App Config
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://your-production-domain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=60
```

### Railway-Specific Variables

Railway provides reference variables for linked services:
- `${{Postgres.DATABASE_URL}}` - Automatically uses the connected PostgreSQL database
- `${{RAILWAY_PUBLIC_DOMAIN}}` - Your Railway-assigned domain

---

## Step 4: Set Up Build & Start Commands

Railway should auto-detect these, but verify in **Settings → Build & Deploy**:

**Root Directory:** `fitcheck-api`

**Build Command:**
```bash
npm install && npx prisma generate && npx prisma migrate deploy
```

**Start Command:**
```bash
npm start
```

**Healthcheck Path:** `/health`

---

## Step 5: Run Database Migrations

After the first deployment:

1. Go to Railway project → backend service → **"Deployments"** tab
2. Wait for build to complete
3. Click **"View Logs"** and verify: `✅ Prisma migration complete`
4. Check for: `🚀 Or This? API server running on port 3000`

If migrations fail, you can run them manually:
1. Railway project → backend service → **"Settings"** → **"Commands"**
2. Run: `npx prisma migrate deploy`

---

## Step 6: Configure Clerk Webhook

1. Copy your Railway backend URL: `https://your-app.up.railway.app`
2. Go to [Clerk Dashboard](https://dashboard.clerk.com)
3. Your application → **"Webhooks"** → **"Add Endpoint"**
4. **Endpoint URL:** `https://your-app.up.railway.app/api/auth/clerk-webhook`
5. **Subscribe to events:** `user.created`, `user.updated`
6. Copy the **Signing Secret** (starts with `whsec_`)
7. Update Railway environment variable: `CLERK_WEBHOOK_SECRET=whsec_...`
8. Redeploy the backend service

---

## Step 7: Configure RevenueCat Webhook

1. Go to [RevenueCat Dashboard](https://app.revenuecat.com)
2. Your project → **"Integrations"** → **"Webhooks"**
3. **Add Webhook URL:** `https://your-app.up.railway.app/api/webhooks/revenuecat`
4. **Authorization Header:** Use the value from `REVENUECAT_WEBHOOK_AUTH_TOKEN`
5. Select all event types
6. Save

---

## Step 8: Set Up Cloud Image Storage

### Option A: AWS S3 (Recommended for Production)

1. AWS Console → S3 → **Create bucket**
2. Bucket name: `orthis-production-images`
3. Region: `us-east-1` (or your preferred region)
4. **Block Public Access:** OFF (images need public URLs)
5. Create bucket

6. IAM → Users → Create user: `orthis-s3-uploader`
7. Attach policy: `AmazonS3FullAccess` (or create custom policy)
8. Create access key → Copy **Access Key ID** and **Secret Access Key**
9. Update Railway variables:
   ```
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=AKIA...
   AWS_SECRET_ACCESS_KEY=...
   AWS_S3_BUCKET=orthis-production-images
   ```

### Option B: Cloudflare R2 (Cheaper, S3-compatible)

1. Cloudflare Dashboard → R2 → **Create bucket**
2. Bucket name: `orthis-images`
3. Copy the **S3 API endpoint** (e.g., `https://abc123.r2.cloudflarestorage.com`)
4. R2 → **Manage R2 API Tokens** → Create API token
5. Copy **Access Key ID** and **Secret Access Key**
6. Update Railway variables:
   ```
   AWS_REGION=auto
   AWS_ACCESS_KEY_ID=<R2 Access Key>
   AWS_SECRET_ACCESS_KEY=<R2 Secret Key>
   AWS_S3_BUCKET=orthis-images
   ```

---

## Step 9: Update Frontend CORS

Update Railway environment variable:
```
CORS_ORIGIN=https://your-expo-app-domain.com
```

For development + production:
```
CORS_ORIGIN=http://localhost:8081,https://your-expo-app-domain.com
```

---

## Step 10: Test Deployment

1. **Health Check:** `https://your-app.up.railway.app/health`
   - Should return: `{"status":"ok","timestamp":"..."}`

2. **Test Clerk Webhook:**
   - Clerk Dashboard → Webhooks → Your endpoint → **Send test event**
   - Check Railway logs for: `✓ Created user ...`

3. **Test Image Upload:**
   - Use the mobile app to upload an outfit photo
   - Check Railway logs for: `☁️ S3 configured - images will be stored in: orthis-production-images`
   - If you see `⚠️ S3 not configured`, check environment variables

4. **Test AI Feedback:**
   - Submit an outfit check from the app
   - Verify response comes back with score and feedback

---

## Monitoring & Logs

### View Logs
Railway project → backend service → **"Logs"** tab

Key things to monitor:
- `🚀 Or This? API server running on port 3000` - Server started
- `☁️ S3 configured` - Image storage working
- `✓ Created user` - Clerk webhook working
- Error messages from Gemini API (quota limits)

### Metrics
Railway provides:
- CPU usage
- Memory usage
- Network bandwidth
- Request rate

Set up alerts in Railway for high error rates or downtime.

---

## Production Checklist

Before going live:

- [ ] PostgreSQL database provisioned
- [ ] All environment variables set (see `.env.production.example`)
- [ ] S3/R2 bucket configured with public read access
- [ ] Clerk webhook configured and tested
- [ ] RevenueCat webhook configured and tested
- [ ] CORS origin set to production app domain
- [ ] Database migrations ran successfully (`npx prisma migrate deploy`)
- [ ] Health check endpoint returns 200 OK
- [ ] Server logs show `☁️ S3 configured` (not base64 fallback)
- [ ] Test outfit upload + AI feedback end-to-end
- [ ] Rate limiting configured appropriately
- [ ] No JWT_SECRET in environment (legacy auth removed)

---

## Troubleshooting

### "Clerk webhook signature verification failed"
- Verify `CLERK_WEBHOOK_SECRET` matches Clerk dashboard
- Check webhook endpoint URL is correct: `/api/auth/clerk-webhook`
- Ensure Railway service is using `express.raw()` middleware for webhook route

### "S3 upload failed" in logs
- Check AWS credentials are correct
- Verify bucket name matches `AWS_S3_BUCKET`
- Ensure bucket has public read access
- Test credentials with AWS CLI: `aws s3 ls s3://your-bucket-name`

### "Database migration failed"
- Check `DATABASE_URL` is correct
- Verify Railway PostgreSQL service is running
- Manually run: `npx prisma migrate deploy` in Railway console
- Check for schema drift: `npx prisma migrate status`

### "RevenueCat webhook 401 Unauthorized"
- Verify `REVENUECAT_WEBHOOK_AUTH_TOKEN` matches RevenueCat dashboard
- Check webhook URL is correct: `/api/webhooks/revenuecat`

### High memory usage
- Check for memory leaks in image processing (sharp library)
- Increase Railway plan if needed
- Consider adding image size limits

---

## Scaling Considerations

### Railway Auto-Scaling
Railway automatically scales within your plan limits. For high traffic:
- Upgrade to Pro plan for better scaling
- Monitor CPU/memory metrics
- Consider horizontal scaling with multiple instances

### Database Performance
- Add indexes for frequently queried fields (already in Prisma schema)
- Use connection pooling (Prisma handles this automatically)
- Consider read replicas for high read traffic

### Image Storage Costs
- S3: ~$0.023/GB/month storage + $0.09/GB transfer
- Cloudflare R2: $0.015/GB/month storage, FREE egress
- **Recommendation:** Use R2 for significant cost savings on image-heavy app

---

## Alternative Hosting Options

### Vercel (Serverless)
- Pros: Easy deployment, great DX
- Cons: Cold starts, 10-second timeout limit
- Not ideal for image processing or long AI requests

### Render
- Similar to Railway
- Pros: Free PostgreSQL, good pricing
- Cons: Slower cold starts than Railway

### Fly.io
- Pros: Global edge deployment, good for latency
- Cons: More complex setup than Railway

**Recommendation:** Stick with Railway for MVP. It's the best balance of simplicity and power for Node.js + PostgreSQL.

---

## Cost Estimates (Monthly)

**Railway:**
- Starter plan: $5/month (includes $5 credit)
- Hobby plan: $20/month
- PostgreSQL: Included in plan

**Cloudflare R2:**
- Storage: $0.015/GB/month
- Operations: $4.50 per million writes
- Egress: FREE (huge savings vs S3)

**Total Estimated Cost (10,000 users, 100GB images):**
- Railway Hobby: $20/month
- R2 Storage: $1.50/month
- **Total: ~$21.50/month**

Compare to AWS (S3 + EC2): $50-100/month for same usage.
