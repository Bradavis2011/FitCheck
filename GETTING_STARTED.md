# Getting Started with FitCheck

**Welcome!** This guide will get you up and running with FitCheck in under 10 minutes.

## 🎯 What You'll Build

A full-stack AI outfit feedback app with:
- Mobile app (iOS + Android)
- AI-powered feedback using GPT-4 Vision
- Follow-up conversation feature
- History and favorites
- User authentication

## 📋 Prerequisites

Before you start, make sure you have:

1. **Node.js 18+** - [Download here](https://nodejs.org/)
2. **Git** - [Download here](https://git-scm.com/)
3. **One of these:**
   - Docker Desktop (easiest for database)
   - PostgreSQL installed locally
   - Supabase account (free cloud database)
4. **OpenAI API Key** - [Get one here](https://platform.openai.com/api-keys)
   - You'll need credits ($5-10 should last for development)

**Optional but recommended:**
- iOS Simulator (Mac only) or Android Emulator
- VS Code with these extensions:
  - Prisma
  - ESLint
  - React Native Tools

## 🚀 Quick Start (5 steps)

### Step 1: Get the Code

```bash
# If you haven't cloned yet:
git clone https://github.com/Bradavis2011/FitCheck.git
cd FitCheck
```

### Step 2: Set Up Database

**Choose ONE option:**

**Option A: Docker (Easiest) ⭐**
```bash
docker run --name fitcheck-db \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  -d postgres
```

**Option B: Supabase (Cloud, Free)**
1. Go to [supabase.com](https://supabase.com)
2. Sign up and create a new project
3. Go to Settings → Database
4. Copy the "Connection string" under "Connection pooling"
5. You'll use this in Step 3

**Option C: Local PostgreSQL**
```bash
# Mac
brew install postgresql
brew services start postgresql

# Windows: Download from postgresql.org
# Linux: apt-get install postgresql
```

### Step 3: Configure Backend

```bash
cd fitcheck-api

# Install dependencies
npm install

# Open .env file in your editor
# Update these two lines:

# 1. If using Docker or local PostgreSQL, leave as is:
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/fitcheck

# 2. If using Supabase, replace with your connection string:
DATABASE_URL=your-supabase-connection-string

# 3. Add your OpenAI API key:
OPENAI_API_KEY=sk-your-actual-key-here
```

**Initialize database:**
```bash
npm run db:push
npm run db:generate
```

You should see: `✔ Generated Prisma Client`

### Step 4: Start Backend

```bash
npm run dev
```

You should see:
```
🚀 FitCheck API server running on port 3000
📍 Environment: development
🔗 Health check: http://localhost:3000/health
```

**Test it:** Open http://localhost:3000/health in your browser
- Should show: `{"status":"ok","timestamp":"..."}`

✅ **Backend is running!** Keep this terminal open.

### Step 5: Start Mobile App

Open a **new terminal**:

```bash
cd fitcheck-app

# Install dependencies
npm install

# Start Expo
npm start
```

You'll see a QR code. Choose how to run:

**Option A: iOS Simulator (Mac only)**
- Press `i` in the terminal
- Or: `npm run ios`

**Option B: Android Emulator**
- Press `a` in the terminal
- Or: `npm run android`
- Make sure Android Studio is installed with an emulator

**Option C: Physical Device**
1. Install "Expo Go" app from App Store / Play Store
2. Scan the QR code
3. **Important for physical device:**
   - Find your computer's IP address:
     - Mac/Linux: Run `ifconfig | grep inet`
     - Windows: Run `ipconfig`
   - Edit `fitcheck-app/.env`:
     ```
     EXPO_PUBLIC_API_URL=http://YOUR_IP_ADDRESS:3000
     ```
   - Restart Expo: Press `r` in terminal

✅ **App is running!** You should see the FitCheck home screen.

## 🎨 Try It Out!

1. **Tab through the app** - Home, Camera, History, Profile
2. **Test with mock data:**
   - The app works offline with mock feedback
   - Great for UI development

3. **Test with real AI (if backend is running):**
   - Go to Camera tab
   - Take a photo or select from gallery
   - Choose an occasion (e.g., "Work")
   - Wait ~10-15 seconds for AI feedback
   - Try asking a follow-up question!

## 🐛 Troubleshooting

### Backend Issues

**"Database connection failed"**
```bash
# Check if PostgreSQL is running
# Docker:
docker ps | grep fitcheck-db

# Local:
pg_isready

# If not running, start it:
docker start fitcheck-db
# Or: brew services start postgresql
```

**"OPENAI_API_KEY is required"**
- Make sure you added it to `fitcheck-api/.env`
- Check for typos in the key
- Verify you have credits in your OpenAI account

**"Port 3000 already in use"**
```bash
# Find what's using it:
# Mac/Linux:
lsof -i :3000

# Windows:
netstat -ano | findstr :3000

# Kill it or change the port in .env:
PORT=3001
```

### Mobile App Issues

**App won't start**
```bash
# Clear cache
npx expo start -c

# Reinstall dependencies
rm -rf node_modules
npm install
```

**Can't connect to backend from physical device**
- Make sure phone and computer are on **same WiFi**
- Update `EXPO_PUBLIC_API_URL` with your computer's IP
- Check firewall isn't blocking port 3000

**Android emulator: "Network request failed"**
- Use `http://10.0.2.2:3000` instead of `localhost:3000`
- Update in `fitcheck-app/.env`

## 📚 Next Steps

Now that you're set up:

1. **Explore the code:**
   - Frontend: `fitcheck-app/app/` - All screens
   - Backend: `fitcheck-api/src/` - API logic
   - AI prompts: `fitcheck-api/src/services/ai-feedback.service.ts`

2. **Customize the AI:**
   - Edit the system prompt to change feedback style
   - Adjust scoring thresholds
   - Add new feedback categories

3. **Add features:**
   - Check `PROJECT_STATUS.md` for roadmap ideas
   - Styling tweaks in `fitcheck-app/src/constants/theme.ts`

4. **Deploy it:**
   - See `PROJECT_STATUS.md` for full deployment guide
   - Backend: Vercel or Railway
   - Frontend: EAS Build → App Store / Play Store

## 🎓 Learn More

- **[README.md](./README.md)** - Project overview
- **[QUICKSTART.md](./QUICKSTART.md)** - Alternative setup guide
- **[TECHNICAL_SPEC.md](./TECHNICAL_SPEC.md)** - Full architecture docs
- **[PROJECT_STATUS.md](./PROJECT_STATUS.md)** - Deployment guide

## 💡 Development Tips

**View Database:**
```bash
cd fitcheck-api
npm run db:studio
# Opens at http://localhost:5555
```

**Hot Reload:**
- Backend: Saves auto-reload (tsx watch)
- Frontend: Changes auto-refresh in Expo

**Debugging:**
- Backend logs: Check terminal running `npm run dev`
- Frontend logs: Shake device → "Debug Remote JS"
- Network: Check `fitcheck-app/src/lib/api.ts`

**Mock Data:**
- Location: `fitcheck-app/src/lib/mockData.ts`
- Used automatically when backend is offline
- Great for UI development without backend

## 🎉 You're All Set!

You now have:
- ✅ Backend API running with AI
- ✅ Mobile app running
- ✅ Database connected
- ✅ Full development environment

**Happy coding!** 🚀

Need help? Check the docs or open an issue on GitHub.

---

**Pro tip:** Star the repo if you find this useful! ⭐
