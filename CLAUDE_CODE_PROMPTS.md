# Claude Code Starter Prompt for FitCheck

Copy and paste the sections below into Claude Code to build incrementally.

---

## PROMPT 1: Initial Project Setup

```
I'm building a mobile app called "FitCheck" - a real-time outfit feedback app where women can photograph their outfit and get instant AI-powered styling feedback.

Create the initial project structure:

1. Create a React Native project with Expo:
   - Use TypeScript
   - Set up NativeWind (Tailwind for React Native) for styling
   - Install: expo-camera, expo-image-picker, @react-navigation/native, @react-navigation/native-stack, axios, @tanstack/react-query, zustand, expo-secure-store

2. Create this folder structure:
   /src
     /screens (HomeScreen.tsx, CameraScreen.tsx, ContextScreen.tsx, FeedbackScreen.tsx, HistoryScreen.tsx, ProfileScreen.tsx, AuthScreen.tsx)
     /components (Button.tsx, Card.tsx, LoadingSpinner.tsx)
     /services (api.ts)
     /hooks (useAuth.ts)
     /store (userStore.ts, outfitStore.ts)
     /types (index.ts)
     /utils (helpers.ts)
   App.tsx

3. Set up React Navigation with a stack navigator that has:
   - Auth stack (AuthScreen)
   - Main stack (Home, Camera, Context, Feedback, History, Profile)
   - Conditional rendering based on auth state

4. Create basic placeholder screens with just a title and "Coming soon" text.

Start with just this setup - we'll build each screen next.
```

---

## PROMPT 2: Camera Screen

```
Now build the CameraScreen for FitCheck.

Requirements:
1. Full-screen camera preview using expo-camera
2. Request camera permissions on mount (show nice error if denied)
3. A semi-transparent silhouette overlay guide showing optimal positioning (torso/body outline in center)
4. UI elements:
   - Large circular capture button at bottom center
   - Gallery icon button at bottom left (uses expo-image-picker)
   - Flip camera button at top right
   - Close/back button at top left
5. After capture, show a preview screen with:
   - Full-screen image preview
   - "Retake" button (bottom left)
   - "Use This Photo" button (bottom right, prominent)
6. "Use This Photo" navigates to ContextScreen, passing the image URI

Style: Dark theme, minimal UI, buttons with subtle backgrounds. Use NativeWind classes.

Handle edge cases:
- Permission denied state with helpful message
- Loading state while camera initializes
- Error state if camera fails
```

---

## PROMPT 3: Context Screen

```
Build the ContextScreen where users provide context about their outfit.

Receives: imageUri from CameraScreen via navigation params

UI Layout:
1. Top section: Small preview thumbnail of the captured outfit (rounded corners, shadow)
2. Required section - "What's the occasion?":
   - Horizontal scrolling pill buttons: Work, Casual, Date Night, Event, Interview, Other
   - One must be selected to continue
3. Optional section - Collapsible "Add more details" accordion:
   - Setting row: Indoor | Outdoor | Both (toggle buttons)
   - Weather row: Hot | Warm | Cool | Cold
   - Vibe row: Professional | Trendy | Classic | Relaxed | Elegant | Sexy
   - Text input: "Any specific concerns?" with placeholder "e.g., not sure about these colors together"
4. Bottom: Large "Get Feedback ✨" button (disabled until occasion selected)

On submit:
1. Show full-screen loading overlay with rotating messages:
   - "Analyzing your look..."
   - "Checking color coordination..."
   - "Almost there..."
2. Call the API (mock it for now - we'll connect later)
3. Navigate to FeedbackScreen with the response

Style: Light/white background, generous padding, accent color for selected pills.
```

---

## PROMPT 4: Feedback Display Screen

