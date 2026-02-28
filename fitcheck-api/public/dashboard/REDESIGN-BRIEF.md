# Or This? Agent Dashboard — Lovable Design Brief
## Magazine-First Redesign

---

## 1. Vision

Redesign the Or This? operator dashboard so it reads like turning pages of *Vogue* — not like an admin panel with editorial wallpaper. Every view is a full-viewport magazine spread. Navigation disappears; page indicators float at the right edge. The editorial illustrations are the visual engine. Typography is monumental. Breathing room is generous.

**Current problem:** Sidebar + content layout, dense card grids, small emoji agent icons, and landscape image containers that crop faces off.

**Target aesthetic:** Condé Nast digital editorial. Think *Vogue Runway* or *The Row* product pages — sharp typographic hierarchy, portrait-oriented photography, extreme whitespace, no decorative UI chrome.

---

## 2. Brand Design System

### 2.1 Color Tokens

```
--coral:        #E85D4C   /* primary — buttons, CTAs, coral rule, accent */
--coral-dark:   #C94A3A   /* hover/active states */
--coral-light:  #FF7A6B   /* highlight, unused in main UI */
--cream:        #FBF7F4   /* primary page background */
--cream-dark:   #F5EDE7   /* card backgrounds, alternating sections */
--black:        #1A1A1A   /* all primary text */
--charcoal:     #2D2D2D   /* secondary text */
--muted:        #9B9B9B   /* labels, captions, timestamps */
--border:       rgba(0,0,0,0.1)   /* all dividers, transparent borders */
--border-solid: #E8E8E8           /* solid borders on cards/inputs */
--surface:      #FFFFFF            /* card backgrounds, form panels */
```

**Status / semantic (functional only — never decorative):**
```
--success: #10B981  (executed, high-score)
--warning: #F59E0B  (pending, medium-score)
--error:   #EF4444  (failed, rejected, low-score)
```

### 2.2 Typography

**Fonts loaded:** Google Fonts — `Playfair Display` (400 regular, 400 italic) + `DM Sans` (400, 500, 600, 700)

| Token | Font | Weight | Style | Size | Tracking | Transform |
|---|---|---|---|---|---|---|
| `display-xl` | Playfair Display | 400 | regular | 5–7rem | -0.03em | — |
| `display-lg` | Playfair Display | 400 | italic | 3–4rem | -0.02em | — |
| `display-md` | Playfair Display | 400 | regular | 2–2.5rem | -0.01em | — |
| `page-title` | Playfair Display | 400 | italic | 3rem | -0.02em | — |
| `section-label` | DM Sans | 500 | normal | 0.6875rem (11px) | 0.2em | UPPERCASE |
| `body` | DM Sans | 400 | normal | 0.9375rem (15px) | — | — |
| `body-sm` | DM Sans | 400 | normal | 0.875rem (14px) | — | — |
| `caption` | DM Sans | 400 | normal | 0.8125rem (13px) | — | — |
| `button-label` | DM Sans | 500 | normal | 0.75rem (12px) | 0.12em | UPPERCASE |
| `stat-number` | Playfair Display | 400 | regular | 4–5rem | -0.02em | — |
| `stat-label` | DM Sans | 500 | normal | 0.6875rem | 0.2em | UPPERCASE |

**Usage rule:**
- Playfair Display ITALIC → logo mark only ("Or This?") and `display-lg` / `page-title`
- Playfair Display regular → `display-xl`, `display-md`, `stat-number`, large pull quotes
- DM Sans → everything else: labels, body text, buttons, data, captions

### 2.3 Border Radius

```
buttons, inputs, chips, tags → border-radius: 0px  (sharp, editorial)
image containers              → border-radius: 4px  (barely rounded)
cards                         → border-radius: 8px
logo mark square              → border-radius: 0px
status pills                  → border-radius: 9999px (pill — exception)
toggle switches               → border-radius: 9999px (exception)
```

### 2.4 Editorial Motifs

