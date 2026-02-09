# FitCheck - AI-Powered Outfit Feedback App

**Get instant, personalized outfit feedback from AI.** Capture your outfit, receive styling advice, and build confidence in your fashion choices.

![Status](https://img.shields.io/badge/status-MVP%20Complete-success)
![Platform](https://img.shields.io/badge/platform-iOS%20%7C%20Android-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 🎯 What is FitCheck?

FitCheck is a mobile app that uses AI to provide instant outfit feedback. Simply:

1. **Snap a photo** of your outfit
2. **Add context** (occasion, weather, vibe)
3. **Get AI feedback** in seconds with actionable styling tips
4. **Ask follow-up questions** for personalized advice

Perfect for those "does this work?" moments before heading out!

---

## ✨ Features

- 🤖 **AI-Powered Analysis** - GPT-4 Vision analyzes fit, color, proportions, and occasion appropriateness
- 💬 **Follow-up Conversations** - Ask questions like "what shoes should I wear?"
- 📊 **Outfit Scoring** - Get scores (1-10) with specific feedback
- 📱 **History & Favorites** - Save your best looks for reference
- 🎨 **Beautiful UI** - Dark theme with smooth animations
- 🆓 **Free Tier** - 3 outfit checks per day, 3 follow-ups per outfit

---

## 🚀 Quick Start

### For Development

**Prerequisites:**
- Node.js 18+
- PostgreSQL (or Docker)
- OpenAI API key

**Setup (5 minutes):**

```bash
# 1. Clone the repo
git clone https://github.com/Bradavis2011/FitCheck.git
cd FitCheck

# 2. Run setup script
# Windows:
setup.bat

# Mac/Linux:
chmod +x setup.sh
./setup.sh

# 3. Add your OpenAI API key
# Edit fitcheck-api/.env and add:
# OPENAI_API_KEY=sk-your-key-here

# 4. Start backend
cd fitcheck-api
npm run dev

# 5. In a new terminal, start frontend
cd fitcheck-app
npm start
```

See **[QUICKSTART.md](./QUICKSTART.md)** for detailed instructions.

### For Testing UI Only

```bash
cd fitcheck-app
npm install
npm start
```

The app works with **mock data** when the backend isn't running!

---

## 📁 Project Structure

```
FitCheck/
├── fitcheck-app/          # React Native mobile app (Expo)
│   ├── app/              # Screens (Expo Router)
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── hooks/        # React Query hooks
│   │   ├── services/     # API integration
│   │   └── stores/       # State management (Zustand)
│   └── API_INTEGRATION.md
│
├── fitcheck-api/          # Node.js backend (Express)
│   ├── src/
│   │   ├── controllers/  # Request handlers
│   │   ├── services/     # Business logic (AI, etc.)
│   │   ├── middleware/   # Auth, rate limiting
│   │   └── routes/       # API endpoints
│   ├── prisma/
│   │   └── schema.prisma # Database schema
│   └── README.md
│
├── QUICKSTART.md          # Setup guide
├── PROJECT_STATUS.md      # Deployment guide
├── TECHNICAL_SPEC.md      # Architecture docs
└── PRD.md                # Product requirements
```

---

## 🛠️ Tech Stack

### Frontend
- **React Native** + **Expo** - Cross-platform mobile
- **Expo Router** - File-based navigation
- **React Query** - Server state management
- **Zustand** - Client state management
- **Clerk** - Authentication
- **Axios** - HTTP client

### Backend
- **Node.js** + **Express** - REST API
- **TypeScript** - Type safety
- **Prisma** - Database ORM
- **PostgreSQL** - Primary database
- **OpenAI GPT-4 Vision** - AI outfit analysis
- **JWT** - Authentication

---

## 📖 Documentation

- **[QUICKSTART.md](./QUICKSTART.md)** - Get started in 5 minutes
- **[PROJECT_STATUS.md](./PROJECT_STATUS.md)** - Complete deployment guide
- **[TECHNICAL_SPEC.md](./TECHNICAL_SPEC.md)** - Architecture & implementation details
- **[PRD.md](./PRD.md)** - Product requirements & vision
- **[fitcheck-api/README.md](./fitcheck-api/README.md)** - Backend API docs
- **[fitcheck-app/API_INTEGRATION.md](./fitcheck-app/API_INTEGRATION.md)** - Frontend integration guide

---

## 🎨 Screenshots

_Coming soon - app is ready for screenshots!_

---

## 🚢 Deployment

See **[PROJECT_STATUS.md](./PROJECT_STATUS.md)** for complete deployment instructions.

### Quick Deploy Checklist

**Backend:**
- [ ] Set up PostgreSQL (Supabase/Neon)
- [ ] Deploy to Vercel or Railway
- [ ] Add environment variables
- [ ] Test API endpoints

**Frontend:**
- [ ] Configure S3/R2 image storage
- [ ] Build with EAS: `eas build`
- [ ] Submit to App Store / Play Store

**Optional:**
- [ ] Set up error tracking (Sentry)
- [ ] Add analytics (Mixpanel)
- [ ] Configure push notifications

---

## 🔑 Environment Variables

### Backend (`fitcheck-api/.env`)

```env
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
OPENAI_API_KEY=sk-...
NODE_ENV=production
CORS_ORIGIN=https://your-domain.com
```

### Frontend (`fitcheck-app/.env`)

```env
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
EXPO_PUBLIC_API_URL=https://your-api-domain.com
```

---

## 📊 API Endpoints

**Authentication:**
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login

**Outfit Checks:**
- `POST /api/outfits/check` - Submit outfit for feedback
- `GET /api/outfits/:id` - Get outfit with feedback
- `GET /api/outfits` - List user's outfits
- `POST /api/outfits/:id/followup` - Ask follow-up question

**User:**
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update profile
- `GET /api/user/stats` - Get usage stats

See **[TECHNICAL_SPEC.md](./TECHNICAL_SPEC.md)** for complete API documentation.

---

## 🧪 Testing

```bash
# Backend
cd fitcheck-api
npm run dev
# Test: curl http://localhost:3000/health

# Frontend
cd fitcheck-app
npm start
# Press 'i' for iOS or 'a' for Android
```

---

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

MIT License - see LICENSE file for details

---

## 🙏 Acknowledgments

- OpenAI for GPT-4 Vision API
- Expo team for amazing tooling
- Clerk for authentication
- All open source contributors

---

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/Bradavis2011/FitCheck/issues)
- **Discussions:** [GitHub Discussions](https://github.com/Bradavis2011/FitCheck/discussions)

---

## 🗺️ Roadmap

**Phase 1 (MVP - ✅ Complete):**
- ✅ AI outfit feedback
- ✅ Follow-up conversations
- ✅ History & favorites
- ✅ Free tier (3 checks/day)

**Phase 2 (Coming Soon):**
- [ ] Subscription tiers (Plus/Pro)
- [ ] Social features & community feedback
- [ ] Style preferences & personalization
- [ ] Outfit recommendations

**Phase 3 (Future):**
- [ ] Stylist marketplace
- [ ] Virtual wardrobe management
- [ ] Shopping integration
- [ ] Trend analysis

---

**Built with ❤️ by Brandon**

**Ready to launch!** 🚀
