# Or This? Brand Guidelines
## Version 3.0 — SoHo Authority Standard

*This document supersedes v2.1. It is the single source of truth for the Or This? brand system. All prior documents (BRANDING_IMPLEMENTATION.md, STYLING_UPDATES.md, LIGHT_MODE_CHANGES.md) are archived.*

---

## Brand Identity

**Name:** Or This?
**Tagline:** Confidence in every choice.
**Philosophy:** Or This? is a SoHo design studio that happens to live in your phone. The brand delivers verdicts — not suggestions, not encouragement, not endless options. Users trust the score because it comes from an authority, not a friend. Every design decision, every word, every interaction earns its place or is removed.

### Brand Essence

| Attribute | Description |
|-----------|-------------|
| **Decisive** | One answer, delivered without hesitation |
| **Direct** | Honest, never dismissive |
| **Confident** | States the verdict, doesn't hedge |
| **Discerning** | Sees what works and names it precisely |

---

## Logo

### Construction
- **"Or"** — DM Sans Medium (weight 500), `#1A1A1A`
- **"This?"** — Playfair Display Italic (weight 400, italic), `#E85D4C` (Decision Coral)
- The `?` is the hero glyph — oversized, italic, coral

### App Icon Mark
- 36×36px square (border-radius: 0 — sharp)
- Background: `#E85D4C` (flat coral, no gradient)
- Content: Playfair Display Italic `?`, white, ~1.1rem

### Logo Rules
- Never separate "Or" and "This?" — they are one mark
- Never apply the logo to a coral background (it will disappear)
- Minimum size: 80px width

---

## Color Palette

### Exact Tokens

| Token | Hex | Name |
|-------|-----|------|
| `--coral` | `#E85D4C` | Decision Coral |
| `--coral-dark` | `#C94A3A` | Hover/active states |
| `--coral-light` | `#FF7A6B` | Rarely used (gradient on share card only) |
| `--cream` | `#FBF7F4` | Studio Linen — app/dashboard backgrounds |
| `--cream-dark` | `#F5EDE7` | Card backgrounds, alternating sections |
| `--black` | `#1A1A1A` | Editorial Black — all primary text |
| `--charcoal` | `#2D2D2D` | Secondary text |
| `--muted` | `#9B9B9B` | Labels, captions, timestamps |
| `--border` | `rgba(0,0,0,0.08)` | All dividers (transparent) |
| `--border-solid` | `#E8E8E8` | Solid borders on cards/inputs |
| `--surface` | `#FFFFFF` | Card backgrounds, form panels |

> **Token name rationale:** "Studio Linen" frames the warm off-white as a deliberate material choice — intentional, tactile, editorial — rather than an emotional state. "Editorial Black" aligns primary text with the authority positioning.

**Semantic (functional only — never decorative):**
| Token | Hex | Use |
|-------|-----|-----|
| `--success` | `#10B981` | Score ≥ 8 — text color only, never background |
| `--warning` | `#F59E0B` | Score 6–7 — text color only, never background |
| `--error` | `#EF4444` | Score < 6 — text color only, never background |

### Color Usage Rules

**By surface:**

| Surface | Background | Rules |
|---------|-----------|-------|
| **Website** | `#FFFFFF` (white) or `#1A1A1A` (black) only | No cream. No gradient fills. |
| **App** | `#FBF7F4` (Studio Linen) | Cards on `#FFFFFF`. Coral accent only. |
| **Dashboard** | `#FBF7F4` (Studio Linen) | Same as app. |

**Coral discipline:**
- On the **website**: coral appears in exactly 4 places — logo "This?", hero sub-headline, one 60px rule, bullet em-dashes. Nowhere else.
- On the **app/dashboard**: coral is used freely for CTAs, interactive states, and the 60px rule accent. Never as a solid background fill over large areas.

**Do NOT use:**
- Gradient backgrounds (coral → coral-light) on any section
- `#FBF7F4` cream on the website
- Sage (`#A8B5A0`, `#C4CFBD`) for anything new — legacy only

---

## Typography

### Font Stack

