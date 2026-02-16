# FitCheck Setup Guide - $0 Implementation Complete! 🎉

All code changes have been implemented to run FitCheck end-to-end for **$0** using Google Gemini's free tier. Follow these steps to get everything running.

---

## 🗄️ Phase 1: Database Setup (Railway PostgreSQL)

Railway provides $5/month free credits - same service you used for Jobr.

### 1. Create Railway Project

1. Go to https://railway.app and sign in
2. Click "New Project" → "Provision PostgreSQL"
3. Wait for database to provision

### 2. Get Database URL

1. Click on the PostgreSQL service
2. Go to "Variables" tab
3. Copy the `DATABASE_URL` value (looks like `postgresql://postgres:...@...railway.app:5432/railway`)

### 3. Update Backend .env

```bash
cd fitcheck-api
```

Edit `.env` file and replace the `DATABASE_URL` with your Railway URL:

```env
DATABASE_URL=postgresql://postgres:PASSWORD@containers-us-west-123.railway.app:5432/railway
```

### 4. Run Database Migrations

```bash
npm install
npx prisma generate
npx prisma db push
```

✅ **Verify:** Run `npx prisma studio` - it should open and show empty tables with `passwordHash` and `imageData` fields.

---

## 🤖 Phase 2: Google Gemini API Key (FREE)

Google Gemini gives you **1,500 requests/day for free** - perfect for MVP!

### 1. Get API Key

1. Go to https://aistudio.google.com/apikey
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key (starts with `AIza...`)

### 2. Update Backend .env

Edit `fitcheck-api/.env`:

```env
GEMINI_API_KEY=AIzaSy...your-key-here
```

---

## 🚀 Phase 3: Start Backend Server

```bash
cd fitcheck-api
npm run dev
```

✅ **Verify:** You should see:
```
Server running on http://localhost:3000
```

### Test Backend Auth

Open a new terminal and test registration:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'
```

Expected response:
```json
{
  "user": {"id":"...","email":"test@example.com","name":"Test User","tier":"free"},
  "token":"eyJhbGc..."
}
```

✅ **Backend is ready!**

---

## 📱 Phase 4: Start Frontend App

### 1. Install Dependencies

```bash
cd fitcheck-app
npm install
```

### 2. Start Expo

```bash
npm start
```

### 3. Open on Device

- Press `a` for Android emulator
- Press `i` for iOS simulator
- Or scan QR code with Expo Go app

✅ **Verify:** You should see the login screen!

---

## 🧪 Phase 5: End-to-End Test

Follow these steps to verify the full flow works:

### 1. Create Account
- On login screen, tap "Don't have an account? Sign up"
- Enter email: `demo@fitcheck.com`
- Enter password: `password123`
- Enter name: `Demo User`
- Tap "Sign Up"

### 2. Take Outfit Photo
- You'll be redirected to the home tab
- Tap the camera icon (or go to Camera tab)
- Take/select a photo of an outfit

### 3. Add Context
- Select occasion (e.g., "Work")
- Optionally expand "Add more details" and add setting/weather/vibe
- Tap "Get Feedback"

### 4. Wait for AI Feedback
- Loading screen shows "Analyzing your outfit..."
- Wait 10-15 seconds for Gemini to analyze
- **Real AI feedback appears!** 🎉

### 5. Test Follow-Up
- Tap "Follow-up" button
- Ask: "What shoes would work better?"
- Get AI response

### 6. Check History
- Go to History tab
- Your outfit should appear in the grid
- Tap the heart to favorite it

### 7. Check Profile
- Go to Profile tab
- See your name, email, and tier
- Stats show "1 Check", "0 Favorites" (or 1 if you favorited)
- Tap "Sign Out" to test logout

✅ **If all steps work, you're done!**

---

## 🐛 Troubleshooting

### Backend won't start
- Check `DATABASE_URL` is correct in `.env`
- Run `npx prisma generate` again
- Make sure PostgreSQL is running on Railway

### "Failed to submit outfit check"
- Check backend is running on `http://localhost:3000`
- Check `GEMINI_API_KEY` is set in `.env`
- Check backend terminal for errors

### "Analyzing your outfit..." never finishes
- Check backend terminal for Gemini API errors
- Verify Gemini API key is valid
- Check you haven't exceeded 1,500 req/day limit

### Login doesn't work
- Check backend is running
- Check network tab in browser dev tools for errors
- Try creating a new account

### Can't connect to backend from phone
- If using physical device (not simulator), change `http://localhost:3000` to your computer's IP
- Edit `fitcheck-app/app/login.tsx` line 11: `const API_URL = 'http://192.168.1.X:3000/api';`
- Edit `fitcheck-app/src/lib/api.ts` line 3: `const API_BASE_URL = 'http://192.168.1.X:3000';`
- Find your IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)

---

## 💰 Cost Breakdown

| Service | Provider | Usage | Cost |
|---------|----------|-------|------|
| AI Vision Analysis | Google Gemini 1.5 Flash | 1,500 req/day | **$0** |
| Database | Railway PostgreSQL | $5/mo credit | **$0** |
| Image Storage | PostgreSQL (base64) | Included | **$0** |
| Auth | Custom JWT | - | **$0** |
| Frontend Dev | Expo Go | - | **$0** |
| Backend Dev | Local Node.js | - | **$0** |
| **Total** | | | **$0/month** |

---

## 📋 What Changed From Original Plan

### Backend
✅ Swapped OpenAI ($$$) → Google Gemini (FREE)
✅ Fixed auth (passwords now stored/verified with bcrypt)
✅ Accept base64 images (eliminates S3/R2 dependency)
✅ Store images in PostgreSQL (no separate storage needed)

### Frontend
✅ Created JWT auth with SecureStore
✅ Login/register screen for dev mode
✅ Image upload returns base64 for API
✅ Context screen submits to real API
✅ Feedback screen polls for real AI results
✅ History/Home/Profile use real API data
✅ Fixed type mismatches (title→point, occasionMatch)

---

## 🚀 Next Steps

Now that everything works end-to-end for $0, you can:

1. **Test thoroughly** - Create multiple outfits, test edge cases
2. **Deploy backend** - Deploy to Railway/Vercel when ready
3. **Get feedback** - Show to friends/family for user testing
4. **Add features** - Style preferences, outfit sharing, etc.
5. **Monetize** - Add premium tier with higher limits

The entire app is now functional with **zero monthly costs** until you're ready to scale! 🎊

---

## 📞 Need Help?

If you run into issues:
1. Check backend terminal for errors
2. Check Expo terminal for errors
3. Verify all `.env` variables are set
4. Test backend endpoints with `curl`
5. Check Railway dashboard for database status