```
Build the FeedbackScreen to display AI outfit feedback.

Receives via navigation params:
- imageUri: string
- feedback: {
    overallScore: number,
    summary: string,
    whatsWorking: Array<{point: string, detail: string}>,
    consider: Array<{point: string, detail: string}>,
    quickFixes: Array<{suggestion: string, impact: string}>,
    occasionMatch: {score: number, notes: string}
  }

UI Layout:
1. Header: Back button, "Your Feedback" title
2. Outfit image (tappable to view fullscreen, medium height)
3. Score section:
   - Large score "8/10" with animated star rating
   - Summary text below in slightly larger font
4. Feedback cards (each collapsible):
   - "✅ What's Working" card (green-tinted) - list of points with details
   - "💭 Consider" card (amber-tinted) - list of points with details  
   - "💡 Quick Fixes" card (blue-tinted) - list of suggestions with impact
5. Occasion match badge (if score > 7, show "✓ Perfect for [occasion]")
6. Action buttons row:
   - "Ask Follow-up" (outline style)
   - Heart icon (toggle favorite)
   - "New Check" (filled style)
7. Bottom: "Was this helpful?" with thumbs up/down (appears after 3 seconds)

Animations:
- Cards fade in sequentially
- Score counts up from 0
- Subtle haptic on favorite toggle

For now, mock the data. We'll connect to real API next.
```

---

## PROMPT 5: Backend API Server

```
Create the backend API server for FitCheck.

Create a new directory /fitcheck-api with:
- Node.js + Express + TypeScript
- Prisma ORM with PostgreSQL

Project structure:
/fitcheck-api
  /src
    /routes (auth.routes.ts, outfits.routes.ts, user.routes.ts)
    /controllers (auth.controller.ts, outfits.controller.ts)
    /services (ai-feedback.service.ts, upload.service.ts)
    /middleware (auth.middleware.ts, error.middleware.ts)
    /utils (jwt.utils.ts)
    /types (index.ts)
    server.ts
  /prisma
    schema.prisma
  .env.example
  package.json
  tsconfig.json

Prisma schema should include:
- users (id, email, name, tier, daily_checks_used, daily_checks_reset_at, created_at)
- outfit_checks (id, user_id, image_url, occasion, setting, weather, vibe, concerns, ai_feedback JSON, ai_score, feedback_helpful, created_at)
- follow_ups (id, outfit_check_id, user_question, ai_response, created_at)

Implement these endpoints:
- POST /api/auth/register - create user, return JWT
- POST /api/auth/login - validate credentials, return JWT
- GET /api/auth/me - get current user from JWT

- POST /api/outfits/check - submit outfit (check daily limit, create record, return id)
- GET /api/outfits/:id - get outfit check with feedback
- GET /api/outfits - list user's outfit checks (paginated)
- POST /api/outfits/:id/rate - rate feedback helpfulness

Include:
- JWT auth middleware
- Error handling middleware
- Request validation with Zod
- CORS configured for mobile app

Don't implement AI integration yet - just mock the feedback response.
```

---

## PROMPT 6: AI Feedback Integration

```
Now add the OpenAI GPT-4 Vision integration for outfit analysis.

Create /src/services/ai-feedback.service.ts that:

1. Accepts: imageUrl, occasion, setting?, weather?, vibe?, concerns?

2. Calls OpenAI API with gpt-4-vision-preview:
   - System prompt that makes it act as a supportive personal stylist
   - User prompt with the image URL and context
   - Request JSON response matching our feedback structure

3. System prompt should emphasize:
   - Always lead with positives
   - Be specific, not vague ("the blue complements your skin tone" not "looks nice")
   - Give actionable quick fixes
   - Score realistically (most outfits 6-8)
   - Never be harsh or judgmental
   - Address user's specific concerns if provided

4. Parse the JSON response and validate structure

5. Handle errors:
   - Retry up to 3 times with exponential backoff
   - If all retries fail, return a generic positive fallback response
   - Log errors for monitoring

6. Update the outfits.controller.ts to:
   - Call this service after creating the outfit_check record
   - Store the AI response in the database
   - Return the feedback to the client

Add OPENAI_API_KEY to .env.example

Test with a sample image URL to verify it works.
```

---

## PROMPT 7: Connect Mobile App to Backend

```
Connect the React Native app to the backend API.

Update /src/services/api.ts:
1. Create axios instance with baseURL from environment
2. Add request interceptor to attach JWT from secure storage
3. Add response interceptor for error handling
4. Create typed API methods:
   - api.auth.login(email, password)
   - api.auth.register(email, password, name)
   - api.auth.me()
   - api.outfits.check(imageUri, occasion, context)
   - api.outfits.get(id)
   - api.outfits.list(page)
   - api.outfits.rate(id, helpful)

Update /src/hooks/useAuth.ts:
- Check for stored token on app load
- Provide login/logout/register functions
- Store/clear token in expo-secure-store

Create /src/hooks/useOutfitCheck.ts:
- useMutation for submitting outfit check
- Handle image upload (base64 or presigned URL)
- Return loading state and result

Update ContextScreen:
- On submit, actually call api.outfits.check()
- Handle loading and error states properly
- Navigate to FeedbackScreen with real response

Update FeedbackScreen:
- Fetch feedback if not passed via params
- Handle loading state
- Actually persist rating when user rates helpfulness

Test the full flow: capture → context → submit → feedback
```