- **Coral rule:** A 60px wide × 1px tall `#E85D4C` horizontal bar. Appears above section labels and page titles as a typographic accent — not a full-width divider.
- **Diamond mark:** A 5px × 5px coral square rotated 45°, used as a section separator between items in typographic lists.
- **Letter-spacing discipline:** All uppercase labels at 0.2em. Display text slightly negative.
- **Photo overlays:** Linear gradients — dark at bottom (overlay text), never flat color washes.

---

## 3. Navigation Model

**No sidebar. No top navigation bar.**

The dashboard navigates like a magazine. Six pages, each full-viewport. Navigate by:
1. Clicking the dot page indicators on the right edge
2. Scroll (snap) or keyboard arrow keys
3. Browser back/forward

### 3.1 Floating Elements (always visible)

**Logo mark — top-left, fixed:**
```
Position: fixed, top: 24px, left: 24px, z-index: 100
Element: 36×36px square (border-radius: 0)
Background: #E85D4C (coral)
Content: italic "?" in Playfair Display Italic, white, ~1.1rem
Behavior: clicking navigates to Overview page (#overview)
On dark backgrounds: add subtle drop-shadow
```

**Page dot indicators — right edge, fixed:**
```
Position: fixed, right: 20px, top: 50%, transform: translateY(-50%), z-index: 100
Layout: vertical column, gap: 12px
Each dot: 7px × 7px circle, border-radius: 9999px
Inactive: background #E8E8E8
Active: background #E85D4C, scale: 1.3
Hover: background #9B9B9B
Tooltip: page name appears to the left of dot on hover (DM Sans 11px, --muted)
Order: Login • Overview • Social Posts • Approval Queue • Agent Detail • Action Log
```

### 3.2 Page Transitions

**Between pages:** Horizontal crossfade — outgoing page fades to opacity 0 + translateX(-20px), incoming page fades from opacity 0 + translateX(20px). Duration: 400ms, easing: cubic-bezier(0.25, 0.46, 0.45, 0.94).

**Within-page reveals:** Scroll-triggered staggered fade-in-up. Elements translate from Y+24px to Y=0, opacity 0→1. Stagger: 80ms per element. Threshold: 15% visible.

---

## 4. Image System

### 4.1 The 7 Editorial Illustrations

All images are portrait-oriented fashion photographs (approximately 4:5 ratio). Faces are centered in the upper portion of the frame.

| Filename | Description | Primary Assignment |
|---|---|---|
| `editorial-duo.jpg` | Two models, likely side-by-side portrait | Overview — full hero |
| `editorial-orange.jpg` | Model in warm orange tones | Login left panel + social-media-manager agent |
| `editorial-teal.jpg` | Model in teal/blue-green tones | Social Posts header + social-media-manager agent |
| `editorial-blue.jpg` | Model in cool blue tones | lifecycle-email agent card |
| `editorial-purple.jpg` | Model in purple/violet tones | conversion-intelligence agent card |
| `editorial-tan.jpg` | Model in tan/neutral tones | community-manager agent card |
| `editorial-sketches.jpg` | Fashion sketch illustrations | outreach-agent card + appstore-manager card |

### 4.2 Image Assignments per Page

```
Login left panel:        editorial-orange.jpg
Overview hero (full):    editorial-duo.jpg
Social Posts header:     editorial-teal.jpg
Agent cards (horizontal strip):
  lifecycle-email        → editorial-blue.jpg
  conversion-intelligence → editorial-purple.jpg
  community-manager      → editorial-tan.jpg
  social-media-manager   → editorial-orange.jpg
  appstore-manager       → editorial-teal.jpg
  outreach-agent         → editorial-sketches.jpg
Agent Detail hero:       agent's assigned image (from above)
Action Log page:         no illustration (typography-only)
Approval Queue page:     no illustration (typography-only)
```

### 4.3 Image Cropping Rules

**DO NOT use `object-position: center center` for landscape containers — it cuts off faces.**

```
Portrait containers (taller than wide) → object-fit: cover; object-position: center 20%;
  → Use for: agent cards (portrait strip), login panel

Landscape containers (wider than tall) → object-fit: cover; object-position: center 30%;
  → Use for: Social Posts split header, Agent Detail hero

Hero (full-bleed, aspect 16:9 or wider) → object-fit: cover; object-position: center 25%;
  → Use for: Agent Detail full-bleed header (50vh)

Square containers → object-fit: cover; object-position: center 15%;

editorial-sketches.jpg → object-fit: contain; object-position: center; background: var(--cream-dark);
  → Sketches are illustrations, not portraits — preserve the artwork
```