| Role | Font | Google Fonts ID |
|------|------|----------------|
| Body / UI | DM Sans | `DMSans_400Regular`, `DMSans_500Medium`, `DMSans_600SemiBold`, `DMSans_700Bold` |
| Display / Editorial | Playfair Display | `PlayfairDisplay_400Regular`, `PlayfairDisplay_400Regular_Italic` |

### Usage Rules (strict)

| Use Case | Font | Style |
|----------|------|-------|
| **Logo "Or"** | DM Sans | Weight 500 |
| **Logo "This?"** | Playfair Display | Italic — the ONLY place serifItalic is used for the logo |
| **Screen titles, pull quotes, score numbers** | Playfair Display | Regular (not italic) |
| **Page display headlines** | Playfair Display | Regular or Italic (editorial discretion) |
| **Section labels** | DM Sans | Weight 500, 11px, UPPERCASE, 0.2em letter-spacing |
| **Button labels** | DM Sans | Weight 500, 12px, UPPERCASE, 0.12–0.165em letter-spacing |
| **Body text** | DM Sans | Weight 400, 15px |
| **Captions** | DM Sans | Weight 400, 13px |
| **Stats/data** | DM Sans Bold | Numbers that represent UI data (not editorial) |

### Type Scale (app)

| Token | Font | Size | Weight | Use |
|-------|------|------|--------|-----|
| Screen title | Playfair Display Regular | 30px | 400 | Tab screen headers ("Archive", "Profile") |
| Score number | Playfair Display Regular | 56px | 400 | Score overlay on feedback screen |
| Pull quote | Playfair Display Italic | 17px | 400 | Editorial summary |
| Section label | DM Sans Medium | 11px | 500 | All section headers, UPPERCASE, 2.2 tracking |
| Card title | DM Sans SemiBold | 16px | 600 | Card headings |
| Body | DM Sans Regular | 15px | 400 | Primary body text |
| Caption | DM Sans Regular | 13px | 400 | Secondary info |
| Button | DM Sans Medium | 12px | 500 | All buttons, UPPERCASE |

---

## Border Radius

### Rules by Surface

| Element | Radius | Notes |
|---------|--------|-------|
| Buttons | `0px` | All CTAs, primary, secondary, ghost |
| Inputs | `0px` | Text fields, email inputs, selects |
| Chips / Tags / Filter pills | `0px` | All interactive tags |
| Image containers | `4px` | Barely rounded — softens photo edges only |
| Cards | `8px` | Content cards, list items |
| Toggle switches | `9999px` | Standard mobile pill — exception per platform convention |
| Avatars | `9999px` | Circular — exception per platform convention |
| Status pills | `9999px` | Small inline status badges — exception |

**The editorial rule:** If it's interactive (button, input, chip), it's sharp (0px). If it holds content (card), it's 8px. If it's circular by convention (toggle, avatar), it's pill.

**Anti-patterns (never do):**
- 100px pill buttons
- 24px card radius
- Box shadows on cards
- `border-radius` on anything labeled "CTA" or "primary button"

---

## Score Presentation

**The score is a verdict, not a metric.** It is delivered typographically — the number alone carries authority. No colored badges, no dashboard indicators, no background containers. The score color is applied to the text itself, not to a shape around it.

### Score Display Rules

| Context | Spec |
|---------|------|
| **OutfitCard (grid/list)** | Playfair Display 400, 18px, score-colored text. Top-right corner, directly on image. `text-shadow: 0 1px 4px rgba(0,0,0,0.5)` for readability. No circle, no background. |
| **Feedback hero** | Playfair Display 400, 56px, score-colored text. Overlaid on full-bleed image inside bottom gradient. `text-shadow: 0 2px 8px rgba(0,0,0,0.4)`. No circle, no badge. |
| **"/10" suffix (hero)** | DM Sans 400, 18px, white at 50% opacity, baseline-aligned. Subordinate to the number. |

### What's Removed
- Colored circle backgrounds on score badges
- Score inside a colored `<View>` with any background
- Dashboard-style meter indicators

