# Or This? — Launch Status
*Last updated: February 20, 2026*

---

## Infrastructure

| Component | Status | URL / Notes |
|-----------|--------|-------------|
| Backend API | ✅ Live | `https://fitcheck-production-0f92.up.railway.app` |
| Database | ✅ PostgreSQL on Railway | All migrations applied |
| Landing page | ✅ Live | `https://orthis.app` + `https://www.orthis.app` |
| Custom domain | ✅ Live | Cloudflare DNS → Vercel (CNAME, proxy OFF) |
| Waitlist API | ✅ Live | `POST /api/waitlist` returning positions + referral codes |
| Android app | ✅ EAS build done | Play Store closed testing draft ready |
| iOS app | ❌ Not submitted | App Store submission not started |
| Image storage | ✅ Cloudflare R2 | `pub-f3e1b7bd22ed4ab8977df01fc1a06464.r2.dev` |
| OG image | ✅ Live | Auto-generated branded preview at /opengraph-image |

---

## Waitlist system

- **Table**: `waitlist_entries` (email, referralCode, position, referredBy)
- **API**: `POST /api/waitlist` + `GET /api/waitlist/status?email=`
- **Mechanic**: Every referral bumps referrer up 5 spots
- **Welcome email**: Sent via Resend on signup
- **Landing page**: orthis.app → email form → referral share card (WhatsApp + Twitter)
- **Env**: `APP_URL=https://orthis.app`, `CORS_ORIGIN=https://orthis.app,https://www.orthis.app,...`

---

## Backend agents running (Railway, ENABLE_CRON=true)

| Agent | Schedule |
|-------|----------|
| Lifecycle Email (welcome/onboarding/re-engagement) | Every 30 min |
| Safety Monitor (auto-hide reported content) | Hourly |
| Growth Dashboard (funnel, DAU/WAU email) | Daily 9am UTC |
| Viral Monitor (sharing %, coefficient) | Fri 9am UTC |
| AI Quality Monitor (fallback rate, ratings) | Daily 1:30pm UTC |
| Content Calendar (5 social post drafts/week) | Mon 8am UTC |
| Conversion Intelligence (upgrade signals) | Daily 11am UTC |
| Community Manager | Daily + Weekly |
| Nudger (push re-engagement) | 2pm + 10pm UTC |
| Founder Brief (state of business email) | Sun 8pm UTC |

---

## What you need to do (no code)

### This week
1. **TikTok**: Create @orthisapp — 1-2 videos/day, stay authentic
   - Topics: "I wore what AI told me to for a week", reaction to AI judging bad outfits, daily outfit checks
   - TikTok Creative Center → search "outfit check" "OOTD" to see what's trending
   - Bio: `Stop texting friends 'does this look ok?' ✨ AI outfit feedback before you walk out the door / OrThis.app`
2. **Instagram**: Create @orthisapp — daily Stories, A/B outfit polls
3. **Play Store**: Promote closed testing → open testing (Google review takes 1-7 days)
4. **iOS**: Submit to App Store (need Apple Developer account, screenshots, review takes 1-7 days)

### Week 2-3 (pre-launch)
5. **DM 20-30 fashion nano-creators** (1K-10K followers) — outreach agent generates drafts, check `/api/admin/agents`
6. **Reddit**: Genuinely participate in r/femalefashionadvice, r/malefashionadvice — NO app mentions yet, build karma first
7. **Campus seeding**: Find fashion club presidents at 3-5 schools

### Launch day
8. Email entire waitlist with Play Store / App Store links
9. Product Hunt launch (still relevant — good for SEO backlinks)
10. Post in r/SideProject + r/shamelessplug

---

## Railway env vars (production)

```
DATABASE_URL          postgresql://...@nozomi.proxy.rlwy.net:40138/railway
CLERK_SECRET_KEY      sk_live_...
CLERK_PUBLISHABLE_KEY pk_live_...
CLERK_WEBHOOK_SECRET  whsec_...
GEMINI_API_KEY        AIzaSy...
RESEND_API_KEY        re_V1u...
REPORT_RECIPIENT_EMAIL bradavis2011@gmail.com
REPORT_FROM_EMAIL     reports@orthis.app
ENABLE_CRON           true
SENTRY_DSN            https://900c9a...sentry.io/...
POSTHOG_API_KEY       phc_X4Ab...
REVENUECAT_API_KEY    sk_zYeY...
ADMIN_DASHBOARD_TOKEN BgiSF3...
CORS_ORIGIN           https://orthis.app,https://www.orthis.app,https://fit-check-2dcc03t1r-common-souls-projects.vercel.app
APP_URL               https://orthis.app
```

---

## Costs

- Railway: ~$20/mo
- Everything else (Cloudflare R2, Resend, Gemini, Clerk, Sentry, PostHog): free tier
- Total burn: ~$20/mo until ~1,000 paid users

---

## Git

- Repo: `https://github.com/Bradavis2011/FitCheck`
- Local branch: `master` → push with `git push origin master:main`
- Railway direct deploy: `railway up` from `fitcheck-api/`

---

## Key files

| File | Purpose |
|------|---------|
| `fitcheck-api/src/server.ts` | All routes |
| `fitcheck-api/src/services/scheduler.service.ts` | All cron jobs |
| `fitcheck-api/src/services/ai-feedback.service.ts` | Core AI logic |
| `fitcheck-api/prisma/schema.prisma` | DB schema |
| `fitcheck-app/app/feedback.tsx` | Feedback screen |
| `fitcheck-app/app/(tabs)/` | Tab screens |
| `orthis-web/app/page.tsx` | Waitlist landing page |
| `orthis-web/app/api/waitlist/route.ts` | Next.js proxy → Railway API |
| `orthis-web/app/opengraph-image.tsx` | Auto-generated OG/Twitter preview image |
