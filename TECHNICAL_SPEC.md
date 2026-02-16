# Technical Specification & Claude Code Implementation Guide
## FitCheck MVP

**Purpose:** This document provides the technical architecture and step-by-step implementation guide for building the FitCheck MVP using Claude Code.

---

## Architecture Overview

### Tech Stack (Recommended)

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Mobile App** | React Native + Expo | Cross-platform, rapid development, good camera APIs |
| **Backend** | Node.js + Express | Fast development, good for real-time features |
| **Database** | PostgreSQL + Prisma | Relational data (users, outfits, feedback), excellent ORM |
| **Image Storage** | AWS S3 or Cloudflare R2 | Cheap, reliable, CDN-friendly |
| **AI Integration** | OpenAI GPT-4 Vision | Best-in-class image understanding |
| **Auth** | Clerk or Supabase Auth | Quick setup, social logins |
| **Hosting** | Vercel (backend) + Expo EAS (mobile) | Easy deployment |

### System Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Mobile App    │────▶│   API Server    │────▶│   PostgreSQL    │
│  (React Native) │     │   (Node.js)     │     │   (Database)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │   OpenAI API    │
                        │  (GPT-4 Vision) │
                        └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │   S3 Storage    │
                        │   (Images)      │
                        └─────────────────┘
```

---

## Database Schema

### Core Tables

```sql
-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    profile_image_url TEXT,
    
    -- Preferences
    style_preferences JSONB DEFAULT '{}',
    body_type VARCHAR(50),
    color_season VARCHAR(50),
    
    -- Subscription
    tier VARCHAR(20) DEFAULT 'free', -- free, plus, pro
    subscription_expires_at TIMESTAMP,
    
    -- Usage tracking
    daily_checks_used INT DEFAULT 0,
    daily_checks_reset_at DATE DEFAULT CURRENT_DATE,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Outfit Checks
CREATE TABLE outfit_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Image data
    image_url TEXT NOT NULL,
    image_type VARCHAR(10) DEFAULT 'photo', -- photo, video
    
    -- Context provided by user
    occasion VARCHAR(50) NOT NULL,
    setting VARCHAR(20),
    weather VARCHAR(20),
    vibe VARCHAR(50),
    specific_concerns TEXT,
    
    -- AI Feedback
    ai_feedback JSONB,
    ai_score DECIMAL(3,1),
    ai_processed_at TIMESTAMP,
    
    -- User rating of feedback
    feedback_helpful BOOLEAN,
    feedback_rating INT, -- 1-5
    
    -- Metadata
    is_favorite BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Follow-up Questions (for conversation)
CREATE TABLE follow_ups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outfit_check_id UUID REFERENCES outfit_checks(id) ON DELETE CASCADE,
    
    user_question TEXT NOT NULL,
    ai_response TEXT,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- For Phase 2: Community Feedback
