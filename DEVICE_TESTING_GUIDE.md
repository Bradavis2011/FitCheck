# Device Testing Guide - FitCheck App

## Prerequisites

✅ All TypeScript errors resolved
✅ Backend API running on `http://localhost:3000`
✅ PostgreSQL database connected (Railway)
✅ Gemini AI configured with valid API key

---

## Setup Instructions

### Option 1: Test on iOS Simulator (Mac only)
```bash
cd fitcheck-app
npx expo start
# Press 'i' to open iOS simulator
```

### Option 2: Test on Android Emulator
```bash
cd fitcheck-app
npx expo start
# Press 'a' to open Android emulator
```

### Option 3: Test on Physical Device (Recommended)

#### For Physical Device Testing:

**Important**: Your physical device must be able to reach your backend API.

1. **Find your local IP address**:
   ```bash
   # Windows:
   ipconfig
   # Look for "IPv4 Address" (e.g., 192.168.1.203)

   # Mac/Linux:
   ifconfig | grep "inet "
   ```

2. **Update backend to listen on all interfaces**:
   - Backend should already be configured to accept connections from your network

3. **Update frontend API URL**:
   - Open `fitcheck-app/.env`
   - Change: `EXPO_PUBLIC_API_URL=http://localhost:3000`
   - To: `EXPO_PUBLIC_API_URL=http://YOUR_IP_ADDRESS:3000`
   - Example: `EXPO_PUBLIC_API_URL=http://192.168.1.203:3000`

4. **Start the app**:
   ```bash
   cd fitcheck-app
   npx expo start -c
   # Scan QR code with Expo Go app (iOS) or Camera app (Android)
   ```

---

## Testing Checklist

### 🔐 Authentication Flow
- [ ] Sign up with new email/password works
- [ ] Sign in with existing credentials works
- [ ] Sign out works
- [ ] Email validation shows errors for invalid format
- [ ] Password validation shows errors (min 8 chars)

### 🏠 Home Screen
- [ ] **Main CTA button** navigates to Camera screen when tapped
- [ ] **Daily checks counter** shows dynamic value (e.g., "3/3 remaining")
- [ ] **"View History" button** navigates to History tab
- [ ] **"Favorites" button** navigates to History tab with favorites filter
- [ ] **Recent check images** open full feedback when tapped ✨ (FIXED)
- [ ] **Upgrade card** shows placeholder alert when tapped
- [ ] **Avatar** navigates to Profile screen
- [ ] Light mode colors: white CTA card, light gray quick actions, dark text

### 📷 Camera Screen
- [ ] Camera permission request appears on first launch
- [ ] Camera preview shows live feed
- [ ] **Capture button** takes photo and shows preview
- [ ] **Gallery button** opens photo picker
- [ ] Selected image shows in preview
- [ ] **Retake button** returns to camera
- [ ] **Use Photo button** navigates to Context screen
- [ ] Camera UI stays dark (black background, white text)

### 📝 Context Input Screen
- [ ] **Occasion pills** toggle selection (multiple allowed)
- [ ] **Setting toggles** work (Indoor/Outdoor/Both)
- [ ] **Weather toggles** work (Sunny/Rainy/Cold/Hot)
- [ ] **Vibe input** accepts text
- [ ] **Specific concerns** accepts text
- [ ] **Submit button** navigates to Feedback screen
- [ ] Submit is disabled if no occasions selected
- [ ] Pink asterisk shows for required field
- [ ] Light gray backgrounds, dark text

### ✨ Feedback Screen
- [ ] Loading state shows "Analyzing your outfit..." (10-15 seconds)
- [ ] **AI analysis completes** and displays feedback
- [ ] **Score displays** correctly (color-coded: green >=8, amber >=6, red <6)
- [ ] **Summary** shows in one encouraging sentence
- [ ] **What's Working** section shows 2-3 points with details (1-2 sentences each)
- [ ] **Consider** section shows 2-3 points with details
- [ ] **Quick Fixes** section shows 2-3 suggestions with impact
- [ ] Spacing between points is comfortable (8px gap)
- [ ] **"Was this helpful?"** prompt appears after 3 seconds
- [ ] Thumbs up/down buttons work and show "Thanks for your feedback!"
- [ ] **Share button** shows placeholder alert
- [ ] **Favorite button** (heart) toggles favorite status
- [ ] **Follow-up button** opens modal
- [ ] **New Check button** returns to Home and resets flow
- [ ] **Back button** returns to Home
- [ ] White feedback cards with colored left borders

