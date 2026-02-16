# FitCheck Quick Start - $0 Implementation

Get FitCheck running in **5 minutes** with these quick commands.

---

## ⚡ Prerequisites

1. **Railway PostgreSQL** - Create at https://railway.app
2. **Gemini API Key** - Get free key at https://aistudio.google.com/apikey

---

## 🚀 Quick Setup

### 1. Backend Setup (2 minutes)

```bash
# Navigate to backend
cd fitcheck-api

# Install dependencies (if not already done)
npm install

# Edit .env file
# Replace these two lines:
# DATABASE_URL=your-railway-postgres-url
# GEMINI_API_KEY=your-gemini-api-key

# Generate Prisma client and create tables
npx prisma generate
npx prisma db push

# Start backend server
npm run dev
```

✅ **Backend ready at http://localhost:3000**

---

### 2. Frontend Setup (2 minutes)

Open a **new terminal** and run:

```bash
# Navigate to frontend
cd fitcheck-app

# Install dependencies (if not already done)
npm install

# Start Expo
npm start
```

Then:
- Press `a` for Android emulator
- Press `i` for iOS simulator
- Or scan QR code with Expo Go app

✅ **App opens to login screen**

---

### 3. Test It! (1 minute)

1. **Register:** Create account with any email/password
2. **Photo:** Take or select an outfit photo
3. **Context:** Select "Work" occasion
4. **Feedback:** Tap "Get Feedback" and wait 10-15 seconds
5. **Result:** See real AI feedback! 🎉

---

## 🔧 Environment Variables Needed

### `fitcheck-api/.env`

```env
# Railway PostgreSQL (from railway.app dashboard)
DATABASE_URL=postgresql://postgres:PASSWORD@containers-us-west-123.railway.app:5432/railway

# Google Gemini API (from aistudio.google.com/apikey)
GEMINI_API_KEY=AIzaSy...your-key-here

# Already configured (keep these)
JWT_SECRET=fitcheck-dev-secret-key-change-in-production-min-32-chars
JWT_EXPIRES_IN=7d
NODE_ENV=development
PORT=3000
CORS_ORIGIN=*
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=60
```

That's it! No other env vars needed.

---

## 🐛 Quick Troubleshooting

### Backend won't start
```bash
# Check if Prisma client is generated
npx prisma generate

# Test database connection
npx prisma db push
```

### Can't connect from phone
If using a physical device (not simulator):

1. Find your computer's IP:
   - Windows: `ipconfig` → look for IPv4 Address
   - Mac/Linux: `ifconfig` → look for inet

2. Update frontend API URLs:
   - `fitcheck-app/app/login.tsx` line 11
   - `fitcheck-app/src/lib/api.ts` line 3
   - Change `localhost` to your IP (e.g., `192.168.1.5`)

### Gemini errors
- Verify API key is correct in `.env`
- Check you haven't exceeded 1,500 requests/day
- Look at backend terminal for error details

---

## 📖 Full Documentation

For detailed setup instructions and troubleshooting, see:
- **SETUP_GUIDE.md** - Complete step-by-step setup
- **IMPLEMENTATION_SUMMARY.md** - All code changes made

---

## 💡 Test Commands

### Test Backend Auth
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test"}'
```

### View Database
```bash
cd fitcheck-api
npx prisma studio
```

---

## 🎯 Success Checklist

- ✅ Backend running on port 3000
- ✅ Frontend opens to login screen
- ✅ Can register new account
- ✅ Can take/select photo
- ✅ Get real AI feedback (10-15 sec wait)
- ✅ Outfit appears in History tab
- ✅ Can favorite/unfavorite
- ✅ Profile shows correct stats
- ✅ Sign out works

If all checked = **You're done!** 🎊

---

## 💰 Costs

- Google Gemini: **FREE** (1,500 req/day)
- Railway PostgreSQL: **FREE** ($5/mo credit)
- Total: **$0/month** 🎉
