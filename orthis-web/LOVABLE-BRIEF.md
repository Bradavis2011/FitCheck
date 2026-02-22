# Or This? — Lovable Design Brief
## Editorial Overhaul: Vogue, Not SaaS

This document is a complete brief for rebuilding the Or This? landing page. Hand it to Lovable as the sole source of truth. The goal is a page that could stand alone as a reason to join — before the user ever sees the product.

---

## Brand Identity

**Name:** Or This?
**Tagline:** Confidence in every choice.
**Tone:** Editorial. Aspirational. Intimate. Not startup. Not wellness. Fashion-forward GRWM energy — the friend who actually knows clothes, not the app that tells you "you look great!"

### Logo
- "Or" in DM Sans Medium (weight 500), color `#1A1A1A`
- "This?" in Playfair Display Italic, color `#E85D4C` (Decision Coral)
- The `?` is the hero glyph — oversized, italic, coral

### Typography
- **Body:** DM Sans (Google Fonts) — weight 400/500
- **Headlines / Pull Quotes:** Playfair Display Italic (Google Fonts) — weight 400, tight letter-spacing (`-0.02em`)
- **Labels / Buttons:** DM Sans 11px, weight 500, `letter-spacing: 0.2em`, `text-transform: uppercase`

### Color Palette
Use these colors exactly. Do not add others.
- `#E85D4C` — Decision Coral. Used in **exactly 4 places**: Logo "This?", hero "Or this?" text, section 4 divider rule, section 4 em-dashes. **Nowhere else.**
- `#1A1A1A` — Clarity Black. Primary text and backgrounds.
- `#ffffff` — White. All other backgrounds.
- `rgba(255,255,255,0.X)` — White at opacity for text-on-dark sections.

**Do not use:** cream, gradients, sage, rounded corners, shadows, glow effects, border-radius on anything.

---

## Visual Direction

**Archetype:** Vogue editorial spread, not Product Hunt launch card.

**Rules:**
1. All section backgrounds are white (`#ffffff`) or black (`#1A1A1A`). No cream, no gray, no gradient fills.
2. Full-bleed photography everywhere. Real women, real fashion, real emotion. No illustrations, no mockups, no CSS-drawn phones.
3. Headlines are driven by **Playfair Display Italic**, not sans-serif bold. The serif italic IS the visual identity.
4. Zero rounded corners. Inputs are rectangles. Buttons are rectangles. Images are rectangles. Sections are rectangles.
5. Whitespace is aggressive. Pull quotes get 120px+ top/bottom padding. Let it breathe.
6. Coral appears exactly 4 times. It's precious. Saving it for the logo, the hero sub-headline, a 60px rule, and bullet em-dashes.

**Anti-patterns to avoid:**
- Pill buttons
- Gradient hero backgrounds (coral → coral-light)
- Phone mockups (CSS or image)
- "Glowing" cards or frosted glass
- Cream backgrounds (`#FBF7F4`)
- Benefit bullet lists with checkmark circles
- Feature cards with icons

---

## Photography

All images are from Unsplash. Use `next/image` with `fill` prop. Add `source.unsplash.com` and `images.unsplash.com` to `next.config.ts` remotePatterns.

| Placement | Unsplash ID | Description |
|-----------|-------------|-------------|
| Hero (100vh full-bleed) | `R8RWUApHTrA` | Woman trying on dress in front of mirror |
| Section 4 left column | `fneWFi75m2w` | Woman in red blazer striking a pose |
| Grid tall image (left) | `o3Kib4dGawY` | Fashionable woman poses by red phone booth |
| Grid top-right | `g2n7ytb8gjw` | Woman in trench coat leaning on column |
| Grid bottom-right | `DKiUiznse2E` | Woman in black hat and white turtleneck |
| Portrait cinematic (21:9) | `bEJPppcasGc` | Woman in front of mirrors, multiple reflections |

URL format: `https://source.unsplash.com/{ID}`