### ScoreReveal Animation
The cinematic reveal sequence (scan → pause → digit lock → pulse, ~4.5s total) is the reference standard for motion design in this app. It is already correctly implemented. It is documented here as the canonical motion pattern — see Motion Philosophy section for the governing principles.

---

## Editorial Motifs

### The Coral Rule
A 60px wide × 1px tall `#E85D4C` horizontal bar. Used above section labels and page titles as a typographic accent. Never full-width. Never decorative without purpose.

### Section Labels
`DM Sans 500 · 11px · UPPERCASE · letter-spacing 0.2em · color #9B9B9B`

Pattern:
```
[60px coral rule]
SECTION LABEL
```

### Diamond Mark
A 5×5px coral square rotated 45°, used as a separator between items in typographic lists.

### Dividers
- Full-width: `1px solid rgba(0,0,0,0.08)` — between sections
- Editorial rule: `60px × 1px #E85D4C` — above section labels only
- Card rule: `width: 60px, height: 1px, rgba(0,0,0,0.12)` — inside cards

---

## Vertical Rhythm & Luxury Spacing

**The space between sections is a design element.** Generous vertical rhythm signals confidence — the brand isn't cramming features into a viewport, it's presenting a curated experience. Compression reads as anxiety. Space reads as authority.

| Context | Minimum Vertical Spacing |
|---------|------------------------|
| Between major sections (home screen blocks) | 48px |
| Between section label and content | 16px |
| Between cards in a list | 12px |
| Screen top padding (below header) | 32px |
| Screen bottom padding (above tab bar) | 48px |
| Inside cards | 24px padding all sides |
| Screen horizontal margins | 24px |

**Never compress vertical rhythm to fit more content.** If a screen feels crowded, remove an element — don't reduce spacing.

---

## Motion Philosophy

**Deliberate. Single-beat. Never bouncy.**

Every animation should feel like a single decisive gesture — a page turning, a curtain drawing, a verdict landing. The motion matches the brand: confident, unhurried, precise. Springs are reserved for physical interactions (pull-to-refresh, gesture-driven movement). UI transitions use timing curves.

| Pattern | Animation | Duration |
|---------|-----------|----------|
| Score reveal | Cinematic sequence (scan → pause → digit lock → pulse) | 4.5s |
| Card entrance | Fade + subtle upward translate | 300–400ms |
| Screen transition | Timing curve, ease-out | 250ms |
| Button press | Scale 0.97, timing (not spring) | 100ms |
| Section reveal | Staggered fade-in, 150ms delay between items | 300ms each |

**Anti-patterns:**
- Bounce/overshoot springs on buttons or cards
- Parallax scrolling effects
- Loading spinners — use the branded "?" mark or scan line instead
- Confetti or particle effects beyond the documented ScoreCelebration spec

---

## Restraint

**If an element doesn't earn its place, it doesn't exist.**

The default state of the UI is silence. Elements are added only when they have something specific to say — not to reassure, not to fill space, not to appear helpful.

- Empty states are invitations, not error pages. "Nothing yet." is sufficient.
- Loading states are part of the brand experience — the scan line, the "?" mark, the analysis phrases are the product.
- Tooltips, info icons, and helper text are removed before they're added. If something requires explanation, the design is not clear enough.
- Onboarding coach marks, tutorial overlays, and feature announcements are earned, not assumed.
- The UI defaults to showing the verdict. Navigation back to it is always one tap.

---

## Voice & Tone

Or This? speaks like a SoHo stylist who charges $400/hour — direct, specific, and worth every word. The app doesn't validate you. It sees you clearly.

**The score IS the verdict.** It is delivered without apology, cushioning, or warm-up.

### Voice Principles
1. **Declarative, not validating.** State what IS, not how you feel about it.
2. **Specific, not vague.** Name the garment, the proportion, the color relationship.
3. **Brief.** Authority doesn't over-explain. One sentence that's right is worth more than three that hedge.
4. **The score arrives first.** The explanation follows. Never the other way around.

### Do ✓
- "The proportions carry this. Clean choice."
- "Strong color story. The hem is the one edit."
- "This works because the silhouette is doing all the heavy lifting."
- "Not there yet. The layering is competing — simplify by one piece."
- "Both work. The left reads sharper for the occasion."
- Direct, editorial pull-quote language: *"A look that knows what it's doing."*