---

## 5. Page Specifications

### Page 1 — Login

**Layout:** Full-viewport split. Left 42% = dark editorial panel (hidden on mobile). Right 58% = white form panel.

**Left panel (desktop only):**
- Background: `#1A1A1A` (black)
- Content stacked vertically:
  1. Top-left: Logo mark (coral "?" square) + "Or This?" in Playfair Italic, white, 1.125rem
  2. Middle: `editorial-orange.jpg` filling the remaining height. Portrait crop. `object-position: center 15%`. Slow zoom-in on hover (`transform: scale(1.04)`, 12s ease). Gradient overlay: `linear-gradient(to bottom, rgba(26,26,26,0.15), transparent 40%, rgba(26,26,26,0.6))`
  3. Bottom: editorial pull quote in Playfair Italic, white, 1rem, 1.6 line-height + "CONFIDENCE IN EVERY CHOICE." section label in coral

**Right panel:**
- Background: white
- Centered card, max-width 400px
- Desktop: just heading + form (logo already in left panel)
- Mobile: logo mark + heading centered, then form in a white card with 1px border `#E8E8E8`
- Heading: "Agent Dashboard" in Playfair Italic, 2rem, `#1A1A1A`
- Sub: "Or This? Operator Console" in DM Sans 400, 0.875rem, `--muted`
- Input: "Access Token" label (DM Sans 500, 0.875rem), password input with sharp corners (border-radius: 0), coral focus ring, placeholder "Paste your ADMIN_DASHBOARD_TOKEN"
- Button: "SIGN IN TO DASHBOARD" — full-width, sharp corners, coral background, white uppercase DM Sans 500 12px 0.12em tracking, 48px height
- Below form: `Set ADMIN_DASHBOARD_TOKEN in your server .env` in DM Sans 12px, muted

