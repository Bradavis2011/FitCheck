# API Integration Guide

This document explains how to connect the FitCheck app to the backend API.

## Current Status

✅ **Complete:**
- API service layer (`src/services/api.service.ts`)
- React Query hooks (`src/hooks/useApi.ts`)
- Follow-up modal using real API
- Mock data fallback for testing

⏳ **Pending:**
- Image upload to cloud storage
- Full API integration in all screens
- Error boundary and offline handling
- Backend deployment

## Setup Instructions

### 1. Backend Setup

First, set up and run the backend API:

```bash
cd fitcheck-api

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env and add:
# - DATABASE_URL (PostgreSQL connection string)
# - JWT_SECRET (random 32+ character string)
# - OPENAI_API_KEY (from OpenAI dashboard)

# Set up database
npm run db:push
npm run db:generate

# Start the server
npm run dev
```

The API will be running at `http://localhost:3000`

### 2. Mobile App Configuration

Update the `.env` file in `fitcheck-app/`:

```bash
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
EXPO_PUBLIC_API_URL=http://localhost:3000
```

**Important:**
- For iOS simulator: use `http://localhost:3000`
- For Android emulator: use `http://10.0.2.2:3000`
- For physical device: use your computer's IP address (e.g., `http://192.168.1.100:3000`)

### 3. Image Upload Setup

The app needs cloud storage for outfit images. Two options:

#### Option A: AWS S3 (Recommended)
1. Create S3 bucket with public read access
2. Add credentials to backend `.env`:
   ```
   AWS_ACCESS_KEY_ID=AKIA...
   AWS_SECRET_ACCESS_KEY=...
   AWS_S3_BUCKET=fitcheck-images
   AWS_REGION=us-east-1
   ```
3. Implement presigned URL endpoint: `POST /api/upload/presigned`
4. Update `src/services/image-upload.service.ts` to use real S3 upload

#### Option B: Cloudflare R2 (Cheaper alternative)
1. Create R2 bucket
2. Generate API token
3. Follow similar setup as S3

### 4. Authentication Integration

The app uses Clerk for authentication. To connect it to the backend:

1. Get Clerk publishable key from [clerk.com](https://clerk.com)
2. Add to `.env`: `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...`
3. Set up Clerk webhook to sync users:
   - Webhook URL: `https://your-api.com/api/auth/clerk-webhook`
   - Events: `user.created`, `user.updated`
   - This syncs Clerk users to your PostgreSQL database

## Testing with Mock Data

The app is configured to work with mock data when:
- `outfitId` is not provided to components
- API calls fail (automatic fallback)
- Backend is not running

This allows you to develop and test the UI without a running backend.

## Integration Checklist

- [ ] Backend API running locally
- [ ] Database migrations applied
- [ ] OpenAI API key configured
- [ ] Mobile app `.env` configured with API URL
- [ ] Can create account / login
- [ ] Can submit outfit check
- [ ] Can receive AI feedback
- [ ] Can ask follow-up questions
- [ ] Can view history
- [ ] Can toggle favorites
- [ ] Image upload to S3/R2 working

## Next Steps for Production

### Backend
1. Deploy to Vercel or Railway
2. Set up production PostgreSQL (Supabase, Neon, etc.)
3. Configure environment variables in production
4. Set up error tracking (Sentry)
5. Configure CORS for production domain

### Mobile App
1. Update `EXPO_PUBLIC_API_URL` to production URL
2. Set up S3/R2 for image uploads
3. Build and submit to App Store / Play Store
4. Set up analytics (Mixpanel, Amplitude)
5. Configure push notifications (optional)

### Image Storage
1. Implement `POST /api/upload/presigned` endpoint
2. Update `uploadImage()` in `image-upload.service.ts`
3. Set up CDN for image delivery (CloudFlare)
4. Implement image optimization pipeline

## Common Issues

### "Network request failed"
- Check that backend is running
- Verify API URL in `.env`
- For Android emulator, use `10.0.2.2` instead of `localhost`

### "Daily limit reached"
- Free tier allows 3 checks per day
- Daily limit resets at midnight UTC
- Upgrade to Plus tier for unlimited checks

### Images not displaying
- Check S3 bucket CORS configuration
- Verify presigned URLs are working
- Check image URL format in database

## API Endpoints Reference

See `TECHNICAL_SPEC.md` for complete API documentation.

### Key Endpoints

```
POST /api/auth/register          - Create account
POST /api/auth/login             - Login
GET  /api/user/profile           - Get user profile
POST /api/outfits/check          - Submit outfit for feedback
GET  /api/outfits/:id            - Get outfit with feedback
POST /api/outfits/:id/followup   - Ask follow-up question
GET  /api/outfits                - List user's outfits
```

## Environment Variables

### Backend (fitcheck-api/.env)
```
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
OPENAI_API_KEY=sk-...
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=fitcheck-images
AWS_REGION=us-east-1
```

### Frontend (fitcheck-app/.env)
```
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
EXPO_PUBLIC_API_URL=http://localhost:3000
```