### 💬 Follow-Up Modal
- [ ] Modal opens when "Follow-up" is tapped
- [ ] Can ask up to 3 follow-up questions
- [ ] Each question gets AI response
- [ ] Counter shows remaining questions (e.g., "2/3 remaining")
- [ ] Submit button disabled when no text entered
- [ ] Close button dismisses modal

### 📚 History Screen
- [ ] Shows list of past outfit checks
- [ ] **"All" filter** shows all outfits
- [ ] **"Favorites" filter** shows only favorited outfits
- [ ] **Occasion filters** work (Work, Casual, Date Night, etc.)
- [ ] Each card shows thumbnail, score, date, occasion
- [ ] **Tapping outfit card** opens Feedback screen for that outfit ✨ (FIXED)
- [ ] Can navigate back from feedback to history
- [ ] Can view any past outfit's full feedback and details
- [ ] Empty state shows when no outfits match filter
- [ ] Light backgrounds, dark text

### 👤 Profile Screen
- [ ] Shows user avatar (initials if no image)
- [ ] Shows user email and tier (Free/Plus)
- [ ] **Stats display** correctly:
   - Total Outfits
   - Favorites
   - Current Streak
   - Level & Points
- [ ] **Account accordion** expands/collapses
- [ ] **Preferences accordion** expands/collapses
- [ ] **Dark Mode toggle** shows (not functional - future feature)
- [ ] **Notifications toggle** shows (not functional - future feature)
- [ ] **Sign Out button** works and returns to login
- [ ] Light cards, dark text

### 🎨 Visual Design
- [ ] All screens use light mode (white/light gray backgrounds)
- [ ] Dark text is readable (#0F172A)
- [ ] Status bar shows dark icons (not white)
- [ ] Tab bar has white background with top border
- [ ] Camera screen is dark (intentional exception)
- [ ] No dark mode artifacts remain
- [ ] Buttons have proper hover/press states
- [ ] Shadows visible on elevated cards

### 🔢 Data & API
- [ ] Daily checks counter decrements after each check
- [ ] Favorites toggle persists across sessions
- [ ] Outfit history loads on app restart
- [ ] Network errors show appropriate messages
- [ ] No console errors in Metro logs

### ⚡ Performance
- [ ] App launches in under 3 seconds
- [ ] AI analysis completes in 10-20 seconds
- [ ] Navigation transitions are smooth
- [ ] No lag when scrolling History
- [ ] Camera preview is smooth (30 fps)

---

## Known Placeholders (Future Features)

These features show placeholder alerts and are ready for implementation:

1. **Subscription/Upgrade** (Home screen upgrade card)
   - Shows: "Subscription coming soon! 🚀"
   - Ready for: Stripe/RevenueCat integration

2. **Share Feature** (Feedback screen share button)
   - Shows: "Share feature coming soon! 📤"
   - Ready for: React Native Share integration

3. **Dark Mode Toggle** (Profile screen)
   - Currently non-functional (UI only)
   - Future: Persist theme preference

4. **Notifications Toggle** (Profile screen)
   - Currently non-functional (UI only)
   - Future: Push notification settings

---

## Troubleshooting

### "Network Error" when signing in
- Verify backend is running: `cd fitcheck-api && npm run dev`
- Check `.env` file has correct `EXPO_PUBLIC_API_URL`
- For physical device: Use your local IP, not `localhost`

### "Failed to fetch outfit" or "AI analysis stuck"
- Check Gemini API key is valid in backend `.env`
- Check PostgreSQL connection (Railway should be connected)
- Look at backend logs for errors

### Camera permission denied
- iOS: Settings > Expo Go > Camera > Allow
- Android: Settings > Apps > Expo Go > Permissions > Camera > Allow

### TypeScript errors in Metro
- Stop Metro (Ctrl+C)
- Clear cache: `npx expo start -c`

### App crashes on launch
- Check Metro logs for errors
- Verify all dependencies installed: `npm install`
- Try clearing cache: `npx expo start -c`

---

## Post-Testing

After completing device testing:

1. **Document any bugs** found during testing
2. **Capture screenshots** for app store submission
3. **Record demo video** showing core features
4. **Verify backend is ready** for production deployment
5. **Update app.json** with final branding (name, icon, splash)

---

## Next Steps After Testing

1. ✅ Deploy backend to Railway/Vercel
2. ✅ Set up image storage (S3/Cloudflare R2)
3. ✅ Create production build
4. ✅ Submit to App Store / Play Store

---

**Testing Complete? Mark items checked above and note any issues for fixing!**