CREATE TABLE community_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outfit_check_id UUID REFERENCES outfit_checks(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    rating VARCHAR(20) NOT NULL, -- works, almost, needs_work
    comment TEXT,
    
    -- Quality tracking
    was_helpful BOOLEAN,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- For gamification
CREATE TABLE user_stats (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    
    total_feedback_given INT DEFAULT 0,
    total_helpful_votes INT DEFAULT 0,
    current_streak INT DEFAULT 0,
    longest_streak INT DEFAULT 0,
    points INT DEFAULT 0,
    level INT DEFAULT 1,
    
    updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## API Endpoints

### Authentication
```
POST /api/auth/register     - Create account
POST /api/auth/login        - Login (returns JWT)
POST /api/auth/social       - Social login (Google/Apple)
GET  /api/auth/me           - Get current user
```

### Outfit Checks
```
POST /api/outfits/check     - Submit outfit for feedback
GET  /api/outfits           - List user's outfit checks
GET  /api/outfits/:id       - Get specific outfit with feedback
POST /api/outfits/:id/followup - Ask follow-up question
PUT  /api/outfits/:id/rate  - Rate the feedback helpfulness
PUT  /api/outfits/:id/favorite - Toggle favorite
DELETE /api/outfits/:id     - Soft delete outfit check
```

### User
```
GET  /api/user/profile      - Get user profile
PUT  /api/user/profile      - Update profile/preferences
GET  /api/user/stats        - Get usage stats
GET  /api/user/history      - Get outfit history with filters
```

### Upload
```
POST /api/upload/presigned  - Get presigned URL for S3 upload
```

---

## Claude Code Implementation Guide

### Step 1: Project Setup

**Prompt for Claude Code:**
```
Create a new React Native project with Expo for a fashion feedback app called FitCheck.

Set up the project structure:
/fitcheck-app
  /src
    /screens
    /components
    /services
    /hooks
    /utils
    /styles
    /types
  /assets
  App.tsx
  
Install these dependencies:
- expo-camera
- expo-image-picker
- @react-navigation/native (with stack navigator)
- axios
- @tanstack/react-query
- zustand (for state management)
- expo-secure-store (for auth tokens)

Create a basic navigation structure with these screens:
- SplashScreen
- OnboardingScreen
- HomeScreen
- CameraScreen
- FeedbackScreen
- HistoryScreen
- ProfileScreen

Use TypeScript throughout.
```

### Step 2: Camera & Capture Flow

**Prompt for Claude Code:**
```
Build the CameraScreen for FitCheck with these features:

1. Full-screen camera view using expo-camera
2. An overlay silhouette guide showing optimal body positioning (torso centered)
3. Photo capture button (large, centered at bottom)
4. Gallery pick button (bottom left)
5. Flip camera button (top right)
6. A "lighting quality" indicator that warns if lighting is poor

After capture:
1. Show preview of the image
2. "Retake" button and "Use This" button
3. On "Use This", navigate to ContextScreen

Handle permissions properly with friendly error states.

Style: Clean, minimal UI with dark background. Use Tailwind-style classes via NativeWind if possible.
```

### Step 3: Context Input Screen

**Prompt for Claude Code:**
```
Create ContextScreen that collects outfit context before submitting for feedback.

UI Requirements:
1. Show captured image as small thumbnail at top
2. Required: Occasion selector (pill buttons)
   Options: Work, Casual, Date Night, Event, Interview, Other
3. Optional: "Add more context" expandable section with:
   - Setting: Indoor, Outdoor, Mixed
   - Weather: Hot, Warm, Cool, Cold
   - Vibe: Professional, Trendy, Classic, Relaxed, Sexy, Elegant
   - Text input: "Any specific concerns?" (placeholder: "e.g., worried about the color combo")
4. Large "Get Feedback" button at bottom

Keep it fast - user should be able to submit in 2 taps (select occasion + submit).

On submit:
1. Show loading state with encouraging message ("Analyzing your look...")
2. Call API to submit outfit check
3. Navigate to FeedbackScreen on success

Include proper form validation and error handling.
```

### Step 4: Backend API Server

**Prompt for Claude Code:**
```
Create a Node.js + Express backend server for FitCheck.

Project structure:
/fitcheck-api
  /src
    /routes
    /controllers
    /services
    /middleware
    /utils
    /types
  /prisma
    schema.prisma
  server.ts

Include:
1. Prisma setup with PostgreSQL (use the schema I provide)
2. JWT authentication middleware
3. Rate limiting (60 requests/minute)
4. Error handling middleware
5. Request validation with Zod

Create these route files:
- auth.routes.ts
- outfits.routes.ts
- user.routes.ts
- upload.routes.ts

For the outfit check endpoint (POST /api/outfits/check):
1. Validate request body (imageUrl, occasion, optional fields)
2. Check user's daily limit (3 for free tier)
3. Create outfit_check record
4. Trigger AI analysis (async)
5. Return outfit check ID

Use environment variables for:
- DATABASE_URL
- JWT_SECRET
- OPENAI_API_KEY
- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY
- AWS_S3_BUCKET
```

### Step 5: AI Feedback Service

**Prompt for Claude Code:**
```
Create the AI feedback service that analyzes outfit images using OpenAI GPT-4 Vision.

File: /src/services/ai-feedback.service.ts

The service should:

1. Accept: imageUrl, occasion, setting?, weather?, vibe?, concerns?

2. Construct a prompt that asks GPT-4 Vision to analyze the outfit and return structured JSON:
{
  "overallScore": 8,
  "summary": "One sentence verdict",
  "whatsWorking": [
    { "point": "The color palette is cohesive", "detail": "Navy and cream is a classic combination" }
  ],
  "consider": [
    { "point": "Hem length for sitting", "detail": "May be challenging at your event" }
  ],
  "quickFixes": [
    { "suggestion": "Cuff the sleeves once", "impact": "Creates a more relaxed vibe" }
  ],
  "occasionMatch": {
    "score": 9,
    "notes": "Perfect for a work setting"
  }
}

3. Use this system prompt for the AI:
"""
You are a friendly, supportive personal stylist providing outfit feedback. 

Guidelines:
- Be constructive and encouraging, never harsh or judgmental
- Be specific ("the blue flatters your coloring") not vague ("looks nice")
- Give actionable suggestions ("try adding a belt") not just opinions
- Consider the stated occasion when evaluating appropriateness
- If the user mentioned specific concerns, address them directly
- Vary your language to feel natural, not robotic
- Score realistically (most outfits 6-8, reserve 9-10 for exceptional)

Always respond with valid JSON matching the specified structure.
"""

4. Handle errors gracefully - if AI fails, return a generic positive response with a note

5. Store the response in the database and mark outfit_check as processed

Include retry logic (3 attempts with exponential backoff) for API failures.
```

### Step 6: Feedback Display Screen

**Prompt for Claude Code:**
```
Create FeedbackScreen to display AI outfit feedback beautifully.

Layout:
1. Top: Outfit image (tappable to view full screen)
2. Overall Score: Large number with star rating (e.g., "8/10 ⭐")
3. Summary: One-line verdict in larger text
4. Sections (collapsible):
   - ✅ What's Working (green accent)
   - ⚠️ Consider (yellow accent)
   - 💡 Quick Fixes (blue accent)
5. Occasion Match indicator (if scored high, show checkmark)
6. Bottom actions:
   - "Ask a Follow-up" button
   - "Save to Favorites" button
   - "New Check" button

Also include:
- Pull-to-refresh to reload feedback
- Loading skeleton while fetching
- Error state with retry button
- Haptic feedback on save

After viewing, prompt user to rate helpfulness:
"Was this helpful?" with thumbs up/down

Style: Clean white background, generous spacing, subtle shadows on cards.
```

### Step 7: Follow-up Conversation

**Prompt for Claude Code:**
```
Add follow-up question capability to FeedbackScreen.

When user taps "Ask a Follow-up":
1. Show a modal/bottom sheet with:
   - Previous feedback context (summary)
   - Text input for question
   - Suggested questions as chips:
     - "What shoes would work better?"
     - "How can I dress this up?"
     - "What accessories should I add?"
   - Send button

2. On submit:
   - Show typing indicator
   - Call API with question + original outfit context
   - Display response in chat-bubble style
   - Allow up to 3 follow-ups (show count remaining)

3. For free tier, show upgrade prompt after 3 follow-ups

The AI follow-up should have context of the original feedback to give coherent answers.
```

### Step 8: User History & Favorites

**Prompt for Claude Code:**
```
Create HistoryScreen showing user's past outfit checks.

Features:
1. Grid view of outfit thumbnails (2 columns)
2. Each item shows:
   - Outfit image
   - Score badge in corner
   - Favorite heart icon if favorited
   - Occasion tag
3. Filter tabs: All, Favorites, By Occasion
4. Tap to view full feedback (navigate to FeedbackScreen)
5. Long press for options: Delete, Share
6. Empty state with prompt to do first check

Include:
- Infinite scroll pagination
- Pull to refresh
- Skeleton loading state

Also create a simple search that filters by occasion or date range.
```

### Step 9: Authentication Flow

**Prompt for Claude Code:**
```
Implement authentication for FitCheck using Clerk (or Supabase Auth).

Screens needed:
1. SplashScreen - Check auth state, route accordingly
2. OnboardingScreen - 3 slides explaining the app
3. AuthScreen - Email + Social login options (Google, Apple)

Flow:
1. App opens → SplashScreen checks for stored token
2. If no token → show OnboardingScreen (once) → AuthScreen
3. If token → validate → HomeScreen
4. If token expired → refresh or re-auth

Store auth token securely using expo-secure-store.

Implement AuthContext/hook that provides:
- user object
- isAuthenticated boolean
- login/logout functions
- loading state
```

### Step 10: State Management & API Layer

**Prompt for Claude Code:**
```
Set up global state management and API integration.

1. Create Zustand store (/src/store/):
   - userStore: user data, preferences, subscription tier
   - outfitStore: current outfit check in progress
   - uiStore: loading states, modals, etc.

2. Create API service layer (/src/services/api.ts):
   - Axios instance with base URL and auth interceptor
   - Request/response typing
   - Error handling that surfaces user-friendly messages

3. Create React Query hooks (/src/hooks/):
   - useOutfitCheck: mutation for submitting outfit
   - useOutfitFeedback: query for fetching feedback
   - useOutfitHistory: infinite query for history
   - useUser: query for user profile
   - useFollowUp: mutation for follow-up questions

4. Handle offline state gracefully:
   - Queue submissions when offline
   - Show cached history
   - Indicate sync status
```

---

## Environment Setup

### Required Environment Variables

**Backend (.env):**
```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/fitcheck

# Auth
JWT_SECRET=your-super-secret-key-min-32-chars
JWT_EXPIRES_IN=7d

# OpenAI
OPENAI_API_KEY=sk-...

# AWS S3
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=fitcheck-images
AWS_REGION=us-east-1

# App
NODE_ENV=development
PORT=3000
CORS_ORIGIN=*
```

**Mobile App (.env):**
```env
API_URL=http://localhost:3000/api
```

---

## AI Prompt Templates

### Main Feedback Prompt

```typescript
const systemPrompt = `You are a friendly, supportive personal stylist providing outfit feedback to help people feel confident.

PERSONALITY:
- Warm and encouraging, like a supportive best friend
- Honest but tactful - find positives even when suggesting changes
- Specific and actionable in your advice
- Never judgmental about body types or personal style choices

ANALYSIS APPROACH:
1. First, identify what IS working - always lead with positives
2. Consider the stated occasion and evaluate appropriateness
3. Look at color coordination, fit, proportions, and style cohesion
4. Address any specific concerns the user mentioned
5. Offer 1-2 quick, actionable improvements

RESPONSE FORMAT:
Return ONLY valid JSON matching this exact structure:
{
  "overallScore": <number 1-10>,
  "summary": "<one encouraging sentence about the overall look>",
  "whatsWorking": [
    {"point": "<what works>", "detail": "<why it works>"}
  ],
  "consider": [
    {"point": "<what to consider>", "detail": "<why and how to address>"}
  ],
  "quickFixes": [
    {"suggestion": "<specific action>", "impact": "<what it improves>"}
  ],
  "occasionMatch": {
    "score": <number 1-10>,
    "notes": "<how well it fits the occasion>"
  }
}

SCORING GUIDE:
- 1-4: Significant issues (rare - be constructive)
- 5-6: Works but has clear room for improvement
- 7-8: Good outfit, minor tweaks possible (most outfits)
- 9-10: Excellent, well-executed (reserve for standouts)`;

const userPrompt = `Analyze this outfit photo.

Context provided by user:
- Occasion: ${occasion}
${setting ? `- Setting: ${setting}` : ''}
${weather ? `- Weather: ${weather}` : ''}
${vibe ? `- Desired vibe: ${vibe}` : ''}
${concerns ? `- User's concerns: ${concerns}` : ''}

Provide your analysis as JSON.`;
```

### Follow-up Prompt

```typescript
const followUpSystemPrompt = `You are continuing a conversation about an outfit you previously analyzed.

Previous analysis summary: ${previousSummary}
Score given: ${previousScore}/10

The user has a follow-up question. Answer helpfully and specifically, keeping your warm, supportive tone. If they ask for product recommendations, suggest general categories/styles rather than specific brands (unless they ask).

Keep responses concise (2-4 sentences) but helpful.`;
```

---

## Deployment Checklist

### Before Launch:
- [ ] Database migrations run
- [ ] Environment variables set in production
- [ ] API rate limiting configured
- [ ] Error tracking set up (Sentry recommended)
- [ ] Analytics integrated (Mixpanel/Amplitude)
- [ ] S3 bucket configured with proper permissions
- [ ] SSL certificates configured
- [ ] App Store / Play Store accounts ready

### Mobile App:
- [ ] App icons and splash screen
- [ ] Privacy policy and terms of service URLs
- [ ] App Store screenshots and description
- [ ] TestFlight / Internal testing track ready

---

## Testing Approach

### Key Flows to Test:
1. New user signup → first outfit check → receive feedback
2. Free user hits daily limit → sees upgrade prompt
3. Submit outfit with poor lighting → gets warning
4. Follow-up conversation maintains context
5. Offline submission → syncs when online
6. AI API failure → graceful fallback

### Sample Test Cases:
```typescript
describe('Outfit Check', () => {
  it('should enforce daily limit for free users', async () => {
    // Create free user
    // Submit 3 outfit checks
    // 4th should return 429 with upgrade message
  });

  it('should process feedback within 10 seconds', async () => {
    const start = Date.now();
    const result = await submitOutfitCheck(testImage, 'casual');
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(10000);
    expect(result.feedback).toBeDefined();
  });
});
```

---

## Quick Start Commands

```bash
# Clone and setup backend
git clone <repo>
cd fitcheck-api
npm install
cp .env.example .env
# Edit .env with your values
npx prisma migrate dev
npm run dev

# In another terminal, setup mobile app
cd fitcheck-app
npm install
cp .env.example .env
npx expo start

# Run on iOS simulator
npx expo run:ios

# Run on Android emulator  
npx expo run:android
```

---

## Next Steps After MVP

1. **Analytics Deep Dive:** Track which occasions get most checks, common concerns, feedback ratings
2. **A/B Test Prompts:** Experiment with AI prompt variations to improve helpfulness ratings
3. **Community Phase:** Add peer feedback queue when you hit 1,000 DAU
4. **Notification Strategy:** "How'd that outfit go?" follow-up, streak reminders
5. **Partnerships:** Reach out to fashion schools for expert stylist recruitment

---

*End of Technical Specification*
