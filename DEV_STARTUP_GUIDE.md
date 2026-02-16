# 🚀 Or This? - Development Startup Guide

## Quick Start (Single Command!)

You can now start **both** the backend API and frontend app with a single command:

### Option 1: From Project Root (Easiest)
```bash
npm run dev
```

### Option 2: From Frontend Directory
```bash
cd fitcheck-app
npm run dev
```

### Option 3: Windows Batch File (Double-click!)
```
Just double-click: START.bat
```

---

## What Happens When You Run `npm run dev`

You'll see both services starting in the same terminal with colored prefixes:

```
[API] ✓ Server running on port 3001
[API] ✓ Database connected
[APP] › Expo Go allows you to ...
[APP] › Press s │ switch to development build
```

**Colors:**
- 🔵 **Blue** = Backend API logs
- 🟣 **Magenta** = Frontend App logs

---

## Individual Service Commands

If you need to run them separately:

### Backend Only
```bash
cd fitcheck-api
npm run dev
```

### Frontend Only
```bash
cd fitcheck-app
npm start
```

---

## All Available Commands

### From Project Root (`/`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start backend + frontend together |
| `npm run backend` | Start only backend API |
| `npm run frontend` | Start only frontend app |
| `npm run install-all` | Install dependencies for both |

### From Frontend (`/fitcheck-app`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start backend + frontend together |
| `npm run backend` | Start only backend API |
| `npm start` | Start only frontend app |
| `npm run android` | Start on Android device/emulator |
| `npm run ios` | Start on iOS simulator |
| `npm run web` | Start web version |

### From Backend (`/fitcheck-api`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start backend with hot-reload |
| `npm start` | Start backend (production) |
| `npm run db:push` | Push Prisma schema to database |
| `npm run db:studio` | Open Prisma Studio (DB GUI) |

---

## Stopping the Servers

Since both run in one terminal:

**Press `Ctrl+C` once** - This stops both services cleanly

---

## Troubleshooting

### Port Already in Use

**Error:** `Port 3001 is already in use`

**Solution:**
```bash
# Find process using port 3001
netstat -ano | findstr :3001

# Kill the process (replace PID with number from above)
taskkill /PID <PID> /F
```

### Backend Won't Start

**Error:** `Cannot find module` or `ENOENT`

**Solution:**
```bash
# Install backend dependencies
cd fitcheck-api
npm install

# Try again
cd ..
npm run dev
```

### Frontend Won't Start

**Error:** Metro bundler errors

**Solution:**
```bash
# Clear cache and reinstall
cd fitcheck-app
rm -rf node_modules
npm install
npx expo start -c
```

---

## First Time Setup

If this is your first time running the project:

1. **Install dependencies for both:**
   ```bash
   npm run install-all
   ```

2. **Set up environment variables:**
   - Copy `.env.example` to `.env` in both directories
   - Update `EXPO_PUBLIC_API_URL` in `fitcheck-app/.env`

3. **Start development:**
   ```bash
   npm run dev
   ```

---

## Development Workflow

### Daily Workflow
```bash
# Morning: Start everything
npm run dev

# During development: Make changes
# Both services auto-reload on file changes!

# Evening: Stop servers
Ctrl+C
```

### When Testing on Device
```bash
# Update API URL in fitcheck-app/.env
EXPO_PUBLIC_API_URL=http://YOUR_IP:3001

# Restart with cache clear
cd fitcheck-app
npx expo start -c

# Keep backend running in separate terminal
cd fitcheck-api
npm run dev
```

---

## Pro Tips

### 💡 Tip 1: Use Windows Terminal
Run in Windows Terminal for better colored output:
```powershell
wt -d D:\Users\Brandon\FitCheck npm run dev
```

### 💡 Tip 2: Keep Backend Running
If you're only working on frontend, you can:
1. Start backend once: `cd fitcheck-api && npm run dev`
2. Leave it running
3. Restart frontend as needed: `cd fitcheck-app && npx expo start -c`

### 💡 Tip 3: Quick Restart
Backend got stuck? Kill and restart without stopping frontend:
```bash
# Find and kill backend process
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Restart backend in new terminal
cd fitcheck-api && npm run dev
```

---

## Environment Variables Quick Reference

### Frontend (`fitcheck-app/.env`)
```bash
# API endpoint
EXPO_PUBLIC_API_URL=http://192.168.1.203:3001

# Clerk auth (optional)
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...

# RevenueCat (optional)
EXPO_PUBLIC_REVENUECAT_IOS_KEY=...
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=...
```

### Backend (`fitcheck-api/.env`)
```bash
# Database
DATABASE_URL=postgresql://...

# AI API Key
GEMINI_API_KEY=AIza...

# Server
PORT=3001
NODE_ENV=development
```

---

## Next Steps

1. ✅ Run `npm run dev` to start both services
2. ✅ Open Expo Go on your device and scan QR code
3. ✅ Try logging in (register a new account if needed)
4. ✅ Test image upload feature

Happy coding! 🎉
