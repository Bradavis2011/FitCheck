# FitCheck - Quick Start Guide

Get the full stack running locally in 5 minutes.

## Prerequisites

- Node.js 18+ installed
- PostgreSQL installed (or use a cloud database)
- OpenAI API key ([get one here](https://platform.openai.com/api-keys))

## Option 1: Quick Local Setup (Recommended for Testing)

### Step 1: Set up PostgreSQL

**Option A: Use Docker (Easiest)**
```bash
docker run --name fitcheck-db -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres
```

**Option B: Use Supabase (Cloud, Free)**
1. Go to [supabase.com](https://supabase.com) and create account
2. Create new project
3. Copy the "Connection string" from Settings → Database
4. Use that instead of the localhost URL below

**Option C: Install PostgreSQL Locally**
```bash
# Windows: Download from postgresql.org
# Mac: brew install postgresql
# Linux: apt-get install postgresql
```

### Step 2: Install Backend Dependencies
```bash
cd fitcheck-api
npm install
```

### Step 3: Configure Environment Variables

The `.env` file has been created. **Update it with your OpenAI API key:**

```bash
# Edit fitcheck-api/.env
OPENAI_API_KEY=sk-your-actual-key-here
```

If using Supabase or different database:
```bash
DATABASE_URL=your-supabase-connection-string
```

### Step 4: Initialize Database
```bash
# Still in fitcheck-api/
npm run db:push
npm run db:generate
```

### Step 5: Start Backend Server
```bash
npm run dev
```

You should see:
```
🚀 FitCheck API server running on port 3000
📍 Environment: development
🔗 Health check: http://localhost:3000/health
```

### Step 6: Test Backend (Optional)
Open a new terminal and test the API:
```bash
curl http://localhost:3000/health
# Should return: {"status":"ok","timestamp":"..."}
```

### Step 7: Install Mobile App Dependencies
```bash
cd ../fitcheck-app
npm install
```

### Step 8: Start Mobile App
```bash
npm start
```

Press:
- `i` for iOS simulator
- `a` for Android emulator
- Scan QR code for physical device

## Option 2: Mobile Development Only (No Backend)

If you just want to work on the UI:

```bash
cd fitcheck-app
npm install
npm start
```

The app will use **mock data** automatically when the backend isn't running. All features work with mock data!

## Verify Everything Works

### Backend Checklist
- [ ] `http://localhost:3000/health` returns `{"status":"ok"}`
- [ ] Prisma Studio opens: `npm run db:studio`
- [ ] No errors in terminal

### Mobile App Checklist
- [ ] App opens without crashes
- [ ] Can navigate between tabs
- [ ] Camera screen works
- [ ] Can see mock feedback
- [ ] History shows sample outfits

## Common Issues

### "Database connection failed"
- Check PostgreSQL is running: `pg_isready` (local) or check Supabase dashboard
- Verify `DATABASE_URL` in `.env`
- For Docker: `docker ps` to check container is running

### "OPENAI_API_KEY is required"
- Add your key to `fitcheck-api/.env`
- Get a key at https://platform.openai.com/api-keys
- Make sure you have credits in your OpenAI account

### "Port 3000 already in use"
- Change `PORT=3001` in `fitcheck-api/.env`
- Update `EXPO_PUBLIC_API_URL` in `fitcheck-app/.env` to match

### Mobile app can't connect to backend
- **iOS simulator:** Use `http://localhost:3000`
- **Android emulator:** Use `http://10.0.2.2:3000`
- **Physical device:** Use your computer's IP (e.g., `http://192.168.1.100:3000`)

To find your IP:
```bash
# Windows
ipconfig
# Look for "IPv4 Address"

# Mac/Linux
ifconfig | grep "inet "
# Look for your local network IP
```

## Development Workflow

### Backend Changes
```bash
cd fitcheck-api
npm run dev          # Auto-reloads on file changes
npm run db:studio    # View/edit database
npm run db:push      # Update database schema
```

### Frontend Changes
```bash
cd fitcheck-app
npm start           # Auto-reloads on file changes
```

### View Database
```bash
cd fitcheck-api
npm run db:studio
```
Opens Prisma Studio at `http://localhost:5555`

## Testing the Full Flow

1. **Capture outfit photo** (or select from gallery)
2. **Select occasion** (e.g., "Work")
3. **Add context** (optional: setting, weather, vibe)
4. **Get feedback** - Wait ~10-15 seconds for AI response
5. **Ask follow-up** - Click "Follow-up" button, ask a question
6. **View history** - See your outfit in the History tab
7. **Toggle favorite** - Heart icon on outfit cards

## Next Steps

- Read `PROJECT_STATUS.md` for deployment guide
- Read `API_INTEGRATION.md` for API details
- Customize the AI prompts in `fitcheck-api/src/services/ai-feedback.service.ts`
- Adjust rate limits and tier restrictions
- Add your own styling tweaks

## Need Help?

- Check `fitcheck-api/README.md` for backend details
- Check `fitcheck-app/API_INTEGRATION.md` for frontend details
- Look at mock data in `fitcheck-app/src/lib/mockData.ts` for examples
- Review the Technical Spec: `TECHNICAL_SPEC.md`

---

**Ready to ship?** See `PROJECT_STATUS.md` for deployment instructions.