---

## PROMPT 8: History Screen

```
Build the HistoryScreen to show past outfit checks.

Features:
1. Grid layout (2 columns) of outfit cards
2. Each card shows:
   - Outfit image thumbnail
   - Score badge in top-right corner (colored: green 8+, yellow 6-7, red <6)
   - Heart icon if favorited (top-left)
   - Occasion label at bottom
   - Tap to view full feedback
3. Filter tabs at top: All | Favorites | filter by occasion (dropdown)
4. Pull to refresh
5. Infinite scroll pagination (load 20 at a time)
6. Empty state: illustration + "No outfit checks yet" + "Start your first check" button
7. Long press on card shows action sheet: View | Share | Delete

Use React Query's useInfiniteQuery for pagination.

Create a reusable OutfitCard component that can be used elsewhere.

Style: Clean white background, subtle shadows on cards, consistent spacing.
```

---

## PROMPT 9: User Profile & Settings

```
Build ProfileScreen with user settings.

Sections:

1. Profile header:
   - Avatar (or initials if no image)
   - Name (editable)
   - Email (display only)
   - Subscription tier badge

2. Style Preferences (editable):
   - Preferred styles: multi-select chips (Classic, Trendy, Minimalist, Bohemian, etc.)
   - Colors I love: color picker circles
   - Colors I avoid: color picker circles
   - Body type: optional dropdown

3. App Settings:
   - Notifications toggle
   - Face blur default (for future community features)
   - Data retention preference

4. Account:
   - Subscription status (show tier, upgrade button for free users)
   - Usage stats (checks this month, streak)
   - Delete account (with confirmation)

5. About:
   - Version number
   - Privacy policy link
   - Terms of service link
   - Contact support

Save preferences via API and update Zustand store.
```

---

## PROMPT 10: Polish & Production Ready

```
Final polish for FitCheck MVP:

1. Add app icon and splash screen:
   - Use expo-splash-screen
   - Create a simple logo (mirror + sparkle concept)

2. Add haptic feedback:
   - On capture button press
   - On favorite toggle
   - On rating submission

3. Add skeleton loading states for:
   - FeedbackScreen while loading
   - HistoryScreen while loading
   - ProfileScreen while loading

4. Error boundaries:
   - Wrap main app in error boundary
   - Show friendly error screen with retry button

5. Offline handling:
   - Detect network status
   - Queue outfit submissions when offline
   - Show "Saved, will sync when online" toast

6. Analytics events (just the hooks, can integrate later):
   - outfit_check_started
   - outfit_check_completed
   - feedback_rated
   - follow_up_asked
   - subscription_upgrade_viewed

7. Rate limiting UI:
   - Show remaining checks for today in HomeScreen
   - When limit reached, show upgrade modal

8. Add simple onboarding (3 screens):
   - "Get instant feedback on any outfit"
   - "AI analyzes colors, fit, and style"  
   - "Know you look great before you leave"

Test the complete flow on both iOS and Android simulators.
```

---

## Deployment Prompt

```
Prepare FitCheck for deployment:

Backend:
1. Create Dockerfile for the API
2. Add production environment config
3. Set up database migrations for production
4. Create health check endpoint

Mobile:
1. Configure EAS Build (eas.json)
2. Set up environment variables for production API URL
3. Create app.json with proper bundle identifiers
4. Generate production builds for iOS and Android

Provide step-by-step deployment instructions for:
- Backend to Vercel or Railway
- Database to Supabase or Railway PostgreSQL
- Mobile app to TestFlight (iOS) and Internal Testing (Android)
```

---

## Tips for Using These Prompts

1. **Run them in order** - each builds on the previous
2. **Test after each prompt** - make sure it works before moving on
3. **Iterate** - if something doesn't work, ask Claude Code to fix it
4. **Add details** - if you have specific design preferences, add them to the prompts
5. **Save your progress** - commit to git after each major section

Good luck building FitCheck! 🚀
