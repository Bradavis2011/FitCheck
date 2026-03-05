# Y Combinator Spring 2026 Application — Or This?
### FINAL — Ready to Copy-Paste

> **Verified codebase metrics (March 2, 2026):** 121,743 lines of TypeScript (35K frontend + 86K backend) · 66 DB models · 136 API endpoints · 23 route domains · 31 app screens · 241 test files

---

## FOUNDERS SECTION

**Who writes code, or does other technical work on your product? Was any of it done by a non-founder?**

> I write all the code. The entire product — 121,000+ lines of TypeScript across a React Native mobile app and Node.js/Express backend — is my work. No non-founder engineering. I use Claude Code (Anthropic's AI coding assistant) extensively, which is how a solo founder ships at this velocity. Every architectural decision, every line of code, every deployment is mine.

---

**Are you looking for a cofounder?**

> Yes. I'd welcome a technical co-founder with consumer product or growth experience — the product is built, what I need now is someone obsessed with getting it into users' hands and iterating on the feedback loop. I'd also consider someone with fashion industry connections who can accelerate the B2B data play long-term.

---

**Founder name:** Brandon Davis

**Founder role:** Founder & CEO

**Email:** bradavis2011@gmail.com

**Phone:** (630) 301-9829

**LinkedIn:** linkedin.com/in/brandondavis

**Background:**
> Kellogg MBA (Northwestern). 8 years AI product management at Apple (Health Technologies), Verily/Alphabet (Project Baseline), and Komodo Health. Former signed model (Rae Agency) and SAG-AFTRA actor. Technical builder — ships production applications end-to-end.

**Equity:** 100%

---

## COMPANY SECTION

**Company name:** Or This?

**50-character description** *(49 chars — verified)*:
> `AI outfit feedback in 30 seconds before you leave`

**Company URL:** https://orthis.app

**Where do you live now, and where would the company be based after YC?**
> Chicago, IL / San Francisco, CA

**Explain your decision regarding location:**
> I'd relocate to SF for the batch and stay if it makes sense for hiring and investor proximity. Chicago has lower burn rate pre-revenue, but SF is where the talent and capital are for consumer AI.

---

**What is your company going to make?**

> Or This? gives women instant, honest outfit feedback at the moment they need it — standing in front of the mirror, about to leave. Snap a photo, say where you're going, get editorial-quality AI feedback in 30 seconds, then ask follow-ups like you would with a stylish friend.
>
> We own the moment of decision. Not inspiration. Not shopping. The 30 seconds before you walk out the door.
>
> The AI is fashion-specialized — not generic ChatGPT. It evaluates color harmony, proportions, fit, and occasion-appropriateness using a 3,000+ line prompt system with real fashion expertise baked in. Style DNA builds a personalized profile over time — feedback gets sharper the more you use it.
>
> Every outfit analyzed generates structured fashion data. At scale, this becomes a B2B fashion intelligence asset — what real people actually wear, to real occasions, scored and validated. Think WGSN ($100M+ ARR) but built on consumer behavior, not runway predictions.

---

## PROGRESS SECTION

**How far along are you?**

> Product is fully built and deployment-ready. Not a prototype — a production application.
>
> — 31 app screens covering the complete user journey (camera, context input, AI feedback, follow-up conversation, history, community, comparisons, wardrobe, profile, referrals, subscriptions, onboarding)
> — 136 API endpoints across 23 route domains
> — 66 database models in PostgreSQL via Prisma
> — Backend deployed on Railway, AI pipeline live with Gemini Vision
> — Monetization implemented (RevenueCat subscriptions: Free / $4.99 / $14.99, Google AdMob ads)
> — 241 test files with extensive coverage
> — Self-improving AI: automated critic agents that find and fix prompt weaknesses overnight
> — A system of autonomous backend agents handling content creation, growth monitoring, user engagement, app store management, and weekly founder briefings — one founder operating at the scale of a 10-person team
>
> What we haven't done: launched publicly. Zero users. The product is complete — every day without users is wasted.

---

**How long have each of you been working on this? How much of that has been full-time?**

> Started building in late 2025. Full-time since early 2026. About 4 months total, essentially all full-time. The speed is a function of AI-assisted development (Claude Code) and 8 years of product management experience — I knew exactly what to build before I wrote the first line.

---

**What tech stack are you using, or planning to use?**

> **Frontend:** Expo SDK 54, React Native, TypeScript, Clerk (auth), Zustand (state), React Query, RevenueCat (subscriptions), Google Mobile Ads, PostHog (analytics), Sentry (errors)
>
> **Backend:** Node.js, Express, TypeScript, PostgreSQL, Prisma ORM, Google Gemini Vision API (outfit analysis), AWS S3 (image storage), Resend (email), Socket.io (real-time)
>
> **AI:** Google Gemini 2.0 Flash (primary — outfit analysis, content generation, trend analysis) with 3,000+ lines of fashion-specialized prompt engineering. Automated critic/improvement pipeline that self-calibrates AI quality without a new release.
>
> **AI coding tools:** Claude Code (Anthropic) — used throughout development as a pair programming partner. This is how one person writes 121,000 lines of production TypeScript.
>
> **Infrastructure:** Railway (backend hosting), PostgreSQL (Railway-managed), AWS S3, GitHub Actions

---

**[EXPERIMENTAL] Coding agent session export**

> *(This field requires exporting a Claude Code session transcript — see "Coding Agent Session Export" section at the bottom of this document for instructions on what to export and how.)*

---

**Are people using your product?** → **No**

**Do you have revenue?** → **No**

**If applying with same idea as previous batch, did anything change?**
> First-time applicant.

**Incubator/accelerator participation?**
> None.

---

## IDEA SECTION

**Why did you pick this idea to work on? Do you have domain expertise in this area? How do you know people need what you're making?**

> I was a signed model with Rae Agency and a SAG-AFTRA actor. Getting dressed for shoots, auditions, and appearances was high-stakes — your appearance is literally your professional product. I know what it costs to dress wrong and how few honest, available feedback sources exist at the moment you need them.
>
> Then I spent 8 years managing AI products at Apple (Health Technologies), Verily/Alphabet (Project Baseline), and Komodo Health — $15M+ in product revenue across AI analytics for pharma, digital health trials, and consumer health programs.
>
> The intersection of "I lived this problem" and "I know how to build and ship AI products" is genuine. This isn't a founder who read a market research report. I'm building the product I needed.
>
> How I know people need it: 72% of women report outfit indecision causes daily stress. r/femalefashionadvice has 2M+ members asking strangers for outfit feedback. #OOTD and #fitcheck have billions of views on TikTok. The behavior already exists — it's just solved badly.

---

**Who are your competitors? What do you understand about your business that they don't?**

> **Direct competitors:** None own the moment of decision.
>
> — **Stitch Fix** — sends boxes in the mail. Days, not seconds. Shopping service, not feedback.
> — **ChatGPT/generic AI** — no fashion specialization. Generic responses. No Style DNA, no occasion context, no editorial voice.
> — **Pinterest/fashion apps** — inspiration and discovery, not feedback on what you're wearing right now.
> — **Human stylists** — $100–500/session, appointment-only, not available when you need them.
>
> **What I understand that they don't:**
>
> 1. The valuable moment is the DECISION, not the inspiration or the shopping. Nobody owns that 30-second window.
> 2. Fashion AI quality crossed the threshold in 2023–24 — this category literally couldn't exist before. First movers who build the dataset win.
> 3. The consumer app is a data collection engine. The real business at scale is fashion intelligence (B2B) — what real people actually wear. WGSN makes $100M+/yr on runway predictions. Actual consumer behavior data is fundamentally better.

---

**How do or will you make money? How much could you make?**

> **Near-term: Consumer subscriptions (freemium)**
>
> — Free: 3 AI checks/day with ads
> — Plus ($4.99/mo): Unlimited checks, no ads, community features
> — Pro ($14.99/mo): Expert reviews, style analytics, priority AI
>
> Cost per AI check: ~$0.003. Blended monthly cost per user: ~$0.50. AI costs dropping ~50% year-over-year — our margins improve automatically.
>
> **Long-term: B2B fashion intelligence licensing**
>
> Trend reports ($15–50K/quarter), real-time API ($5–20K/mo), white-label SDK ($10–50K/mo).
>
> Comparable: WGSN earns ~$100M+ ARR on fashion intelligence built from runway predictions.
>
> **How much:** Target $1M ARR at Month 18 from subscriptions alone. If the B2B data play works, the ceiling is $100M+ ARR — but that requires scale we don't have yet. The subscription business alone is venture-scale if we hit 2M paid users (Duolingo has 8M). The data business is upside.

---

**Which category?**

> Consumer *(or "AI" if that's a separate option — go Consumer; the AI is the technology, not the category)*

---

**Other ideas you considered:**

> The same core thesis — vision AI giving instant, domain-specific feedback — applied to other high-stakes visual decisions:
>
> 1. **Interview prep** — AI analyzing outfit, posture, and presentation before job interviews
> 2. **Real estate** — instant AI property assessment at showings (curb appeal, staging, renovation ROI)
> 3. **Medical second opinions** — leveraging 8 years at Apple Health and Verily, AI triage for visual symptoms
>
> Fashion was the right entry point: lowest regulatory risk, clearest consumer behavior signal (#fitcheck has billions of views), and the B2B data moat (WGSN comparable) doesn't exist in the other categories.

---

## EQUITY SECTION

**Have you formed ANY legal entity yet?** → **No**

*(YC says this is fine — "If we accept your application, we'll help you get visas and incorporate.")*

**Have you taken any investment yet?** → **No**

**Are you currently fundraising?** → **No**

*(YC is the funding plan, not a side bet while raising elsewhere.)*

---

## CURIOUS SECTION

**What convinced you to apply to Y Combinator?**

> Three things: (1) YC has cracked the consumer cold-start problem dozens of times — I need that expertise more than anything. (2) The YC brand compresses a 6-month fundraise into 6 weeks. (3) I want YC partners to pressure-test the B2B data platform thesis before I'm 18 months in. If the fashion intelligence play is wrong, I'd rather know now.

---

**How did you hear about Y Combinator?**

> Years of following the startup ecosystem. Paul Graham's essays shaped how I think about building products.

---

**Batch preference:** Spring 2026

---

## FOUNDER VIDEO SCRIPT (1 minute)

*Film in good lighting, plain background. Dress well — you're a former model, this is on-brand. Look at camera, not a script. Energy: confident but not manic.*

**0–5s:** "I'm Brandon Davis, founder of Or This?"

**5–20s:** "Every day, millions of women stand in front of the mirror asking 'does this work?' Their options are terrible. Friends are biased. Social media is too slow. Stylists cost hundreds."

**20–35s:** "Or This? gives you honest AI outfit feedback in 30 seconds. Snap a photo, tell us where you're going, get specific feedback, ask follow-ups. Like a stylish friend in your pocket."

**35–50s:** "I was a signed model — I lived this problem. I spent 8 years managing AI at Apple and Verily. And I built the entire product myself — 121,000 lines of code, one founder."

**50–60s:** "The product is built. I need YC to help me get it into users' hands and validate the data platform thesis. I'm ready."

---

## DEMO VIDEO STRATEGY (under 3 minutes)

*Record a screen capture of the REAL app. No slides. No mockups.*

1. **Cold open** — camera screen (5s)
2. **Take a photo** of an actual outfit (10s)
3. **Context input** — tap occasion, setting, weather, vibe (15s)
4. **AI analysis loading → results** — show score, What's Working, Consider, Quick Fixes (30s)
5. **Follow-up question** — type "Would different shoes help?" → AI responds conversationally (20s)
6. **History/Archive** — scroll through past checks (10s)
7. **Community features** — A/B comparison, community feed (15s)
8. **Wardrobe** — AI-built wardrobe from outfit checks (10s)
9. **Quick montage** — profile, referrals, upgrade (10s)
10. **End card** — "Or This? — built and ready to launch." (5s)

Total: ~2:10. Show the real product. Every second should demonstrate something.

---

## CODING AGENT SESSION EXPORT

YC added this experimental question for Spring 2026 — it's a major differentiator. You built the ENTIRE product with Claude Code.

**How to export:**
1. Open Claude Code in the terminal
2. Run `/export` to export the current session transcript as a .md file
3. Or review past sessions in `~/.claude/projects/`

**Which session to pick:**
Pick a transcript that shows a complex, multi-file feature being designed and built — architectural reasoning, not just code generation. Strong options:
- The self-improving AI pipeline (critic/surgeon agents that improve prompts automatically)
- The wardrobe sync system (normalize, dedup, upsert garments from AI feedback)
- The autonomous agent framework (executeOrQueue pattern, brand-guard, kill switch)
- The referral system (schema + backend + frontend + deep linking in one session)

**What to highlight in the submission:**
The session shows a solo founder designing a complex system, making architectural tradeoffs, and shipping production-grade code at a pace that would normally require a team. That's the story.

---

## PRODUCT LINK STRATEGY

YC asks for a product link. Options in order of ease:

1. **Google Play Internal Testing** — Create an internal testing track, add YC reviewers' email. Provide the link + note "email bradavis2011@gmail.com for access."
2. **Expo Preview Build** — Run `eas build --profile preview --platform android` to create an APK, share the install link. No app store review needed.
3. **Demo video** — If neither is feasible in time, the strong demo video is the fallback. YC provides a dedicated demo upload field.

**Recommended:** Google Play internal testing link + demo video (belt and suspenders).

---

## PRE-SUBMISSION CHECKLIST

- [ ] Complete founder profile on YC website ("Profile incomplete" warning)
- [ ] Record 1-minute founder video (see script above)
- [ ] Record demo video — screen capture of real app (see strategy above)
- [ ] Export a Claude Code session transcript via `/export` — pick a major feature build
- [ ] Set up Google Play internal testing link OR Expo preview build for product link
- [ ] Copy-paste answers from this file into the YC form
- [ ] Review once for honesty and tone — no inflated metrics, no vaporware
- [ ] Submit — don't overthink it, get it in

---

## VERIFIED NUMBERS (codebase audit, March 2, 2026)

| Metric | Value | Source |
|---|---|---|
| Lines of TypeScript (total) | 121,743 | wc -l on .ts/.tsx files |
| Lines — frontend (fitcheck-app) | 35,337 | wc -l |
| Lines — backend (fitcheck-api) | 86,406 | wc -l |
| Database models (Prisma) | 66 | schema.prisma model count |
| API endpoints | 136 | router.* calls in routes/ |
| Route domains | 23 | route files in routes/ |
| App screens | 31 | .tsx files in app/ |
| Test files | 241 | .test.ts + .spec.ts |

> **Note:** The existing draft (YC_Application.md) used earlier estimates (37 screens, 16 API domains, 54+ models). The numbers above are verified from the actual codebase as of March 2, 2026.

---

*Contact: Brandon Davis | bradavis2011@gmail.com | (630) 301-9829 | orthis.app*