**No dot indicators on Login. No floating logo (it's in the left panel).**

---

### Page 2 — Overview ("The Issue")

**Full-viewport layout — no scroll needed on desktop. Two zones:**

**Zone A — Upper: Hero Stat Spread (100vh or ~60vh minimum)**

Full-bleed `editorial-duo.jpg` behind everything. `object-fit: cover; object-position: center 20%`. A dark gradient overlay: `linear-gradient(135deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.3) 60%, rgba(0,0,0,0.1) 100%)`.

Overlaid content (left-aligned, absolute positioned over image):
- Top-left: section label "THE ISSUE NO. [current month]" in DM Sans 500, 11px, 0.2em tracking, uppercase, white
- Center: Large decorative editorial rule (60px × 1px coral) above the heading
- Heading: "Your Agents." in Playfair Display regular, 6–8rem, white, -0.03em tracking, line-height 0.95
- Below heading: a 2×2 grid of large stat numbers (not cards — just numbers and labels, no box shadows):

```
┌────────────────────────────────┐
│  [n]           [n]             │
│  ACTIONS TODAY  PENDING        │
│                                │
│  [n]           [n]             │
│  AGENTS RUNNING APPROVED       │
└────────────────────────────────┘
```

Each stat: number in Playfair Display regular, 5rem, white. Label in DM Sans 500, 11px, 0.2em, uppercase, rgba(255,255,255,0.7). Count-up animation on page load (0 → final value, 800ms, ease-out).

Coral accent dot (5px, rotated 45° diamond) between each stat group.

Bottom-right of hero: small coral rule (30px) + "SCROLL FOR AGENTS" in DM Sans 500, 10px, 0.25em tracking, uppercase, rgba(255,255,255,0.5). Subtle bounce animation on the down arrow.

**Zone B — Lower: Operator Agents Horizontal Strip**

Background: `--cream` (`#FBF7F4`).

Header row:
- Coral rule (60px × 1px) left-aligned
- Section label: "OPERATOR AGENTS" — DM Sans 500, 11px, 0.2em, uppercase, `--muted`
- Right side: small "11 REPORTING AGENTS ↓" link in DM Sans 500, 11px, 0.2em, uppercase, coral, links down to reporting list

**Horizontal scroll strip — the lookbook row:**

```
overflow-x: auto, scroll-snap-type: x mandatory
display: flex, gap: 20px, padding: 24px 40px
```

Six portrait cards, each `width: 300px, height: 420px, flex-shrink: 0, scroll-snap-align: start, border-radius: 8px, overflow: hidden, background: white, border: 1px solid #E8E8E8, cursor: pointer`.

Each card layout (top to bottom):
1. **Image zone** — `height: 60% (252px)`, `overflow: hidden`. Agent's assigned illustration. `object-fit: cover; object-position: center 20%`. Transition: scale(1.05) on card hover, 400ms.
2. **Info zone** — `height: 40% (168px)`, padding: 20px. Background: white.
   - Agent name in Playfair Display regular, 1.25rem, `--black`, line-height 1.2
   - Status pill (standard — see pill styles)
   - Two mini stats: "12 actions" and "2 pending" in DM Sans 400, 0.8125rem, `--muted`
   - "VIEW STORY →" in DM Sans 500, 0.6875rem, 0.15em tracking, uppercase, coral — appears on hover

**Below the strip:** Typographic masthead list of reporting agents.

Section label: "REPORTING & INTELLIGENCE" — same style as above.

Reporting agents displayed as a magazine masthead: two-column list, no cards, no backgrounds. Each entry:
- Agent label in DM Sans 600, 0.9375rem, `--black`
- Diamond separator (coral ◆)
- Schedule/type in DM Sans 400, 0.8125rem, `--muted`
- A "RUN NOW ▶" inline link in DM Sans 500, 0.75rem, 0.12em tracking, uppercase, coral — on hover only

---

### Page 3 — Social Posts ("The Content Studio")

**Zone A — Asymmetric editorial header:**

```
display: grid, grid-template-columns: 45% 1fr, min-height: 480px
```

Left: `editorial-teal.jpg`. Full bleed, `object-fit: cover; object-position: center 30%`. Slow hover zoom.

Right: white background, padding: 60px.
- Coral rule (60px × 1px), margin-bottom: 24px
- Section label: "CONTENT ENGINE"
- Heading: "The Content Studio" in Playfair Display italic, 3rem, `--black`, -0.02em tracking
- Sub: "Review, approve, and publish content to social channels" in DM Sans 400, 0.9375rem, `--muted`, max-width: 360px
- Below: "▶ GENERATE POSTS NOW" coral button (sharp, 0 radius, uppercase, 14px 28px padding) + schedule note "MON · WED · FRI AT 8:30AM UTC" as section label

**Zone B — Pending Review:**

Section label: "PENDING REVIEW"

Each pending post is an **editorial blockquote card**:

```
background: white, border-radius: 8px, border: 1px solid #E8E8E8
padding: 32px 36px
margin-bottom: 24px
```

Inside:
- Top row: platform badge (monochrome — see Platform Badges) + content type chip (sharp, 1px border, uppercase 11px) + date in DM Sans 400, 0.8125rem, muted — right-aligned
- Post text: in DM Sans 400, 1rem, 1.65 line-height, `--black`, with left border `2px solid #E85D4C`, background `--cream`, padding: 20px 24px. Pre-wrap. Like a pull quote.
- Hashtags: inline pill chips with 1px border, coral text, pill radius
- If image hint present: italic note in muted, 0.8125rem
- Action row: "APPROVE ✓" button (background #D1FAE5, color #065F46, sharp, uppercase) + "REJECT ✗" button (background #FEE2E2, color #991B1B, sharp, uppercase). On approve: card fades out (opacity 0, height collapses, 300ms). On reject: same fade-out. No page reload.

**Zone C — Recent Posts:**

Section label: "RECENT POSTS"

Same card structure as pending, but no action buttons. Status pill (pill-executed or pill-approved) in top row. Slightly reduced opacity (0.8) to signal it's read-only.

---

### Page 4 — Approval Queue ("The Editor's Desk")

**No illustration. Pure typography.**

**Header:**
```
padding-top: 80px, padding-bottom: 56px
border-bottom: 1px solid #E8E8E8
margin-bottom: 40px
```

- Coral rule (60px × 1px), margin-bottom: 24px
- Section label: "HIGH-RISK ACTIONS"
- Title: "The Editor's Desk" in Playfair Display italic, 4rem, `--black`, letter-spacing: -0.02em
- Pending count — displayed dramatically below the title:
  ```
  [n] AWAITING DECISION
  ```
  The number in Playfair Display regular, 6rem, coral, line-height 1.0. "AWAITING DECISION" in DM Sans 500, 11px, 0.2em, uppercase, muted.
- Sub: "Review and approve high-risk agent actions before they execute." DM Sans 400, 0.9375rem, muted, max-width 480px.

**Queue items:**

Each item is a generous card:
```
background: white, border-radius: 8px, border: 1px solid #E8E8E8
padding: 28px 32px
margin-bottom: 20px
```

Structure (top to bottom):
1. Meta row: Risk badge (low/medium/high — pill radius, semantic colors) + agent name in DM Sans 600, 0.875rem, `--black` + timestamp in DM Sans 400, 0.8125rem, muted — right-aligned
2. Action description: DM Sans 400, 1.0625rem, `--black`, line-height: 1.6, margin: 16px 0
3. If payload/details exist: collapsible `<details>` — summary "VIEW DETAILS" in DM Sans 500, 0.75rem, 0.12em tracking, uppercase, coral. Expanded shows JSON or key/value pairs in monospace, `--cream-dark` background, 8px border-radius, 12px 16px padding.
4. Action row: "APPROVE" (green btn-approve) + "REJECT" (red btn-reject) + status pill if already actioned. On approve: card fades and collapses. On reject: same.

**Pagination:** "← PREV PAGE" / "NEXT PAGE →" in DM Sans 500, 0.75rem, uppercase, coral, with coral underline on hover. Centered below list.

---

### Page 5 — Agent Detail ("The Feature Story")

**Zone A — Full-bleed illustration hero:**

```
height: 50vh, min-height: 360px, max-height: 600px
position: relative, overflow: hidden
```

Agent's assigned illustration fills this zone. `object-fit: cover; object-position: center 30%`. Dark gradient overlay on bottom 50%: `linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)`.

Overlaid text (absolute, bottom: 40px, left: 48px):
- Section label: "[AGENT NAME]" in DM Sans 500, 11px, 0.2em, uppercase, rgba(255,255,255,0.65)
- Agent display name in Playfair Display regular, 3.5rem, white, line-height 1.1
- Status pill (inverted — white text, transparent background, 1px white border) to the right of the title or below it
- Coral rule (60px) above the label

**Zone B — Editorial fact sheet:**

```
background: var(--cream), padding: 56px 64px
```

Two-column layout on desktop (60% / 40%):

**Left column — Agent narrative:**
- "ABOUT THIS AGENT" section label
- Description text in DM Sans 400, 1rem, `--charcoal`, line-height 1.7, max-width 560px
- Schedule: "RUNS" section label + schedule value
- Below: Run Now button — coral, sharp, "▶ RUN NOW", padding: 14px 28px

**Right column — Stats sidebar:**
- Coral rule (30px) at top
- Four stat rows (no cards — just label + value):
  ```
  ACTIONS TODAY      [n]
  TOTAL ACTIONS      [n]
  PENDING            [n]
  SUCCESS RATE       [n]%
  ```
  Each: label in DM Sans 500, 11px, 0.2em, uppercase, muted / value in Playfair Display regular, 2rem, `--black`.

**Zone C — Recent action log for this agent:**

Section label: "RECENT ACTIONS"

Table with columns: Action | Status | Risk | Timestamp
Sharp-corner table, no border-radius on cells. Column headers in DM Sans 500, 11px, 0.2em, uppercase, muted. Rows alternate cream/white. Last row has no border.

**Zone D — Toggle:**

Agent enabled/disabled toggle:
```
display: flex, align-items: center, gap: 12px
padding: 20px 0, border-top: 1px solid #E8E8E8, border-bottom: 1px solid #E8E8E8
```
- "AGENT STATUS" section label
- Toggle switch (standard pill toggle, coral when enabled)
- "Enabled" / "Paused" label in DM Sans 400, 0.875rem, `--charcoal`

---

### Page 6 — Action Log ("The Archive")

**No illustration. Pure typographic archive.**

**Header:**
- Same structure as Approval Queue header
- Coral rule → section label "FULL AUDIT TRAIL" → title "The Archive" in Playfair italic, 4rem → sub "Full audit trail of all agent actions and decisions."

**Filter bar:**

```
display: flex, gap: 12px, flex-wrap: wrap, margin-bottom: 32px
```

Three filter selects + apply button:
- Each select: sharp corners (border-radius: 0), 1px border `#E8E8E8`, DM Sans 400, 0.875rem, padding: 10px 16px. White background.
- Filter labels: "All Agents" / "All Statuses" / "All Risk Levels"
- Apply button: coral, sharp, "FILTER", uppercase DM Sans 500, 0.75rem, 0.12em tracking

**Log entries:**

Each entry uses a `<details>` element for expandability:

```
border-bottom: 1px solid rgba(0,0,0,0.06)
padding: 16px 0
```

Summary row (always visible):
```
display: flex, align-items: center, gap: 12px, cursor: pointer
```
- Expand arrow (▶ rotates to ▼ when open)
- Status pill (semantic color, pill radius)
- Risk badge (semantic color, pill radius)
- Agent name in DM Sans 600, 0.875rem, `--black`
- Action description truncated to 1 line in DM Sans 400, 0.875rem, `--charcoal`
- Timestamp right-aligned in DM Sans 400, 0.8125rem, muted

Expanded content (smooth height animation, 200ms):
```
background: var(--cream-dark), border-radius: 8px
padding: 20px 24px, margin: 12px 0 8px
```
- Full action description
- Payload/result in monospace font, 0.8125rem, `--charcoal`
- If approved/rejected: "APPROVED BY ADMIN" or "REJECTED BY ADMIN" section label + timestamp

**Pagination:** Same style as Approval Queue.

---

## 6. Animation & Interaction Specs

### Count-up animation (stat numbers)
```javascript
// On Overview page load, animate each stat from 0 to final value
duration: 800ms
easing: ease-out (cubic-bezier(0, 0, 0.2, 1))
stagger: 150ms between each stat
format: integers only (Math.floor)
```

### Approve / reject fade-out
```css
/* Card removal animation */
@keyframes approveOut {
  0%   { opacity: 1; max-height: 200px; margin-bottom: 20px; }
  60%  { opacity: 0; }
  100% { max-height: 0; margin-bottom: 0; padding: 0; overflow: hidden; }
}
duration: 400ms, easing: ease-in-out
```

### Horizontal strip scroll (agent cards)
- Drag to scroll on desktop (pointer events)
- Scroll-snap: mandatory, align: start
- Thin custom scrollbar: 4px height, `#E8E8E8` track, `#9B9B9B` thumb

### Page indicator dots
- Active dot: scale(1.3), color → `#E85D4C`, transition: 200ms
- Transition between pages: page crossfade 400ms (opacity + translateX ±20px)

### Image hover zoom
- All editorial images: `transition: transform 0.8s ease`
- On hover: `transform: scale(1.04)`

### Scroll-reveal
```css
.reveal {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 500ms ease, transform 500ms ease;
}
.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}
/* Use IntersectionObserver, threshold: 0.15, stagger 80ms per child */
```

---

## 7. Responsive Behavior

| Breakpoint | Change |
|---|---|
| `< 600px` | Single column throughout. Hero image becomes 280px tall. Stat grid: 2×2 but compressed. Agent strip cards: 260×360px. Dot indicators still visible. Login: left panel hidden, form full-width. |
| `600px–900px` | Login split appears. Agent strip scrolls. Overview hero at 50vh. |
| `> 900px` | All full specs as described above. |

**Images on mobile:** Reduce `min-height` of image containers. Keep portrait crop (`object-position: center 20%`).

**Dot indicators on mobile:** Move to bottom-center of viewport, change to horizontal row of dots.

---

## 8. API Reference

All endpoints require `Authorization: Bearer {token}` header.

### Authentication
```
POST /api/admin/auth
Body:  { "token": "string" }
Response: { "ok": true } or { "error": "Invalid token" }
```

### Overview Stats
```
GET /api/admin/stats
Response: {
  "actionsToday": 42,
  "pending": 7,
  "agentsRunning": 4,
  "approved": 38,
  "agents": [
    {
      "name": "lifecycle-email",
      "label": "Lifecycle Email",
      "status": "active",       // "active" | "paused" | "idle"
      "actionsToday": 8,
      "pending": 2,
      "totalActions": 234,
      "schedule": "Daily at 9am UTC",
      "lastRun": "2026-02-24T09:00:00Z"
    }
    // ... 5 more operator agents
  ],
  "reportingAgents": [
    {
      "name": "content-calendar",
      "label": "Content Calendar",
      "schedule": "Weekly on Mondays"
    }
    // ... 10 more
  ]
}
```

### Approval Queue
```
GET /api/admin/actions?status=pending&page=1&limit=10
Response: {
  "items": [
    {
      "id": "uuid",
      "agent": "lifecycle-email",
      "action": "Send re-engagement email to churned segment",
      "risk": "high",           // "low" | "medium" | "high"
      "status": "pending",      // "pending" | "approved" | "rejected" | "executed" | "failed"
      "payload": { ... },
      "createdAt": "2026-02-24T10:30:00Z"
    }
  ],
  "total": 23,
  "page": 1,
  "pages": 3
}

POST /api/admin/actions/{id}/approve
POST /api/admin/actions/{id}/reject
Response: { "ok": true }
```

### Action Log
```
GET /api/admin/actions?agent=&status=&risk=&page=1&limit=20
Response: same shape as approval queue
```

### Social Posts
```
GET /api/admin/social-posts
Response: {
  "pending": [
    {
      "id": "uuid",
      "platform": "twitter",          // "twitter" | "tiktok" | "pinterest"
      "contentType": "founder_story", // see CONTENT_TYPE_LABELS
      "text": "...",
      "hashtags": ["#OrThis", "#OOTD"],
      "imageHint": "Flat lay of summer wardrobe essentials",
      "charCount": 247,
      "charLimit": 280,
      "createdAt": "2026-02-24T08:30:00Z"
    }
  ],
  "recent": [ /* same shape */ ]
}

POST /api/admin/social-posts/{id}/approve
POST /api/admin/social-posts/{id}/reject
POST /api/admin/social-posts/trigger  // trigger manual generation
Response: { "ok": true }
```

### Agent Detail
```
GET /api/admin/agents/{name}
Response: {
  "name": "lifecycle-email",
  "label": "Lifecycle Email",
  "status": "active",
  "enabled": true,
  "description": "Sends lifecycle email sequences to users...",
  "schedule": "Daily at 9am UTC",
  "stats": {
    "actionsToday": 8,
    "totalActions": 234,
    "pending": 2,
    "successRate": 0.94
  },
  "recentActions": [ /* array of action objects */ ]
}

POST /api/admin/agents/{name}/toggle
Body: { "enabled": true }
Response: { "ok": true }

POST /api/admin/agents/{name}/trigger
Response: { "ok": true }
```

### Kill All Agents
```
POST /api/admin/kill-all
Response: { "ok": true }
```

---

## 9. Operator Agents Reference

| Internal name | Display label | Image assignment |
|---|---|---|
| `lifecycle-email` | Lifecycle Email | `editorial-blue.jpg` |
| `conversion-intelligence` | Conversion Intel | `editorial-purple.jpg` |
| `community-manager` | Community Mgr | `editorial-tan.jpg` |
| `social-media-manager` | Social Media | `editorial-orange.jpg` |
| `appstore-manager` | App Store | `editorial-teal.jpg` |
| `outreach-agent` | Outreach | `editorial-sketches.jpg` |

## Reporting Agents (display as typographic masthead list, no images)

Content Calendar · Growth Dashboard · Viral Monitor · Beta Recruiter · Revenue & Cost · AI Quality · Community Weekly · App Store Weekly · Fashion Trends · Calibration · Founder Brief

---

## 10. What NOT to Do

1. **No sidebar.** The sidebar nav is abolished. Navigation is dots only.
2. **No top navigation bar.** Not even a minimal one.
3. **No emoji icons** anywhere in the redesign. Drop all 📧 📈 🤝 📱 ⭐ 📨 icons. The agent names and illustrations carry the visual identity.
4. **No card grid for agents** on Overview. Agents live exclusively in the horizontal portrait strip.
5. **Do not center-crop portrait images in landscape containers.** Use `object-position: center 20–30%` to show faces.
6. **No rounded corners on buttons or inputs.** `border-radius: 0` — editorial sharpness is the rule.
7. **No decorative gradients or glassmorphism effects.** The brand uses clean flat surfaces with editorial illustration photography.
8. **No box shadows on stat numbers in the hero.** Stats float directly over the image without cards.
9. **No Playfair Display Italic outside of** display headings, page titles, pull quotes, and the logo "Or This?".
10. **No status pills on the Overview hero.** Stats are plain: large numbers + small uppercase labels. No colored backgrounds on them.
11. **No color-coded backgrounds** on agent cards (no teal cards, no purple cards). Cards are white or cream only. Color comes from the photographs.
12. **No full-width horizontal rules.** Use the 60px coral accent rule, not a full `<hr>`.
13. **Do not show the Login page in the main navigation dots.** Dots only appear after authentication.
14. **No busy animations.** No particle effects, no background motion. Only image zoom on hover, stat count-up, and card fade-out on approve/reject.
15. **Do not use Tailwind utility classes for typography.** Maintain the custom font tokens above — `font-family: 'Playfair Display'` in CSS, not via Tailwind config CDN shorthand.

---

## 11. Sample Mock Data for Lovable Prototype

```json
{
  "stats": { "actionsToday": 47, "pending": 3, "agentsRunning": 5, "approved": 44 },
  "agents": [
    { "name": "lifecycle-email", "label": "Lifecycle Email", "status": "active", "actionsToday": 12, "pending": 1 },
    { "name": "conversion-intelligence", "label": "Conversion Intel", "status": "active", "actionsToday": 8, "pending": 0 },
    { "name": "community-manager", "label": "Community Mgr", "status": "active", "actionsToday": 6, "pending": 2 },
    { "name": "social-media-manager", "label": "Social Media", "status": "idle", "actionsToday": 3, "pending": 0 },
    { "name": "appstore-manager", "label": "App Store", "status": "active", "actionsToday": 11, "pending": 0 },
    { "name": "outreach-agent", "label": "Outreach", "status": "paused", "actionsToday": 7, "pending": 0 }
  ],
  "pendingActions": [
    { "id": "1", "agent": "lifecycle-email", "action": "Send re-engagement campaign to 847 churned users (30-day inactive)", "risk": "high", "createdAt": "2026-02-24T10:14:00Z" },
    { "id": "2", "agent": "community-manager", "action": "Reply to @fashionweek tweet mentioning Or This?", "risk": "medium", "createdAt": "2026-02-24T09:52:00Z" },
    { "id": "3", "agent": "community-manager", "action": "Post community spotlight thread on Reddit r/femalefashionadvice", "risk": "medium", "createdAt": "2026-02-24T09:30:00Z" }
  ],
  "pendingPosts": [
    {
      "id": "p1",
      "platform": "twitter",
      "contentType": "style_data_drop",
      "text": "Your wardrobe has a personality. Ours analyzed 2.3M outfits last month — turns out 68% of us default to 'safe' when we're stressed. The Or This? challenge: wear something unexpected this week. What happens? 👀",
      "hashtags": ["#OrThis", "#OOTD", "#StyleData"],
      "charCount": 267,
      "charLimit": 280
    }
  ]
}
```

---

*Brief prepared for Or This? dashboard redesign — target platform: Lovable.dev. All images at `/dashboard/images/`. Google Fonts CDN required for Playfair Display + DM Sans.*
