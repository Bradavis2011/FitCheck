# Image Upload Troubleshooting Guide

## Question: Do I Need to Rebuild the APK?

**Short Answer: NO** (for the fixes made today)

### When You DON'T Need to Rebuild:
- ✅ JavaScript/TypeScript code changes (what I fixed today)
- ✅ UI changes
- ✅ Business logic updates
- ✅ API endpoint changes

**Solution:** Just restart Expo dev server:
```bash
cd fitcheck-app
npx expo start -c
```

### When You DO Need to Rebuild:
- ❌ Adding new native modules (npm packages with native code)
- ❌ Changing `app.json` plugins
- ❌ Updating Expo SDK version
- ❌ Modifying native Android/iOS code

**Solution:** Rebuild the development client:
```bash
npx expo prebuild --clean
npx expo run:android  # or run:ios
```

---

## Image Upload Failure - Common Causes

### 1. Backend Server Not Running (Most Common)

**Error:** "Cannot connect to server" or timeout

**Solution:**
```bash
# Start the backend in a new terminal
cd fitcheck-api
npm run dev
```

**Verify it's running:**
- Open browser: http://localhost:3001/health
- Should see: `{"status":"ok",...}`

---

### 2. Wrong API URL

**Error:** Connection timeout or "Network request failed"

**Check your `.env` file:**
```bash
cd fitcheck-app
cat .env
```

**For iOS Simulator:**
```
EXPO_PUBLIC_API_URL=http://localhost:3001
```

**For Android Emulator:**
```
EXPO_PUBLIC_API_URL=http://10.0.2.2:3001
```

**For Physical Device:**
```
EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_IP:3001
```

Get your IP:
```bash
# Windows
ipconfig
# Look for IPv4 Address (e.g., 192.168.1.203)
```

**After changing .env:**
```bash
npx expo start -c  # Clear cache and restart
```

---

### 3. Image Permissions Not Granted

**Error:** "Failed to process image" or permission denied

**Solution:**
- When the app asks for camera/photo permissions, tap **Allow**
- If you denied it before:
  - iOS: Settings → OrThis? → Photos → All Photos
  - Android: Settings → Apps → OrThis? → Permissions → Camera/Storage

---

### 4. Image Too Large

**Error:** Timeout or out of memory

**Current Settings:**
- Max width: 1080px
- Compression: 80%
- Format: JPEG

**If still too large, reduce compression:**
Edit `fitcheck-app/src/services/image-upload.service.ts`:
```typescript
compress: 0.6,  // Lower = smaller file (was 0.8)
```

---

### 5. Database Not Connected

**Error:** API returns 500 error

**Check backend logs for:**
```
✗ Database connection failed
```

**Solution:**
Verify DATABASE_URL in `fitcheck-api/.env`:
```
DATABASE_URL=postgresql://postgres:...@nozomi.proxy.rlwy.net:40138/railway
```

If Railway database expired, you'll need a new one.

---

## Debugging Steps

### Step 1: Check Expo Console
Look for these log messages:
```
[Context] Starting image upload...
[ImageUpload] Starting upload for URI: file://...
[ImageUpload] Compressing image...
[ImageUpload] Converting to base64...
[Context] Submitting to API...
```

**Where it stops = where the error is**

### Step 2: Check Backend Console
If backend is running, you should see:
```
POST /api/outfits/check 200 1234ms
```

If you see 500 or 400, check the error message.

### Step 3: Enable Network Debugging

In Chrome DevTools (while Expo is running):
1. Press `j` to open debugger
2. Open Network tab
3. Try upload again
4. Look for failed requests

---

## Quick Test Without Backend

To test if image upload works WITHOUT the backend:

1. Comment out the API call in `context.tsx`:
```typescript
// const response = await outfitService.submitCheck({...});
// For testing: just navigate with dummy ID
router.push({ pathname: '/feedback', params: { outfitId: 'test-123' } });
```

2. If this works → backend issue
3. If this fails → image processing issue

---

## Complete Checklist

Before reporting "failed to upload image":

- [ ] Backend server is running (`npm run dev` in fitcheck-api)
- [ ] Backend health check works (http://localhost:3001/health)
- [ ] Correct API URL in `.env` for your device type
- [ ] Expo dev server restarted with cache clear (`npx expo start -c`)
- [ ] Camera/photo permissions granted in app
- [ ] Checked Expo console for error messages
- [ ] Checked backend console for API errors

---

## Still Not Working?

Share these logs:
1. Full error message from Expo console
2. Backend console output (if running)
3. Your `.env` API_URL
4. Device type (iOS simulator/Android emulator/physical device)

This will help diagnose the exact issue!