### Don't ✗
- "You've got this!"
- "This silhouette is *chef's kiss*"
- "Trust your instincts — you picked a winner"
- "Both are gorgeous — here's why one might work better…"
- "Amazing!" / "Great!" — positivity bias without specificity
- Clinical language that dismisses without directing
- Excessive emoji strings
- "Almost there!" — frame interactions as editorial, not SaaS progress

### UI Copy Standards
- "Set the scene" or "Context" — not "Almost there!"
- "Archive" — not "History" or "Your looks"
- "Verdict" — not "check" or "result"
- "2 of 3 remaining" — not "2/3 checks remaining today"
- "GET VERDICT" — not "CHECK MY OUTFIT"
- Section titles on context screens: Playfair Regular (editorial), not DM Sans Bold (SaaS)

### Emoji Usage
Not used in UI labels, section headers, or feedback cards. Selective use in social/marketing copy only when intentional.

---

## Photography

Photography in Or This? serves two distinct purposes with different standards.

### Brand Photography
*(Marketing, onboarding, empty states, lookbook strips)*

- Constructed editorial: deliberate lighting, intentional composition, studio or location shoots
- Portrait orientation, cropped decisively — clothes are the subject, not the person's personality
- Styling is considered and complete — every element of the frame earns its place
- Color grade is clean and slightly warm — not filtered, not social
- References: The Row lookbooks, Bottega Veneta campaigns, COS editorials
- No candid-style staging (coffee cups, laughing mid-step, "lifestyle" props)

### User Content
*(Submitted outfit photos)*

- Accepted as-is — the app's value is in the verdict, not the photography
- No photography coaching in the UI — do not instruct users on how to take photos
- The app treats every submission with the same editorial seriousness regardless of photo quality
- The verdict elevates the photo; the photo doesn't need to earn the verdict

---

## Component Patterns

### Buttons

**Primary CTA**
```
background: #E85D4C
color: #FFFFFF
border-radius: 0
font: DM Sans 500, 12px, UPPERCASE, 1.65 letter-spacing
padding: 16px vertical, 24px horizontal (full-width preferred)
```

**Secondary / Outline**
```
background: transparent
border: 1px solid #E85D4C
color: #E85D4C
border-radius: 0
font: DM Sans 500, 12px, UPPERCASE
```

**Ghost**
```
background: transparent
border: 1px solid rgba(0,0,0,0.1)
color: #1A1A1A
border-radius: 0
```

### Cards
```
background: #FFFFFF
border-radius: 8px
border: 1px solid rgba(0,0,0,0.06)
padding: 24px
NO box-shadow
```

### FeedbackCard
```
Section label: DM Sans 500, 11px, UPPERCASE, 2.2 tracking
Coral rule: 60px × 1px
Bullet prefix: +, –, ↑ in DM Sans SemiBold
NO emoji, NO color bar, NO colored icon
```

### Score Display
```
Score number: Playfair Display Regular, 56px (hero) / 18px (card)
/10 suffix: DM Sans Regular, 18px, 50% opacity (hero only)
Color: score-colored TEXT — green ≥8, amber ≥6, red <6
Container: NONE — no circle, no badge, no background
text-shadow: 0 2px 8px rgba(0,0,0,0.4) for readability on images
```

### Context Input Screen
The context screen is an editorial brief, not a form.

```
Header: "Set the scene." in Playfair Display 400 Regular, 24px, centered
Section titles: Playfair Regular (editorial) — not DM Sans Bold
Chips: 0px radius, DM Sans 500, 11px, UPPERCASE, 1px border
Active chip: coral fill, white text
Bottom bar: "2 of 3 remaining" left (muted) + "GET VERDICT" CTA right
```

