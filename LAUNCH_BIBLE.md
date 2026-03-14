# The Launch Bible
## A Practical Replication Guide for the Four Core Engines

**Derived from: Or This? (orthis.app)**
**Stack: Node.js + Express + TypeScript + PostgreSQL + Prisma + Gemini + Railway**
**Date: March 2026**

---

This document captures the architecture, lessons, and launch sequences for four self-sustaining engines built into the Or This? product. These engines are not features. They are the infrastructure layer that makes the product grow, improve, and operate autonomously after launch. Every section is written to be replicated in a new product from zero.

---

## Table of Contents

1. [How the Four Engines Interconnect](#interconnection)
2. [Engine 1: The Learning Engine](#learning-engine)
3. [Engine 2: The Content Engine](#content-engine)
4. [Engine 3: The SEO Engine](#seo-engine)
5. [Engine 4: The Agentic Framework](#agentic-framework)
6. [Correct Launch Order](#launch-order)
7. [Environment Variables Master Checklist](#env-checklist)
8. [Common Failure Modes and Fixes](#failure-modes)

---

## How the Four Engines Interconnect {#interconnection}

The four engines are not independent. They share data through a central persistent message bus (the Intelligence Bus). The data flows in one direction with feedback loops:

```
User Interaction
     |
     v
[Learning Engine]  ─── FQI metric, StyleDNA trends, prompt improvements
     |                       |
     | publishes to          | publishes trend_signal, discovered_knowledge
     v                       v
[Intelligence Bus] ◄────────────────────────────────────────
     |                                                       |
     | seo_opportunities, trend_signal, discovered_knowledge |
     v                                                       |
[SEO Engine] ──────────────────────────────────────────────►[Content Engine]
     |              keyword data drives article topics         |
     | publishes seo_metrics                                  | publishes seo_metrics
     v                                                        |
[Agentic Framework] ◄────────────────────────────────────────
     | routes all agent actions through brand guard
     | processes approved queue every 5 minutes
     | kill switch per agent, rate limits per agent
```

**The key dependency chain:**
- The Learning Engine feeds real user data (trends, occasions, what works) into the bus
- The SEO Engine reads `seo_opportunities` from the bus to pick topics — without user data it falls back to generic topics
- The Content Engine reads `trend_signal` from the bus to generate social posts grounded in actual user behavior
- The Agentic Framework wraps all agent actions — nothing publishes without passing through `executeOrQueue`

**Nothing works without the Agentic Framework** — it is the foundation all three other engines sit on top of. Build it first.

---

## Engine 1: The Learning Engine {#learning-engine}

### Core Insight

The AI prompt that analyses user submissions degrades over time relative to your user base's actual behavior. The Learning Engine continuously measures this degradation with a single scalar metric (FQI), diagnoses the causes, generates a better prompt candidate, A/B tests it, and auto-promotes winners. No human intervention is needed after initial setup.

The secondary function is token budget management: the free tier of Gemini is finite. Without a budget manager, autonomous agents will burn the entire daily budget on internal tasks and leave nothing for real users. The token budget system prevents this.

### Key Architecture

**Feedback Quality Index (FQI)** — the single north-star metric. Analogous to validation bits-per-byte in language model training. Range 0.0–1.0, higher is better.

```typescript
// From: fitcheck-api/src/services/recursive-improvement.service.ts
export function computeFQI(pv: {
  avgUserRating: number | null;
  helpfulPct: number | null;
  avgCommunityDelta: number | null;
}): number {
  const rating    = pv.avgUserRating     !== null ? pv.avgUserRating / 5                       : 0.60;
  const helpful   = pv.helpfulPct        !== null ? pv.helpfulPct                              : 0.50;
  const alignment = pv.avgCommunityDelta !== null ? Math.max(0, 1 - pv.avgCommunityDelta / 3) : 0.80;
  return rating * 0.45 + helpful * 0.35 + alignment * 0.20;
}

const FQI_KEEP_THRESHOLD   = 0.03; // candidate must beat control by this margin to be promoted
const FQI_REVERT_THRESHOLD = 0.05; // candidate must underperform by this to be killed early
```

**The six-step improvement cycle:**
1. MEASURE — aggregate user ratings, helpfulness votes, AI-vs-community score delta
2. DISCOVER — extract fashion rules from StyleDNA patterns (what combinations get high ratings)
3. DIAGNOSE — use Gemini to identify weaknesses in current prompt (low-performing occasions, calibration drift)
4. IMPROVE — generate an improved prompt candidate incorporating discovered rules
5. TEST — deploy candidate via A/B test (50% traffic split by user ID hash)
6. PROMOTE — auto-promote winner based on FQI delta; auto-revert losers

**Token Budget Manager** — priority-based gating for all learning system Gemini calls:

```typescript
// From: fitcheck-api/src/services/token-budget.service.ts
export const PRIORITY_THRESHOLDS = {
  1: 0,        // Always runs — used for P1 critical fixes
  2: 100_000,  // Runs when 100K+ learning tokens remain
  3: 180_000,  // Runs when 180K+ remain — content blitz uses this
  4: 250_000,  // Runs when 250K+ remain — general weekly content
  5: 350_000,  // Only runs when budget is healthy
  6: 0,        // Fill remaining — lowest priority background tasks
} as const;

const DAILY_BUDGET = parseInt(process.env.DAILY_TOKEN_BUDGET || '500000');
const LEARNING_BUDGET_PCT = parseFloat(process.env.LEARNING_BUDGET_PCT || '0.75');
const LEARNING_FLOOR = parseInt(process.env.LEARNING_BUDGET_FLOOR || '50000');
```

Pattern: 75% of daily tokens go to the learning system. 25% reserved for real users. The learning budget floor ensures learning never goes below 50K even on high-traffic days.

**Every Gemini call in the learning system goes through the budget:**
```typescript
// Reserve before the call
const reserved = await reserveTokens(estimatedTokens, 'seo_content');
if (!reserved) return null; // budget exhausted — skip this cycle

// After the call, record actual usage
const actual = usageMeta.promptTokenCount + usageMeta.candidatesTokenCount;
await recordTokenUsage(estimatedTokens, actual, 'seo_content');
```

**Rating-Weighted StyleDNA** — not all user interactions are equal:
- Unhelpful rating: 0.3x weight
- Rating <= 2 stars: 0.4x weight
- Rating >= 4 stars: 1.2x weight
- No rating: 1.0x weight

**Cohort Clustering** — users are assigned to cohorts (A1–C2) based on engagement patterns. Prompts can be optimized per-cohort rather than globally.

**Falsification Sampling** — periodic deliberate sampling of low-rated outfits to identify failure modes, not just to optimize for the average case.

### What It Needs From Other Engines

- The Agentic Framework's `executeOrQueue` pattern (medium risk) for prompt deployment
- The Intelligence Bus to publish `discovered_knowledge`, `calibration_drift`, `quality_alert`
- A `PromptVersion` table in Prisma with A/B test tracking columns
- A `DailyTokenUsage` table for budget tracking

### Schema Requirements (Prisma)

```prisma
model DailyTokenUsage {
  id             String   @id @default(cuid())
  date           String   @unique  // "2026-03-14"
  budget         Int      @default(500000)
  learningBudget Int      @default(375000)
  userTokens     Int      @default(0)
  learningTokens Int      @default(0)
  reservedTokens Int      @default(0)
  learningUsed   Int?
  breakdown      Json     @default("{}")
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

model PromptVersion {
  id              String   @id @default(cuid())
  version         String   @unique
  promptType      String   @default("outfit_analysis")
  systemPrompt    String
  isActive        Boolean  @default(false)
  isCandidate     Boolean  @default(false)
  avgFQI          Float?
  avgUserRating   Float?
  helpfulPct      Float?
  sampleSize      Int      @default(0)
  createdAt       DateTime @default(now())
  promotedAt      DateTime?
}
```

### From-Zero Launch Sequence

1. Create the `DailyTokenUsage` table via migration
2. Create the `PromptVersion` table via migration
3. Set env vars: `DAILY_TOKEN_BUDGET=500000`, `ENABLE_LEARNING_SYSTEM=true`
4. Seed the first `PromptVersion` row with your initial AI prompt
5. Wire `hasLearningBudget(priority)` as a gate at the top of every autonomous Gemini call
6. Wire `reserveTokens()` before every Gemini call and `recordTokenUsage()` after
7. Implement `computeFQI()` — takes no dependencies, pure function
8. Run the improvement cycle on a weekly cron (Sunday night)
9. Do not run A/B tests until you have >= 50 outfit checks per prompt version

### Common Failure Modes

| Symptom | Cause | Fix |
|---|---|---|
| All autonomous agents stop calling Gemini | `ENABLE_LEARNING_SYSTEM=false` | Set to `true` |
| Budget exhausted before cron runs | User traffic higher than estimated | Raise `DAILY_TOKEN_BUDGET` or lower `LEARNING_BUDGET_PCT` |
| A/B test never resolves | Insufficient sample size | Require minimum 50 checks per version before FQI comparison |
| FQI stuck at 0.6 | No community votes yet — alignment defaults to 0.80 | Ship community voting before enabling FQI-based promotion |
| Improvement cycle generates worse prompts | Gemini has insufficient context | Include 20+ representative failure cases in diagnosis prompt |

---

## Engine 2: The Content Engine {#content-engine}

### Core Insight

A content engine has two distinct modes: **calendar content** (scheduled social posts driven by real user trends) and **editorial content** (long-form SEO articles targeting specific search intent). These feel like the same thing but have completely different failure modes and different consumers. Separate them architecturally.

The key insight for both: content generated from real user behavior outperforms content generated from thin air. The content engine reads your own product's StyleDNA and occasion data as primary input before generating anything.

### Key Architecture

**Content Calendar Service** — reads StyleDNA and OutfitCheck data to identify what your real users are wearing and caring about, then generates 5 social posts per week grounded in that data:

```typescript
// From: fitcheck-api/src/services/content-calendar.service.ts
export async function getTrendData() {
  // Reads StyleDNA archetypes, dominant colors, outfit occasions from last 7 days
  // Returns: { topStyles, popularOccasions, colorTrends }
  // Falls back to generic defaults if no data exists yet
}
```

This function is also consumed by `seo-content.service.ts` — it is the bridge between user behavior and content generation.

**SEO Content Service** — two article modes:

1. **Generic blog post** (~500 words, JSON output, low cost at 2000 tokens): For trend guides and occasion guides. Reads `seo_opportunities` from the Intelligence Bus to pick topics informed by SERP data.

2. **Niche article** (1200–1800 words, with FAQ, at 4000 tokens): Targets specific high-intent keywords for defined audience niches. Integrates live SERP data from Serper.dev to write against what is actually ranking.

**Niche persona system** — content is not generic. Each niche has a hardcoded audience context that gets prepended to the Gemini prompt:

- `rush` — sorority rush week (18–22, TikTok-native, anxious)
- `sahm_rto` — stay-at-home mom returning to work (budget-aware, practical)
- `dating_restart` — dating again after divorce (emotionally loaded, confidence-first)
- `wfh_rto` — remote worker returning to office (wardrobe whiplash)
- `postpartum` — new moms (body-positive, never prescriptive)
- `career_change` — career pivoters (imposter syndrome aware)
- `reinvention` — midlife women (celebratory, zero "age-appropriate")

The niche persona prevents Gemini from defaulting to generic fashion content. Without it, every article sounds the same.

**SERP Intelligence integration** — when `SERPER_API_KEY` is set, every niche article generation fetches live SERP data and injects it into the prompt:

```typescript
// From: fitcheck-api/src/services/seo-content.service.ts
serpContext = `
SERP INTELLIGENCE FOR "${keyword}":
CURRENT TOP RESULTS (write better than these): ...
PEOPLE ALSO ASK — use ALL of these as your FAQ items: ...
RELATED SEARCHES — weave these naturally: ...
Your article MUST outperform what's currently ranking.`;
```

**Content Refresh Logic** — after initial content is created, a monthly refresh cycle reads keyword positions and applies different strategies:
- Position 1–3: Do not touch (working)
- Position 4–10: `boost` strategy — sharpen hook, improve scanability
- Position 11–30: `expand` strategy — add sections, more brand recommendations
- Not ranking after 6 weeks: `reangle` strategy — change the title approach entirely
- Position 31+: `reangle` strategy

**Internal Link Injection** — every article generation reads the 10 most recently published articles and includes them in the prompt as suggested internal links. This builds topic cluster authority automatically.

**Brand Guard Integration** — all article publication goes through `executeOrQueue` at medium risk, which triggers brand guard (Gemini Flash content safety check) before publishing. Articles that fail brand guard land in `pending_review` status.

**Style Narrative Agent** — weekly micro-content (1–2 sentences), generated Sunday 5pm UTC:

```
"We've noticed you're gravitating toward structured pieces lately —
 your blazer and tailored trousers looks have been your highest-rated outfits."
```

This is relationship-building content, not SEO content. Completely separate from the blog pipeline. Uses `executeOrQueue` at medium risk.

**Milestone Messages** — reactive micro-content triggered by user behavior events (10th check, first 8+ score, first community submission). Checked after every AI analysis run + scanned daily. Uses Prisma unique constraint (`userId + milestoneType`) as dedup — any race condition on P2002 is silently ignored.

### What It Needs From Other Engines

- Learning Engine's `getTrendData()` (trend signals for social posts and blog topics)
- Learning Engine's token budget (`hasLearningBudget(4)` for weekly run, `hasLearningBudget(3)` for niche blitz)
- Intelligence Bus's `seo_opportunities` entries (published by SEO Engine)
- Intelligence Bus's `trend_signal` entries (published by content calendar after reading user StyleDNA)
- Agentic Framework's `executeOrQueue` (medium risk for all publish actions)

### Schema Requirements (Prisma)

```prisma
model BlogDraft {
  id              String    @id @default(cuid())
  title           String
  slug            String    @unique
  content         String
  metaDescription String
  ogTitle         String
  excerpt         String?
  seoKeywords     String[]
  status          String    @default("pending_review") // pending_review | published | archived
  category        String
  contentType     String    @default("style_guide")
  sourceData      Json      @default("{}")
  publishedAt     DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

### From-Zero Launch Sequence

1. Create `BlogDraft` table via migration
2. Set `GEMINI_API_KEY` and `SERPER_API_KEY` env vars
3. Seed `TargetKeyword` table by running `keyword-discovery.ts` (see SEO Engine)
4. Run `generate-content-now.ts` manually to verify the pipeline works end-to-end before trusting the cron
5. Set cron: weekly Tuesday 8am UTC for generic content (`runSeoContentAgent`)
6. Set cron: weekly Wednesday 9am UTC for niche blitz (`generateRushContentBlitz`)
7. Set cron: monthly for refresh (`refreshRushContent`)
8. Build the frontend `/learn/[slug]` route to serve published articles with FAQ schema markup
9. Submit the sitemap to Google Search Console

### Common Failure Modes

| Symptom | Cause | Fix |
|---|---|---|
| Drafts stuck in `pending_review`, never publish | Brand guard rejecting — or `AgentConfig.enabled=false` for `seo-content` | Check `AgentAction` table for rejection reasons. Check brand guard issues |
| Articles generated without SERP enrichment | `SERPER_API_KEY` not set | Set it. Cost: ~$0.001/search. Worth it |
| All articles have the same generic tone | Niche context not being applied | Verify `niche` field on `TargetKeyword` rows matches keys in `nicheContext` map |
| Internal links never appear | No published articles exist yet to link to | Bootstrap with `generate-content-now.ts` script first |
| Content calendar posts are generic | No StyleDNA or OutfitCheck data in DB | Early-stage fallback is correct — improve as user base grows |
| Style Narrative never sends | `executeOrQueue` queued it at high risk | Check `AgentConfig.autoApproveRisk` for `style-narrative` agent |

---

## Engine 3: The SEO Engine {#seo-engine}

### Core Insight

SEO is not a marketing function — it is a data collection and feedback system. The keyword discovery script tells you which audience segments have enough Google search volume to justify building content for. The SERP intelligence service tells you what is currently ranking so your content can be written to beat it. The position tracking tells you whether to boost, expand, or abandon a piece of content. All of this is structured data, not creative instinct.

The other insight: target high-intent low-difficulty keywords in underserved niches. "Outfit ideas" has massive competition. "What to wear to sorority rush open house" has low competition and extremely high purchase intent. Niche specificity beats general popularity.

### Key Architecture

**Keyword Discovery Script** (`scripts/keyword-discovery.ts`) — one-time setup that seeds all keyword niches and enriches them with live SERP data:

```
npm run keywords:discover
# or
railway run npx tsx scripts/keyword-discovery.ts
```

Process:
1. Upserts all hardcoded seed keywords into `TargetKeyword` with `status='identified'`
2. For each niche, fires a Serper.dev search for the discovery query
3. Extracts People Also Ask questions and Related Searches
4. Upserts discovered keywords into `TargetKeyword` (dedup by keyword string)
5. Prints a verdict table: `PROCEED` (>=12 signals), `REVIEW` (6–11), `SPARSE` (<6)

The verdict table is actionable: SPARSE niches likely have insufficient search volume to justify the content investment.

**SEO Intelligence Service** (`src/services/seo-intelligence.service.ts`) — weekly Monday 7:30am UTC:
- Fetches Google Search Console data (clicks, impressions, CTR, position per query/page)
- Categorises each keyword into opportunity buckets: `improve_title`, `content_boost`, `new_page`, `major_expansion`
- Checks PageSpeed scores (optional `PAGESPEED_API_KEY`)
- Emails founder a weekly SEO report
- Publishes `seo_opportunities` to the Intelligence Bus — the Content Engine reads this to pick topics

```typescript
// Opportunity bucket logic from seo-intelligence.service.ts
// impressions > 100 and position 4-20 → "close" opportunities → content_boost
// impressions > 50 and no page ranking → "gap" keywords → new_page
// position 1-3 but CTR below expected → improve_title
```

**Serper.dev helper** — shared across both services:

```typescript
export async function searchSerper(keyword: string, num = 10): Promise<SerperResult> {
  // Returns: { organic[], peopleAlsoAsk[], relatedSearches[], answerBox? }
}
```

Both `seo-intelligence.service.ts` and `seo-content.service.ts` import this. It is the SERP data layer.

**Niche Landing Pages** — six static pages (built in the frontend app, not the content pipeline) targeting transition niches. These serve as permanent acquisition hubs that capture traffic at the top of the funnel before visitors reach the blog. They are not generated by the content engine; they are built once per niche and maintained manually.

The six transition niches: back-to-work, dating-again, back-to-office, postpartum, career-change, reinvention.

**FAQ Structured Data** — every niche article in the `BlogDraft` has a `faqItems` field stored in `sourceData`. The frontend renders these as JSON-LD FAQ schema markup on each article page. This targets Google's People Also Ask boxes and featured snippets directly.

**Sitemap** — must be submitted to Google Search Console manually after the first batch of articles publishes. The API endpoint `GET /api/learn/sitemap.xml` should dynamically generate the sitemap from published `BlogDraft` rows.

**TargetKeyword table** — the spine of the SEO engine:

```prisma
model TargetKeyword {
  id              String   @id @default(cuid())
  keyword         String   @unique
  niche           String
  intent          String   // 'informational' | 'transactional'
  difficulty      String   // 'low' | 'medium' | 'high'
  status          String   @default("identified") // identified | content_created | deprecated
  currentPosition Int?     // updated weekly by SEO intelligence
  targetPageSlug  String?  // slug of the BlogDraft created for this keyword
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### What It Needs From Other Engines

- Intelligence Bus to publish `seo_opportunities` (consumed by Content Engine)
- Agentic Framework to `executeOrQueue` keyword research actions
- Token Budget's `hasLearningBudget(3)` as gating for Gemini-powered opportunity analysis
- `SERPER_API_KEY` — without this, the engine runs blind

### From-Zero Launch Sequence

1. Get a `SERPER_API_KEY` from serper.dev (free tier: 2,500 searches/month)
2. Get Google Search Console access and create a service account (for GSC integration — optional at first)
3. Set env vars: `SERPER_API_KEY`, `GSC_SERVICE_ACCOUNT_EMAIL`, `GSC_PRIVATE_KEY`, `GSC_SITE_URL`
4. Run `keyword-discovery.ts` — this seeds the database and gives you the verdict table
5. Review verdict table — drop any niche scoring SPARSE unless you have strong conviction
6. Set cron: Monday 7:30am UTC for `runSeoIntelligenceAgent`
7. Verify `seo_opportunities` entries appear in `IntelligenceBusEntry` table after cron runs
8. Build the `/learn/[slug]` frontend route with FAQ JSON-LD schema before submitting the sitemap
9. Submit sitemap to Google Search Console
10. After 60 days, review position data and trigger the first refresh cycle

### Niche Validation Checklist

Before building content for a niche, verify:
- [ ] `PROCEED` verdict in keyword discovery (>= 12 SERP signals)
- [ ] At least 3 seed keywords with clear informational intent
- [ ] A distinct, addressable audience with a specific anxiety or transition moment
- [ ] A tone of voice that is clearly different from generic fashion advice
- [ ] A CTA that is specific to the audience's moment (not generic "try our app")

### Common Failure Modes

| Symptom | Cause | Fix |
|---|---|---|
| Keyword discovery script fails | `SERPER_API_KEY` not set | Add it to `.env` and retry |
| All niches score SPARSE | Generic discovery queries returning no PAA | Narrow the discovery query. Add year. Be more specific |
| Content never gets `seo_opportunities` from bus | SEO intelligence cron not running | Check `ENABLE_CRON=true` and GSC credentials |
| Articles rank position 30+ and never improve | Refresh logic not running | Verify monthly refresh cron is scheduled and `currentPosition` is being updated |
| No FAQs rendering on article pages | `faqItems` in `sourceData` but frontend not reading it | Read `sourceData.faqItems` and render as JSON-LD |
| GSC returns empty data | Site not verified in Search Console | Verify site ownership first |

---

## Engine 4: The Agentic Framework {#agentic-framework}

### Core Insight

Autonomous agents that can write emails, post to social media, or publish content are dangerous without guardrails. The naive approach is to give each agent direct database access and hope it behaves. The correct approach is a central chokepoint — a single function that all agent actions pass through — that enforces risk levels, rate limits, kill switches, and brand safety. Every action is logged. Every high-risk action requires human approval before execution.

The secondary insight: agents are unreliable. They need to be enabled and disabled independently, have their action logs inspected, and be restartable after failures without re-running actions they already completed.

### The `executeOrQueue` Pattern

This is the single most important function in the entire agentic framework. Every autonomous action — sending an email, publishing a blog post, posting to Twitter, sending a push notification — must go through it.

```typescript
// From: fitcheck-api/src/services/agent-manager.service.ts
export async function executeOrQueue(
  agent: string,          // "seo-content"
  actionType: string,     // "publish_draft"
  riskLevel: RiskLevel,   // "low" | "medium" | "high"
  payload: Record<string, unknown>,  // action-specific data
  executeFn: Executor,    // async (payload) => result
  contentToCheck?: string // text to run through brand guard (medium+ risk)
): Promise<ExecuteResult>
```

**Decision tree inside `executeOrQueue`:**

```
1. Is the agent enabled? (AgentConfig.enabled)
   NO → create AgentAction with status='rejected', reason='agent_disabled'

2. Is the agent within rate limits? (hourly + daily caps)
   NO → create AgentAction with status='rejected', reason='rate_limit'

3. Is risk level > agent's autoApproveRisk threshold?
   YES → create AgentAction with status='pending' (queued for manual approval)

4. Is risk level >= medium AND contentToCheck provided?
   YES → run brand guard (Gemini Flash safety check)
   FAIL → create AgentAction with status='rejected', reason='brand_guard_failed'

5. Auto-execute → create AgentAction with status='pending', run executeFn
   SUCCESS → update status='executed'
   FAIL → update status='failed', rethrow
```

**Risk level semantics:**
- `low` — auto-execute always (sending internal metrics, scheduling records, logging)
- `medium` — auto-execute with brand guard (blog publication, email sends, push notifications)
- `high` — always queue for human approval (Twitter posts, App Store replies, PR outreach)

### Intelligence Bus

The Intelligence Bus is a persistent cross-agent message board. It is not a real-time event bus. It is a PostgreSQL-backed table with 14-day expiry.

```typescript
// From: fitcheck-api/src/services/intelligence-bus.service.ts
export async function publishToIntelligenceBus(
  agent: string,
  type: BusEntryType,
  payload: Record<string, unknown>
): Promise<string>

export async function readFromIntelligenceBus(
  consumer: string,
  type: BusEntryType,
  opts: { limit?: number; unreadOnly?: boolean; sinceDate?: Date }
): Promise<Array<{ id, agent, payload, createdAt }>>
```

The `consumedBy` field is a string array. `unreadOnly: true` marks entries as consumed by the reading agent. This prevents double-processing without needing distributed locks.

**Current bus types (as of March 2026):**

Core learning: `trend_signal`, `quality_alert`, `critique_finding`, `discovered_knowledge`, `calibration_drift`
Ops learning: `email_metrics`, `nudge_metrics`, `social_metrics`, `conversion_metrics`
RSI system: `followup_metrics`, `milestone_metrics`, `brand_guard_metrics`
Marketing: `seo_metrics`, `seo_opportunities`, `creator_scout_metrics`, `aso_metrics`
Infrastructure: `infra_metrics`, `uptime_metrics`, `orchestrator_run`

**When to add a new bus type:** when two agents need to share structured data and one runs before the other on a different schedule. If they run in the same cron job, just pass data directly. The bus is for decoupled, time-delayed communication.

### Brand Guard

```typescript
// From: fitcheck-api/src/services/brand-guard.service.ts
export interface BrandGuardResult {
  approved: boolean;
  issues: string[];
  revised?: string;
}
```

Uses Gemini Flash (cheap, fast) to check content against brand safety criteria. 15-minute in-memory cache by content fingerprint (first 120 chars + length). Avoids re-checking identical content.

The calibration system reads `brand_guard_metrics` from the bus monthly and adjusts the brand guard prompt to correct over-flagging or under-flagging drift. This prevents the brand guard from becoming useless (approving everything) or paralysing (rejecting everything).

### Agent Configuration (Database-Controlled)

```prisma
model AgentConfig {
  id               String    @id @default(cuid())
  agent            String    @unique
  enabled          Boolean   @default(true)
  maxActionsPerDay Int       @default(50)
  maxActionsPerHour Int      @default(10)
  autoApproveRisk  String    @default("medium") // "low" | "medium" | "high"
  lastRunAt        DateTime?
  lastError        String?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
}
```

Agents auto-create their config on first run with defaults. No migration seeding needed.

### Executor Registry

When a server restarts, the in-memory executor registry is lost. Any `AgentAction` rows with `status='approved'` (from human approval) will not be processable until the executor is re-registered. The framework handles this with a 30-minute grace period: if an action was approved less than 30 minutes ago and no executor is found, it waits for the next cron cycle (5 minutes) instead of marking as failed.

High-risk executors that will always need to run after approval are registered at module-load time directly in `agent-manager.service.ts`:

```typescript
// Built-in registration at module load (not inside executeOrQueue)
executorRegistry.set('social-media-manager:post_social', async (payload) => {
  // twitter posting logic
});
```

### Admin API

```
GET  /api/admin/agents           — dashboard: all agent configs + recent actions
GET  /api/admin/agents/:name     — specific agent actions with pagination
GET  /api/admin/agents/queue     — pending queue (high-risk actions awaiting approval)
POST /api/admin/agents/:id/approve  — approve a pending action
POST /api/admin/agents/:id/reject   — reject a pending action
POST /api/admin/agents/:name/kill   — disable an agent
POST /api/admin/agents/:name/enable — re-enable an agent
```

All admin endpoints require auth middleware. Build a basic admin UI that shows the pending queue — this is where you will spend time reviewing high-risk actions.

### From-Zero Launch Sequence

1. Create `AgentAction` and `AgentConfig` tables via migration
2. Create `IntelligenceBusEntry` table via migration
3. Implement `executeOrQueue` as a standalone service (no dependencies except Prisma and brand-guard)
4. Implement `publishToIntelligenceBus` and `readFromIntelligenceBus`
5. Implement `brand-guard.service.ts` with Gemini Flash
6. Wire admin routes (`/api/admin/agents`)
7. Set env var: `ENABLE_CRON=true` on production (Railway)
8. Schedule `processApprovedActions` cron at 5-minute intervals
9. On each new agent, call `executeOrQueue` with appropriate risk level — never call database or external APIs directly

### Cron Setup (Railway / node-cron)

```typescript
// Scheduler pattern — every agent cron uses guardedRun
async function guardedRun(agentName: string, fn: () => Promise<void>) {
  if (!(await isAgentEnabled(agentName))) return;
  try {
    await fn();
    await recordAgentRun(agentName);
  } catch (err) {
    await recordAgentRun(agentName, String(err));
  }
}

// Example cron registration
cron.schedule('0 8 * * 2', () => guardedRun('seo-content', runSeoContentAgent)); // Tuesday 8am
```

### Common Failure Modes

| Symptom | Cause | Fix |
|---|---|---|
| All agents reject with `agent_disabled` | `AgentConfig.enabled=false` or kill switch in DB | `POST /api/admin/agents/:name/enable` or run `enableAgent()` directly |
| High-risk actions stuck in `pending` forever | No admin UI to approve them | Build the approval UI or temporarily lower `autoApproveRisk` to `medium` in AgentConfig |
| `No executor registered for X:Y` after approval | Server restarted between approval and processing | Normal — grace period handles this. Wait 30 min. Or register the executor at module load |
| Brand guard rejects everything | Over-calibration | Read `AgentAction` rejection reasons. Run `calibrateBrandGuard()` manually. Adjust brand guard prompt |
| Rate limits constantly hit | `maxActionsPerDay` too low for the cron schedule | Update `AgentConfig.maxActionsPerDay` in DB for the affected agent |
| Crons not running | `ENABLE_CRON` not set or server not running | Set `ENABLE_CRON=true` on Railway. Check server logs for cron registration |

---

## Correct Launch Order {#launch-order}

Do not launch all four engines at once. This is the correct sequence:

### Phase 0: Infrastructure (Day 1)
- [ ] PostgreSQL database provisioned
- [ ] Prisma schema deployed with base models
- [ ] Basic Express server running on Railway
- [ ] `AgentAction`, `AgentConfig`, `IntelligenceBusEntry` tables created
- [ ] `executeOrQueue` implemented and tested
- [ ] Admin routes wired (`/api/admin/agents`)
- [ ] `ENABLE_CRON=true` set on Railway

### Phase 1: Token Budget (Day 2–3)
- [ ] `DailyTokenUsage` table created
- [ ] `hasLearningBudget()`, `reserveTokens()`, `recordTokenUsage()` implemented
- [ ] `DAILY_TOKEN_BUDGET=500000`, `ENABLE_LEARNING_SYSTEM=true` set
- [ ] Test: call `hasLearningBudget(4)` and verify it returns true
- [ ] Test: call `reserveTokens(2000, 'test')` and verify `DailyTokenUsage` row is created

### Phase 2: SEO Foundation (Day 4–7)
- [ ] `TargetKeyword` table created
- [ ] `SERPER_API_KEY` set
- [ ] Run `keyword-discovery.ts` — review verdict table
- [ ] Remove any SPARSE niches from seed list
- [ ] `BlogDraft` table created

### Phase 3: Content Engine (Week 2)
- [ ] `generateNicheArticle()` tested manually (not via cron)
- [ ] `generate-content-now.ts` run and verified (articles in DB, status='published')
- [ ] Frontend `/learn/[slug]` route built and serving content
- [ ] FAQ JSON-LD schema rendering on article pages
- [ ] Sitemap endpoint built and submitted to Google Search Console
- [ ] SEO content cron scheduled (Tuesday 8am UTC)
- [ ] Niche blitz cron scheduled (Wednesday 9am UTC)

### Phase 4: Learning Engine (Week 3–4, after first user data)
- [ ] `PromptVersion` table created with initial prompt seeded
- [ ] `computeFQI()` implemented
- [ ] `measurePromptPerformance()` implemented
- [ ] FQI tracked per prompt version on `OutfitCheck` rows (`promptVersion` field)
- [ ] A/B testing logic implemented (route 50% of traffic to candidate by user ID hash)
- [ ] Improvement cycle cron scheduled (Sunday night)
- [ ] Minimum 50 checks required before any promotion decision

### Phase 5: SEO Intelligence (Week 4+, after first articles index)
- [ ] Google Search Console service account created
- [ ] `GSC_SERVICE_ACCOUNT_EMAIL`, `GSC_PRIVATE_KEY`, `GSC_SITE_URL` set
- [ ] SEO intelligence cron running (Monday 7:30am UTC)
- [ ] `currentPosition` updating on `TargetKeyword` rows
- [ ] Content refresh logic enabled

---

## Environment Variables Master Checklist {#env-checklist}

### Required (Nothing works without these)
```
DATABASE_URL              — PostgreSQL connection string
GEMINI_API_KEY            — Content generation (all engines use this)
ENABLE_CRON=true          — Master cron kill switch
ENABLE_LEARNING_SYSTEM=true — Token budget gate
```

### Required for SEO Engine
```
SERPER_API_KEY            — Serper.dev for SERP data ($0.001/search)
```

### Required for SEO Intelligence (optional at launch)
```
GSC_SERVICE_ACCOUNT_EMAIL — Google Search Console service account
GSC_PRIVATE_KEY           — PEM-encoded private key (escape newlines as \n)
GSC_SITE_URL              — https://yourdomain.com
PAGESPEED_API_KEY         — Optional, increases rate limits
```

### Token Budget Tuning
```
DAILY_TOKEN_BUDGET=500000       — Gemini free tier limit per day
LEARNING_BUDGET_PCT=0.75        — Fraction of budget for learning system
LEARNING_BUDGET_FLOOR=50000     — Minimum learning tokens even on busy days
```

### Notifications and Ops
```
RESEND_API_KEY            — Email via Resend
FOUNDER_EMAIL             — Ops digest and alert destination
SENTRY_DSN                — Error tracking
```

### Agent Feature Flags
```
ENABLE_NUDGE=false        — Disable nudger (can be noisy early on)
ENABLE_BETA_RECRUITER=true — Beta user recruitment agent
REFERRAL_BASE_URL         — https://yourdomain.com/invite
```

---

## Common Failure Modes and Fixes {#failure-modes}

### Diagnosing a Silent Pipeline

When content stops being generated and there are no error logs, run the diagnostic script:

```bash
railway run npx tsx scripts/diagnose-pipeline.ts
```

This checks 14 gates in sequence and prints a status table:

1. `ENABLE_CRON` — master kill switch
2. `ENABLE_LEARNING_SYSTEM` — budget gate
3. `GEMINI_API_KEY` — generation will fail silently without this
4. `SERPER_API_KEY` — WARN only, articles still generate
5. `DAILY_TOKEN_BUDGET` — checks minimum level
6. DB connectivity — PostgreSQL reachable
7. `AgentConfig: seo-content` — agent enabled check
8. `AgentConfig: seo-intelligence` — agent enabled check
9. `TargetKeyword` seeds — identified count
10. `BlogDraft` status breakdown — pending vs published
11. `AgentAction` — recent rejections with reasons
12. `DailyTokenUsage` — today's token consumption
13. Budget gate priority 3 — threshold check for niche blitz
14. Published articles — confirms pipeline has ever completed end-to-end

**Fix hierarchy (in order):**
1. `ENABLE_CRON` FAIL → `railway variables set ENABLE_CRON=true`
2. `ENABLE_LEARNING_SYSTEM` FAIL → `railway variables set ENABLE_LEARNING_SYSTEM=true`
3. `GEMINI_API_KEY` FAIL → set the key
4. Keywords FAIL → `railway run npx tsx scripts/keyword-discovery.ts`
5. No published articles → `railway run npx tsx scripts/generate-content-now.ts`

### Force-Generating Content (Bypassing All Gates)

When the pipeline is stuck and you need content immediately:

```bash
railway run npx tsx scripts/generate-content-now.ts
```

This script:
- Skips `hasLearningBudget()` check
- Skips `executeOrQueue` (writes directly to DB as `status='published'`)
- Seeds keywords if none exist
- Generates 3 articles from the first 3 identified keywords

Safe to run multiple times. Uses upsert for keywords and slug deduplication for drafts.

### Token Budget Exhausted

**Symptoms:** All autonomous agents return early with "Insufficient token budget" logs.

**Diagnosis:**
```sql
SELECT date, budget, learning_budget, learning_tokens, user_tokens
FROM daily_token_usage
ORDER BY date DESC LIMIT 7;
```

**Fix options:**
- Raise `DAILY_TOKEN_BUDGET` (if you have paid Gemini quota)
- Lower `LEARNING_BUDGET_PCT` (reduces learning, more budget for users)
- Kill low-priority agents temporarily (`POST /api/admin/agents/:name/kill`)

### Brand Guard Paralysis

**Symptoms:** All content lands in `pending_review`, `AgentAction` rows show `brand_guard_failed` with vague issues.

**Diagnosis:** Read the rejection issues in `AgentAction.result`:
```sql
SELECT result, created_at FROM agent_actions
WHERE agent = 'seo-content' AND status = 'rejected'
ORDER BY created_at DESC LIMIT 10;
```

**Fix:** If the issues are false positives (overly strict), run `calibrateBrandGuard()` manually, or temporarily lower brand guard strictness by adjusting the prompt in `brand-guard.service.ts`.

### Intelligence Bus Not Flowing

**Symptoms:** SEO content generates generic topics instead of opportunity-driven topics.

**Diagnosis:**
```sql
SELECT agent, entry_type, created_at FROM intelligence_bus_entries
WHERE entry_type = 'seo_opportunities'
ORDER BY created_at DESC LIMIT 5;
```

**Fix:** If no entries, the SEO intelligence agent either never ran or failed silently. Check `AgentConfig.lastError` for `seo-intelligence`. Check cron schedule. Run manually if needed.

### A/B Test Never Resolves

**Symptoms:** Two prompt versions running for weeks with no promotion.

**Causes:**
- Insufficient sample size (need >= 50 checks per version)
- FQI delta smaller than `FQI_KEEP_THRESHOLD` (0.03) — both versions are equivalent
- User rating data missing (users not rating feedback)

**Fix:** Add a friction-free rating prompt in the UI. If neither version wins after 200+ samples, the candidates are equivalent — revert to control and run a more aggressive improvement cycle.

---

## Key Architectural Decisions (and Why)

**PostgreSQL as the intelligence bus, not Redis or a proper message queue**

Simpler to operate on Railway. 14-day TTL covers all agent scheduling windows. The `consumedBy` array pattern provides sufficient dedup without Kafka semantics. The tradeoff is that you cannot do real-time pub/sub — but none of these agents need that.

**Gemini Flash for brand guard, not GPT-4**

Brand guard runs on every medium-risk action. Cost matters. Gemini Flash is fast and cheap. GPT-4 vision is used only where quality is critical (outfit analysis). Match the model to the task.

**Priority-based token budget, not time-based allocation**

Time-based ("learning runs at 2am") is brittle — what if the server restarts? Priority-based allocation means the system self-organises around whatever budget remains. Critical agents (priority 1) always run. Non-critical agents (priority 5+) run only when there is budget to spare.

**`executeOrQueue` as the single chokepoint, not per-agent guardrails**

The temptation is to add rate limits and safety checks inside each agent. This leads to inconsistent enforcement and agents that bypass each other's limits. One function, one set of rules, all actions logged. Every autonomous action in the codebase should call `executeOrQueue`. No exceptions.

**Niche persona context hardcoded, not in the database**

The niche context strings define the tone and voice for each audience. These are editorial decisions that should be version-controlled, not database records that can be accidentally overwritten. If they need to change, change the code and redeploy.

---

*This document was generated from the Or This? codebase (March 2026). Key source files:*
- *`fitcheck-api/src/services/agent-manager.service.ts` — Agentic Framework core*
- *`fitcheck-api/src/services/intelligence-bus.service.ts` — Cross-agent communication*
- *`fitcheck-api/src/services/token-budget.service.ts` — Learning token management*
- *`fitcheck-api/src/services/seo-content.service.ts` — Content generation*
- *`fitcheck-api/src/services/seo-intelligence.service.ts` — SERP analysis*
- *`fitcheck-api/src/services/recursive-improvement.service.ts` — FQI + prompt improvement*
- *`fitcheck-api/src/services/brand-guard.service.ts` — Content safety*
- *`fitcheck-api/src/services/content-calendar.service.ts` — Social content + trend data*
- *`fitcheck-api/scripts/keyword-discovery.ts` — Niche keyword seeding*
- *`fitcheck-api/scripts/diagnose-pipeline.ts` — Pipeline diagnostic*
- *`fitcheck-api/scripts/generate-content-now.ts` — Force content generation*
