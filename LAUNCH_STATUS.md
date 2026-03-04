# Or This? — Launch Status
*Last updated: March 3, 2026*

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
| iOS app | ✅ TestFlight live | https://testflight.apple.com/join/2fXVAyvd — App Store submission pending |
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

### TODAY — March 3 (parallel tracks)

**Track A — Real Customers**:
1. **TikTok DMs**: Search #outfitcheck #ootd — find 5–10 nano-creators (1K-10K followers), send the brief DM template (LAUNCH_SUBMISSIONS.md, Tier 4 "TikTok Creator DM")
2. **Fashion Discord**: Join 2–3 servers, lurk first, introduce yourself genuinely

**Track B — Bug Testers**:
3. Submit to **BetaList** — https://betalist.com/submit
4. Submit to **BetaBound** — https://www.betabound.com/announce
5. Submit to **BetaPage** — https://betapage.co

### This week (parallel tracks continue)
6. Post to **r/TestMyApp** + **r/alphaandbetausers** (Track B — Tier 2 copy ready)
7. Continue engaging in fashion Discord servers (Track A)
8. Post to **r/SideProject** (Track B)

### March 16+ (only after AI quality validated by real users)
9. **Product Hunt** — Tuesday/Wednesday 12:01am PT (Tier 1 copy ready)
10. **Show HN** on Hacker News — same day or next day (Tier 1 copy ready)
11. Email waitlist with App Store link (need App Store approval first)

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