**What this screen does NOT include:**
- "Almost there!" — any progress-gamification framing
- Weather selector (adds form bloat without verdict value)
- Vibe selector (subjective — authority doesn't ask for vibes)
- Share visibility toggle (belongs post-verdict)
- Accordion pattern (everything visible, nothing hidden)

---

## App Design System

### Layout Principles

1. **Sharp geometry.** 0px radius on all interactive elements. The editorial sharpness is the brand.
2. **Generous rhythm.** 48px minimum between major sections. Space signals confidence.
3. **Studio Linen over white** for backgrounds. `#FBF7F4` is the base. `#FFFFFF` is for cards only.
4. **Coral is precious.** Never fill large areas with coral. CTAs and accents only.
5. **No shadows.** Cards are defined by borders (`rgba(0,0,0,0.06)`), not shadows.
6. **Typography carries authority.** Scores, titles, and verdicts are typographic — not iconographic.

### Tab Bar (3 tabs)
- Home / Camera (elevated) / Archive
- **Profile is accessed via the circular avatar in the home screen header — not a tab**
- Community tab hidden (`href: null`) until user base grows
- Profile tab hidden (`href: null`) — accessed via header avatar

### Screen Header Pattern
```
[Playfair Display Regular title, 30px]
[1px divider]
[Content]
```

### Share Card (ShareableScoreCard)
- 400×600px PNG for social sharing
- Coral gradient background (exception — image is the brand's ad unit)
- Logo using correct fonts: "Or" in DM Sans Medium, "This?" in Playfair Italic
- Score number in Playfair Display Regular
- URL footer: `orthis.app` in DM Sans Medium UPPERCASE

---

## Website Design System

See `orthis-web/LOVABLE-BRIEF.md` for the full spec. Key rules that differ from app:

- **Backgrounds:** `#FFFFFF` (white) or `#1A1A1A` (black) ONLY. No cream.
- **Border radius:** 0px on everything without exception.
- **Coral uses:** Exactly 4 — logo "This?", hero sub-headline, one 60px rule, em-dashes.
- **No pill buttons, no gradient backgrounds, no shadows, no rounded corners.**
- **Photography:** Full-bleed editorial photography everywhere. No CSS mockups.

---

## What NOT to Do

1. **No pill buttons.** `border-radius: 100px` on any CTA is wrong.
2. **No gradient hero backgrounds.** Coral → coral-light as a section fill is wrong.
3. **No card shadows.** Box shadows on content cards are wrong.
4. **No cream backgrounds on the website.** `#FBF7F4` is for the app/dashboard only.
5. **No rounded corners on inputs or buttons.** Sharp is editorial.
6. **No feature cards with icon circles.** Pure typographic lists instead.
7. **No emoji in UI labels or section headers.** Voice copy only.
8. **No Playfair Display Italic outside** the logo "This?", display headlines, and editorial pull quotes.
9. **No "Generous Radius" principle.** This is from v1.0 and is wrong. The current principle is "Editorial Sharp."
10. **No full-width horizontal rules.** Use the 60px coral accent rule, not a full `<hr>`.
11. **No colored backgrounds on scores.** Scores are typography-only. The number IS the verdict.
12. **No validating language.** "You've got this!" and "chef's kiss" are not Or This? voice.
13. **No compression of vertical spacing.** If a screen is crowded, remove an element — don't tighten margins.
14. **No spring animations on UI elements.** Springs are for physical gestures only.
15. **No "Almost there!" framing.** Context input is an editorial brief, not an onboarding funnel.

---

## Archived Documents

The following documents are superseded and archived in `docs/archive/`:
- `BRANDING_IMPLEMENTATION.md` — one-time rebrand changelog (Feb 2026)
- `STYLING_UPDATES.md` — Lovable vs React Native comparison (Feb 2026)
- `LIGHT_MODE_CHANGES.md` — dark-to-light migration notes (Feb 2026)

---

## Source Documents

| Document | Location | Scope |
|----------|----------|-------|
| Website brief | `orthis-web/LOVABLE-BRIEF.md` | Website only (strictest: no cream, 0px everything) |
| Dashboard brief | `fitcheck-api/public/dashboard/REDESIGN-BRIEF.md` | Admin dashboard |
| App theme | `fitcheck-app/src/constants/theme.ts` | App code — source of truth for tokens |

---

*Last updated: March 2026*
*Version 3.0 — SoHo Authority Standard*
