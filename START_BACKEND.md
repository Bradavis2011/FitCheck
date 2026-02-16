# Quick Start: Backend Server

## The Problem
Login is timing out because the backend API server is not running.

## Solution: Start the Backend Server

### Option 1: Quick Start (Recommended)
```bash
cd fitcheck-api
npm run dev
```

The server will start on **port 3001** at `http://localhost:3001`

### Option 2: Check if Backend is Already Running
```bash
# Windows
netstat -ano | findstr :3001

# If you see output, the server is running. If not, start it with Option 1.
```

---

## Backend Status Check

Once the server starts, you should see:
```
✓ Database connected
✓ Server running on port 3001
✓ CORS enabled
✓ Gemini AI configured
```

---

## Troubleshooting

### Error: Database Connection Failed
The backend uses a Railway PostgreSQL database. If you see connection errors:

1. Check the database URL in `fitcheck-api/.env`
2. Make sure the Railway database is still active

### Error: Port Already in Use
If port 3001 is already in use:

```bash
# Find and kill the process using port 3001
# Windows:
netstat -ano | findstr :3001
taskkill /PID <PID_NUMBER> /F

# Then restart the server
cd fitcheck-api
npm run dev
```

### Error: Module Not Found
If you see import errors:

```bash
cd fitcheck-api
npm install
npm run dev
```

---

## Verify Backend is Working

Open browser and go to:
- http://localhost:3001/health

You should see: `{"status":"ok","timestamp":"..."}`

---

## Update Frontend IP Address (For Physical Devices)

If testing on a physical device, update the API URL:

1. Find your computer's IP address:
   ```bash
   # Windows
   ipconfig
   # Look for IPv4 Address (e.g., 192.168.1.203)
   ```

2. Update `fitcheck-app/.env`:
   ```
   EXPO_PUBLIC_API_URL=http://YOUR_IP_ADDRESS:3001
   ```

3. Restart Expo:
   ```bash
   cd fitcheck-app
   npx expo start -c
   ```

---

## Ready to Test!

1. ✅ Backend running on port 3001
2. ✅ Frontend knows the correct API URL
3. ✅ Open the app and try logging in

**Test Credentials:**
- You'll need to register a new account
- Email: test@example.com
- Password: password123 (min 8 chars)
