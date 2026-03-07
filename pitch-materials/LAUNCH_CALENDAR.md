# Or This? — Launch Calendar (Revised March 2026)

Parallel-track strategy. Real customers and bug testers run simultaneously.
One shot at Product Hunt — wait until AI verdict quality is confirmed solid.

**Positioning in all launch copy:** "First agentic platform for fashion" — not "AI outfit feedback app". Verdicts, not checks. Archive, not history. GET VERDICT, not CHECK MY OUTFIT.

---

## Strategy Overview

| Track | Goal | Platforms | Start |
|-------|------|-----------|-------|
| **A — Real Customers** | People who actually have the problem | TikTok nano-creators, fashion Discord | Today |
| **B — Bug Testers** | Stress-test AI quality, generate social proof | Beta listing sites, tech/maker subreddits | Today |
| **C — Big Launch** | Press, backlinks, investor visibility | Product Hunt, Hacker News | March 16+ only |

**Why this order**: Tech platforms (PH, HN) won't deliver users who retain — they're QA testers and credibility plays. Real customers live on TikTok and fashion communities. Fix bugs with Track B feedback before Track C.

---

## TODAY — March 3

### Track A: Real Customers
- [ ] Search TikTok: `#outfitcheck` `#ootd` `#whattowear` — find 5–10 nano-creators (1K–10K followers)
  - Send the DM template from LAUNCH_SUBMISSIONS.md (Tier 4, "TikTok Creator DM")
  - One honest line, TestFlight link, no pitch
- [ ] Join 2–3 fashion Discord servers (search Discord for "fashion", "OOTD", "streetwear")
  - Lurk first. Introduce yourself with the template from LAUNCH_SUBMISSIONS.md (Tier 3, Discord)
  - Don't post the app link until you're welcomed in

### Track B: Bug Testers
- [ ] Submit to **BetaList** — https://betalist.com/submit (10 min, copy in LAUNCH_SUBMISSIONS.md)
- [ ] Submit to **BetaBound** — https://www.betabound.com/announce (copy in LAUNCH_SUBMISSIONS.md)
- [ ] Submit to **BetaPage** — https://betapage.co (copy in LAUNCH_SUBMISSIONS.md)

---

## TOMORROW — March 4

### Track B
- [ ] Post to **r/TestMyApp** — use Tier 2 copy from LAUNCH_SUBMISSIONS.md
- [ ] Post to **r/alphaandbetausers** — use Tier 2 copy from LAUNCH_SUBMISSIONS.md

---

## THIS WEEK — March 3–7

### Track A
- [ ] If any TikTok creators respond: ask if they'd do a 15s screen recording
  - Script in LAUNCH_SUBMISSIONS.md, Tier 4. Offer only early access, no payment.
- [ ] Continue engaging in fashion Discord servers you joined on Day 1

### Track B
- [ ] Post to **r/SideProject** — use Tier 2 copy from LAUNCH_SUBMISSIONS.md

---

## SIGNALS TO WATCH — During Tracks A + B

**Track A success**:
- A TikTok creator posts organically (without being asked)
- Someone in a fashion Discord DMs asking for the TestFlight link

**Track B success**:
- Beta testers report specific AI quality issues (not crashes) → AI is working, tune quality
- Crashes or auth issues → fix before Track C

**Red flag (hold Track C)**:
- Track A users try it once and never come back → AI feedback quality isn't good enough yet
- Do not launch on Product Hunt until the red flag is resolved

---

## MARCH 16+ — Track C (only if AI quality confirmed solid)

**Pre-launch (2 days before)**:
- [ ] Tell 20 people personally (text, not mass email): "I'm launching on Product Hunt [date], would mean a lot if you upvote first thing in the morning"
- [ ] Post a teaser on personal social accounts
- [ ] Prepare all Product Hunt assets (screenshots, description, GIF if possible)

**Launch day (pick Tuesday or Wednesday, 12:01am PT)**:
- [ ] Submit to **Product Hunt** — use Tier 1 copy from LAUNCH_SUBMISSIONS.md (updated for agentic framing)
- [ ] Post **Show HN** on Hacker News — 7–9am ET — use Tier 1 copy from LAUNCH_SUBMISSIONS.md (updated for agentic framing)
- [ ] Respond to every comment on both platforms within the hour
- [ ] Share on LinkedIn (personal post, not company page)
- [ ] Ask 10 more people to upvote on PH throughout the day

**Expected result**: 200–1000+ Product Hunt visitors, 50–500 installs depending on placement

---

## ONGOING — After First Users Are In

**Every week**:
- Check Monday 8am email (Content Calendar agent) → post 3–5 of the drafted social posts manually
- Check Wednesday email (Outreach Agent) → send 2–3 DMs to nano-creators from the draft list
- Review any new app store reviews → approve agent-drafted replies in admin panel

**Month 2 trigger (100 active users)**:
- Activate beta recruiter agent: set `ENABLE_BETA_RECRUITER=true` on Railway
- Start collecting testimonials for Product Hunt testimonials section
- Begin press outreach using the press email template from Outreach Agent

**Month 3 trigger (500 users)**:
- Test paid Twitter/X promotion ($50 on one high-performing tweet)
- Reach out to micro-influencers (10K–100K) — separate list from nano-creators

---

## Key Metrics

| Metric | Where to check | Target |
|--------|----------------|--------|
| TestFlight installs | App Store Connect | 50+ by end of week 1 |
| Track A engagement | Reddit DMs / Discord replies | 1 organic creator post |
| AI quality reports | PostHog / beta tester feedback | Specific issues, not crashes |
| Daily active users | PostHog | Growing week-over-week |
| Outfit checks/day | Railway DB / Growth Dashboard email | 10+ by Week 3 |

---

## What NOT to Do

- Don't launch on Product Hunt before AI quality is validated by real users
- Don't spam Reddit — one post per subreddit, value-first, never promotional
- Don't DM random users (non-creators) on TikTok — ignore rate near 100%
- Don't pay for ads before you have reviews and testimonials
- Don't launch all tracks on the same day — you need energy to respond to every comment
