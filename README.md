# FitCheck API Server

Backend API for the FitCheck outfit feedback app.

## Features

- 🤖 AI-powered outfit analysis using GPT-4 Vision
- 👤 User authentication with JWT
- 📊 PostgreSQL database with Prisma ORM
- 🔒 Rate limiting and security middleware
- 💬 Follow-up conversation support
- ⭐ Favorites and history tracking

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL database
- OpenAI API key

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your credentials:
   - `DATABASE_URL` - PostgreSQL connection string
   - `JWT_SECRET` - Random 32+ character string
   - `OPENAI_API_KEY` - Your OpenAI API key

3. **Setup database:**
   ```bash
   npm run db:push
   npm run db:generate
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

The API will be running at `http://localhost:3000`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/clerk-webhook` - Clerk webhook sync

### Outfit Checks
- `POST /api/outfits/check` - Submit outfit for AI feedback
- `GET /api/outfits` - List user's outfit checks
- `GET /api/outfits/:id` - Get specific outfit with feedback
- `POST /api/outfits/:id/followup` - Ask follow-up question
- `PUT /api/outfits/:id/rate` - Rate feedback helpfulness
- `PUT /api/outfits/:id/favorite` - Toggle favorite
- `DELETE /api/outfits/:id` - Soft delete outfit check

### User
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update profile/preferences
- `GET /api/user/stats` - Get usage stats

## Database Schema

See `prisma/schema.prisma` for the complete data model.

Key tables:
- `users` - User accounts and preferences
- `outfit_checks` - Submitted outfits with AI feedback
- `follow_ups` - Follow-up Q&A conversations
- `user_stats` - Gamification and usage tracking

## Development

```bash
# Run in development mode with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start

# View database in Prisma Studio
npm run db:studio
```

## Tier Limits

### Free Tier
- 3 outfit checks per day
- 3 follow-up questions per outfit

### Plus/Pro Tiers
- Unlimited checks and follow-ups

## Environment Variables

See `.env.example` for all available options.

Required:
- `DATABASE_URL`
- `JWT_SECRET`
- `OPENAI_API_KEY`

Optional:
- `PORT` (default: 3000)
- `NODE_ENV` (default: development)
- `CORS_ORIGIN` (default: *)