Hero image should have a slow Ken Burns zoom animation (20s scale 1 → 1.06, alternate infinite).
All editorial images: overflow hidden with slow `scale(1.04)` zoom on hover (0.8s ease transition).

---

## Section-by-Section Layout

### Section 1 — Navigation
**Background:** Transparent on load → white blur on scroll (transition)
**Layout:** Full-width fixed nav, `max-w-6xl` centered, 24px horizontal padding
**Left:** Logo — "Or " (DM Sans) + "This?" (Playfair Italic coral)
**Right:** Single text link "Join" — DM Sans, small, `#1A1A1A`, no button styling, underline on hover
**Scroll behavior:** `backdrop-filter: blur(12px)` + `background: rgba(255,255,255,0.92)` + `border-bottom: 1px solid rgba(0,0,0,0.08)`
**No pill buttons, no coral backgrounds, no box-shadow.**

---

### Section 2 — Hero (Full-Bleed Photography)
**Background:** Full-bleed Unsplash photo `R8RWUApHTrA` covering 100vh
**Overlay:** Dark gradient `linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.25) 50%, rgba(0,0,0,0.55) 100%)`
**Image animation:** Ken Burns — slow 20s `scale(1)` → `scale(1.06)`, alternate, infinite
**Content (centered, white text, `text-align: center`):**
1. Section label (uppercase, 11px, 0.2em tracking): "For everyone who's ever changed three times before leaving" — `rgba(255,255,255,0.5)`
2. H1 Playfair Display Italic, ~80px–96px, white: **"You already know the question."**
3. Sub-headline Playfair Display Italic, ~56px–72px, coral `#E85D4C`: **"Or this?"**
4. Waitlist form (dark variant — see form spec below)

**No badge, no explainer paragraph, no social proof count in this section.**

---

### Section 3 — Pull Quotes
**Background:** White
**Layout:** `max-w-3xl` centered, generous horizontal padding
**Content:** Three pull quotes, one per row, separated by thin 60px × 1px horizontal rules (`rgba(26,26,26,0.15)`)

Each quote:
- Playfair Display Italic
- ~36px–44px
- Color `#1A1A1A`
- Line height 1.2
- Top + bottom padding: ~64px–80px

**The three quotes (verbatim):**
1. *"You tried on four things. Left in the first one anyway. Thought about it all day."*
2. *"You sent the mirror selfie. She said 'cute !!!' You know exactly what that means."*
3. *"You're already there. Already in it. And you can't stop wondering if the other one was better."*

No attribution. No quotation mark decorations. No background cards.

---

### Section 4 — The Answer (Product Reveal)
**Background:** `#1A1A1A` (black)
**Layout:** Full-bleed two-column on desktop, stacked on mobile
- **Left column:** Full-height editorial photo `fneWFi75m2w` (no border, no border-radius, fills entire left half)
- **Right column:** Copy, `px-10 sm:px-16`, centered vertically, `py-20`

**Right column content:**
1. 60px × 1px horizontal rule in coral `#E85D4C` — the only coral in this section (besides em-dashes)
2. Section label (uppercase 11px): "Your phone. Ten seconds. Done." — `rgba(255,255,255,0.4)`
3. H2 Playfair Display Italic ~56px–64px, white: **"It tells you the truth."**
4. Three bullet items (no icons, no checkmarks):
   - Em-dash `—` in coral `#E85D4C` (Playfair Italic), then text in `rgba(255,255,255,0.75)`, ~18px:
   - *— A score out of 10. No sugarcoating.*
   - *— What's working, what isn't, and one thing to fix right now.*
   - *— Keep asking until you're sure. 'Should I swap the shoes?' It doesn't care how many times you ask.*

**No checkmarks, no coral circles, no card backgrounds.**

---

### Section 5 — Editorial Grid
**Background:** White
**Layout:** 2-column CSS grid, gap 16px, `max-w-6xl` centered, `px-6`

