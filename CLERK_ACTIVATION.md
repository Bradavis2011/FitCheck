# Clerk Auth Activation - Next Steps

## ✅ What's Done

1. ✅ Backend updated to use Clerk authentication
2. ✅ Frontend configured with Clerk keys
3. ✅ Backend server running on port 3000
4. ✅ Frontend Metro bundler starting on port 8082
5. ✅ Clerk keys added to .env files

## 🔧 What You Need To Do

### Step 1: Set Up Webhook Endpoint

Clerk needs to send webhooks to your API to sync users. Since you're running locally, you need to expose your API publicly.

#### Option A: Using ngrok (Recommended for dev)

1. **Install ngrok:**
   ```bash
   # Download from https://ngrok.com/download
   # Or install via:
   npm install -g ngrok
   # Or:
   choco install ngrok  # Windows with Chocolatey
   ```

2. **Start ngrok:**
   ```bash
   ngrok http 3000
   ```

3. **Copy the HTTPS URL** (looks like `https://abc123.ngrok-free.app`)

#### Option B: Using Cloudflare Tunnel

1. **Install cloudflared:**
   ```bash
   # Download from https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
   ```

2. **Start tunnel:**
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```

3. **Copy the HTTPS URL**

### Step 2: Configure Clerk Webhook

1. **Go to your Clerk Dashboard:** https://dashboard.clerk.com

2. **Navigate to Webhooks:**
   - Click on your app
   - Click "Webhooks" in the left sidebar
   - Click "Add Endpoint"

3. **Configure webhook:**
   - **Endpoint URL:** `https://your-ngrok-url.ngrok-free.app/api/auth/clerk-webhook`
     - Replace `your-ngrok-url.ngrok-free.app` with your actual ngrok URL
     - ⚠️ **Important:** Include `/api/auth/clerk-webhook` at the end

   - **Subscribe to events:**
     - ✅ `user.created`
     - ✅ `user.updated`

   - Click "Create"

4. **Copy the Signing Secret:**
   - After creating, click on the webhook
   - Copy the "Signing Secret" (starts with `whsec_`)

5. **Add to backend .env:**
   ```env
   CLERK_WEBHOOK_SECRET=whsec_your_secret_here
   ```

6. **Restart backend server:**
   ```bash
   # Stop the current server (Ctrl+C)
   cd fitcheck-api
   npm run dev
   ```

### Step 3: Test the Integration

1. **Open the app:**
   - The Metro bundler should show a QR code
   - Scan with Expo Go app on your phone
   - Or press `w` to open in web browser

2. **Sign up with Clerk:**
   - You should see Clerk's sign-in screen
   - Click "Sign up"
   - Enter email/password or use OAuth (Google, GitHub)

3. **Check if user synced:**
   - After signing up, check your backend logs
   - You should see: `✓ Created user [user-id] (email)`

4. **Verify database:**
   ```bash
   cd fitcheck-api
   npx prisma studio
   ```
   - Open http://localhost:5555
   - Check the `users` table
   - You should see the new user with:
     - `id`: Clerk user ID (not a UUID)
     - `email`: Your email
     - `name`: Your name
     - `password_hash`: NULL (Clerk manages auth)

### Step 4: Test API Requests

1. **Complete onboarding** in the app

2. **Try submitting an outfit check:**
   - Take a photo
   - Submit for feedback
   - Check backend logs to see if request authenticated properly

3. **If you get auth errors:**
   - Check browser/app console for error messages
   - Check backend logs for authentication failures
   - Verify Clerk publishable key is correct in frontend .env

## 🔍 Troubleshooting

### "Authentication required" errors

**Cause:** Clerk token not being sent or invalid

**Fix:**
1. Check frontend .env has correct `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
2. Restart Expo dev server: `npx expo start --clear`
3. Check browser console for Clerk errors
4. Verify backend `CLERK_SECRET_KEY` matches your Clerk dashboard

### Webhook not firing

**Cause:** Clerk can't reach your webhook endpoint

**Fix:**
1. Verify ngrok is running and URL is correct
2. Check webhook URL in Clerk dashboard includes `/api/auth/clerk-webhook`
3. Test webhook endpoint manually:
   ```bash
   curl https://your-ngrok-url/api/auth/clerk-webhook -X POST
   # Should return 400 "Missing svix headers" (that's expected!)
   ```
4. Check webhook logs in Clerk dashboard under "Webhooks" → Click your endpoint → "Logs"

### User not created in database

**Cause:** Webhook handler failing

**Fix:**
1. Check backend logs for errors when webhook fires
2. Verify `CLERK_WEBHOOK_SECRET` matches Clerk dashboard
3. Check database connection is working:
   ```bash
   cd fitcheck-api
   npx prisma db push
   ```
4. Manually trigger webhook in Clerk dashboard ("Webhooks" → "Testing" → Send test event)

### App shows old login screen

**Cause:** Frontend still in dev mode (no valid Clerk key)

**Fix:**
1. Verify `.env` has real Clerk key (not "pk_test_placeholder")
2. Restart Expo: `npx expo start --clear`
3. Check the key starts with `pk_test_` or `pk_live_`

## 📋 Verification Checklist

After completing all steps, verify:

- [ ] Backend server running without errors
- [ ] ngrok/tunnel running and exposing API
- [ ] Webhook configured in Clerk dashboard
- [ ] `CLERK_WEBHOOK_SECRET` added to backend .env
- [ ] Frontend shows Clerk sign-in screen
- [ ] Can sign up with email/password
- [ ] User appears in database after sign-up
- [ ] Can complete onboarding
- [ ] Can submit outfit check
- [ ] API requests authenticated properly

## 🚀 Production Deployment

When deploying to production:

1. **Replace ngrok with real domain:**
   - Deploy API to Railway/Render/Vercel
   - Update webhook URL in Clerk to production domain
   - Example: `https://api.fitcheck.com/api/auth/clerk-webhook`

2. **Switch to production keys:**
   - Backend: `CLERK_SECRET_KEY=sk_live_...`
   - Frontend: `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...`
   - Get from Clerk dashboard → "API Keys" → "Production"

3. **Update webhook:**
   - Create new webhook endpoint for production
   - Get new webhook secret
   - Update `CLERK_WEBHOOK_SECRET`

## ℹ️ Current Status

**Backend:**
- ✅ Running on http://localhost:3000
- ✅ Clerk SDK installed
- ✅ Auth middleware updated
- ⏳ Waiting for webhook configuration

**Frontend:**
- ✅ Metro bundler starting on port 8082
- ✅ Clerk publishable key configured
- ✅ Token injection set up
- ⏳ Waiting to test sign-up flow

**Next Immediate Step:**
1. Install ngrok: https://ngrok.com/download
2. Run: `ngrok http 3000`
3. Configure webhook in Clerk dashboard with ngrok URL
4. Test sign-up in the app

---

Need help? Check the full guide in `CLERK_SETUP.md`
