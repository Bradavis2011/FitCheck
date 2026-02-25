# Or This? Brand Guidelines
## Version 2.0 — Editorial Standard

*This document supersedes v1.0. It is the single source of truth for the Or This? brand system. All prior documents (BRANDING_IMPLEMENTATION.md, STYLING_UPDATES.md, LIGHT_MODE_CHANGES.md) are archived.*

---

## Brand Identity

**Name:** Or This?
**Tagline:** Confidence in every choice.
**Philosophy:** Editorial, not SaaS. Vogue, not Product Hunt. The brand speaks like a fashion magazine — restrained, confident, and authoritative. Every design decision earns its place.

### Brand Essence

| Attribute | Description |
|-----------|-------------|
| **Decisive** | Clear answers, not endless scrolling |
| **Warm** | Supportive, not judgmental |
| **Confident** | Bold recommendations, not hedging |
| **Real** | Honest feedback, not flattery |

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
| `--coral-light` | `#FF7A6B` | Rarely used (gradient only) |
| `--cream` | `#FBF7F4` | Confidence Cream — app/dashboard backgrounds |
| `--cream-dark` | `#F5EDE7` | Card backgrounds, alternating sections |
| `--black` | `#1A1A1A` | Clarity Black — all primary text |
| `--charcoal` | `#2D2D2D` | Secondary text |
| `--muted` | `#9B9B9B` | Labels, captions, timestamps |
| `--border` | `rgba(0,0,0,0.1)` | All dividers (transparent) |
| `--border-solid` | `#E8E8E8` | Solid borders on cards/inputs |
| `--surface` | `#FFFFFF` | Card backgrounds, form panels |

**Semantic (functional only — never decorative):**
| Token | Hex | Use |
|-------|-----|-----|
| `--success` | `#10B981` | Score ≥ 8, positive states |
| `--warning` | `#F59E0B` | Score 6–7, streaks |
| `--error` | `#EF4444` | Score < 6, errors |

### Color Usage Rules

**By surface:**

| Surface | Background | Rules |
|---------|-----------|-------|
| **Website** | `#FFFFFF` (white) or `#1A1A1A` (black) only | No cream. No gradient fills. |
| **App** | `#FBF7F4` (cream) | Cards on `#FFFFFF`. Coral accent only. |
| **Dashboard** | `#FBF7F4` (cream) | Same as app. |

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

## Component Patterns

### Buttons

**Primary CTA**
```
background: #E85D4C
color: #FFFFFF
border-radius: 0
font: DM Sans 500, 12px, UPPERCASE, 1.65 letter-spacing
padding: 14px vertical, 24px horizontal (full-width preferred)
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
NO emoji, NO color bar, NO icon
```

### Score Display
```
Score number: Playfair Display Regular, 56px
/10 suffix: DM Sans Regular, 18px
Color: semantic (green ≥8, amber ≥6, red <6)
Position: overlaid on full-bleed hero image
```

---

## App Design System

### Layout Principles

1. **Sharp geometry.** 0px radius on all interactive elements. The editorial sharpness is the brand.
2. **Confident whitespace.** Generous padding, 24px minimum horizontal margins.
3. **Cream over white** for backgrounds. `#FBF7F4` is the base. `#FFFFFF` is for cards only.
4. **Coral is precious.** Never fill large areas with coral. CTAs and accents only.
5. **No shadows.** Cards are defined by borders (`rgba(0,0,0,0.06)`), not shadows.

### Tab Bar (4 tabs)
- Home / Camera (elevated) / Archive / Profile
- Community tab hidden (`href: null`) until user base grows

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

## Voice & Tone

Or This? speaks like your most stylish, supportive friend — someone who tells you the truth but always makes you feel good about yourself.

### Do ✓
- "You've got this!"
- "Both are gorgeous — here's why one might work better…"
- "This silhouette is *chef's kiss*"
- "Trust your instincts — you picked a winner"
- Direct, editorial pull-quote language: *"Confidence comes from knowing."*

### Don't ✗
- "This outfit is wrong"
- "You should probably change…"
- "Not flattering"
- Clinical language without warmth
- Excessive emoji strings
- "Amazing!" / "Great!" positivity bias — be honest and specific

### Emoji Usage
Selective. Preferred in social/marketing contexts only: 🔥 ✨ 💫 👏
Not used in UI labels, section headers, or feedback cards.

---

## Photography Style

- Natural lighting, slightly warm color grade
- Real bodies, diverse representation
- Authentic moments (getting ready, mirror selfies, walking out the door)
- Portrait orientation preferred for editorial use
- No heavy filters or dramatic editing

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

*Last updated: February 2026*
*Version 2.0*