**Grid structure:**
- Left: One tall image `o3Kib4dGawY`, spans 2 rows, `min-height: 600px`
  - Has a dark gradient overlay from bottom: `linear-gradient(to top, rgba(0,0,0,0.72), transparent)`
  - Over the gradient: pull quote in Playfair Italic ~28px, white: *"Confidence in every choice."*
- Top-right: Image `g2n7ytb8gjw`, `min-height: 290px`
- Bottom-right: Image `DKiUiznse2E`, `min-height: 290px`

All images: overflow hidden, slow zoom on hover (0.8s ease `scale(1.04)`).
No borders, no radius, no captions.

**Mobile:** Stack all three images vertically, full width.

---

### Section 6 — Early Access (Primary Conversion)
**Background:** `#1A1A1A` (black)
**Layout:** `max-w-5xl` centered, `py-28 sm:py-36`
**Anchor:** `id="waitlist"` — nav "Join" link scrolls here

**Header (centered):**
- Section label (uppercase 11px): "First in gets more" — `rgba(255,255,255,0.4)`
- H2 Playfair Display Italic ~56px–64px, white: **"Join the waitlist now."**
- Subtext DM Sans ~18px: "Your first month of Plus is on us." — `rgba(255,255,255,0.5)`

**Three perks as thin text columns (no cards, no icons, no borders on outside):**
- Separated only by thin left borders: `border-left: 1px solid rgba(255,255,255,0.1)`
- Each column: symbol line (decorative: ∞ / ✦ / ◌) in `rgba(255,255,255,0.2)`, ~28px
- Perk label: DM Sans ~16px, white, font-weight 500
- Perk description: DM Sans ~14px, `rgba(255,255,255,0.4)`

**Perks:**
1. ∞ / "Check as many looks as you want" / "No daily cap."
2. ✦ / "It learns your style over time" / "Gets smarter every use."
3. ◌ / "Keep asking until you're sure" / "No limit on follow-ups."

**Form:** Dark variant waitlist form (see form spec below), `max-w-lg` centered below perks.

---

### Section 7 — Portrait (Cinematic)
**Background:** Full-bleed photo `bEJPppcasGc`
**Aspect ratio:** `21/9` (ultrawide cinematic crop)
**Overlay:** Same dark gradient as hero
**Content (centered):**
- H2 Playfair Display Italic ~56px–72px, white: **"Stop wondering. Start knowing."**

No form. No copy. Just the line.

---

### Section 8 — Final CTA
**Background:** White
**Layout:** `max-w-2xl` centered, `py-28 sm:py-36`, `text-align: center`
**Content:**
- H2 Playfair Display Italic ~56px–64px, `#1A1A1A`: **"Your mirror can't tell you. We can."**
- Body DM Sans ~18px, `rgba(26,26,26,0.5)`: "Join the waitlist. Your first month of Plus is included."
- Light variant waitlist form (see form spec), `max-w-md` centered

---

### Section 9 — Footer
**Background:** White
**Border top:** `1px solid rgba(26,26,26,0.1)`
**Layout:** 3 columns on desktop, stacked on mobile. `max-w-6xl`, `py-14`

Column 1 — Brand:
- Logo
- "Confidence in every choice. Launching 2026 on iOS & Android." — `rgba(26,26,26,0.3)`, 14px

Column 2 — Legal links:
- Privacy Policy, Terms of Service, Support, Delete Account
- 14px, `rgba(26,26,26,0.4)`, hover to `#1A1A1A`

Column 3 — Social icons (X/Twitter, TikTok, Pinterest):
- `rgba(26,26,26,0.2)`, hover to `#1A1A1A`

Copyright bar:
- `border-top: 1px solid rgba(26,26,26,0.1)`
- "© 2026 Or This? All rights reserved." — 12px, `rgba(26,26,26,0.2)`, centered

---

## Waitlist Form Spec

### API
- `POST /api/waitlist`
- Body: `{ email: string, referralCode: string }`
- Response: `{ position: number, referralCode: string, referralLink: string, alreadyJoined?: boolean }`

### Analytics
- Fire `posthog.capture("waitlist_signup", { referral: !!refCode })` on success

### Referral
- Read `?ref=` query param on page load → pre-fill referralCode in request body
- Show "You were invited by a friend — welcome!" below form when ref param present

### Input States
**Idle:** Empty
**Loading:** Button text "Joining..." — input + button disabled
**Success state (replace form entirely):**
  - Headline: "You're on the list!" (or "You're already in!" if `alreadyJoined: true`)
  - Position: "Position #N" — large, below headline
  - Copy: "Share your link — every friend who joins moves you up 5 spots."
  - Referral link display box: transparent bg, thin border, truncated URL + "Copy" button
  - Share buttons (monochrome — NO brand colors): WhatsApp, Post on X, Copy Link
  - All share buttons use same thin-border rectangle style, no green/blue
**Error:** Red error message below form, text only

### Form Styling — Dark Variant (on black sections)
```
Input:
  background: transparent
  border: 1px solid rgba(255,255,255,0.3)
  border-radius: 0
  color: white
  placeholder: rgba(255,255,255,0.5)
  padding: 12px 16px
  font-size: 14px
  focus: border-color rgba(255,255,255,0.7)

Button:
  background: white
  color: #1A1A1A
  border: none
  border-radius: 0
  padding: 12px 24px
  font-size: 11px
  font-weight: 500
  letter-spacing: 0.2em
  text-transform: uppercase
  hover: background #1A1A1A, color white
```

### Form Styling — Light Variant (on white sections)
```
Input:
  background: transparent
  border: 1px solid rgba(0,0,0,0.2)
  border-radius: 0
  color: #1A1A1A
  placeholder: rgba(0,0,0,0.4)
  padding: 12px 16px
  focus: border-color rgba(0,0,0,0.6)

Button:
  background: #1A1A1A
  color: white
  border: none
  border-radius: 0
  padding: 12px 24px
  font-size: 11px
  font-weight: 500
  letter-spacing: 0.2em
  text-transform: uppercase
  hover: background #E85D4C, color white
```

---

## Responsive Requirements

**Mobile (375px):**
- Hero headline: ~48px Playfair Italic
- Pull quotes: ~24px–28px
- Section 4: photo stacks above copy (full width)
- Grid section: 3 images stacked vertically, full width
- Perks: stacked vertically (no column borders)
- Forms: input above button (stacked), full width each

**Tablet (768px):**
- Section 4: remains stacked (switch to side-by-side at 1024px)
- Grid: 2-column maintained

**Desktop (1280px+):**
- All sections as described above
- Section 4: 50/50 split, photo left, copy right
- Grid: tall left image + 2 stacked right images

---

## Scroll Animations

Use IntersectionObserver. Elements with `.fade-in-up` class start at `opacity: 0; transform: translateY(24px)` and transition to `opacity: 1; transform: translateY(0)` over 0.7s ease-out when they enter the viewport (threshold 0.1).

Add `js` class to `<html>` via JS to gate animations (so SSR content is visible without JS).

---

## Social Links
- X/Twitter: https://x.com/OrThisApp
- TikTok: https://www.tiktok.com/@or_this
- Pinterest: https://www.pinterest.com/OrThisApp/

## Legal Links
- /privacy — Privacy Policy
- /terms — Terms of Service
- /support — Support
- /delete-account — Delete Account

---

## What NOT to build
- Phone mockups (CSS or image)
- CSS-drawn app screenshots
- Gradient section backgrounds
- Pill / rounded buttons
- Cream or warm-gray backgrounds
- Checkmark bullet lists with circles
- Feature cards
- Emoji in the UI
- "Social proof" signup counts
- Coral backgrounds (coral is text/accent ONLY, 4 uses max)
