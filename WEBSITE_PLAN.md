# Or This? — Website Redesign Plan

**Date:** February 22, 2026
**Branch:** `claude/resume-website-planning-p4i9J`
**Status:** In Progress

---

## Current State

The existing `orthis-web` site is a functional Next.js landing page with:
- Waitlist signup with referral system
- Basic feature grid (6 cards with emoji icons)
- 3-tier pricing table
- CTA banner
- Footer with legal links and social icons
- Legal pages: Privacy, Terms, Support, Delete Account

**What's missing:** Visual polish, app mockups, social proof, a "how it works" flow, scroll animations, and a design that conveys premium quality matching the brand guidelines.

---

## Redesign Goals

1. **Convey premium quality** — The app has 37 screens and deep features; the website should reflect that ambition
2. **Drive waitlist signups** — Every section should funnel toward the email capture
3. **Show, don't tell** — Use phone mockups and visual demos instead of just text descriptions
4. **Build trust** — Social proof, stats, and polished design signal a real product
5. **Mobile-first** — Most traffic will come from social (TikTok, Instagram); must look great on phones

---

## Section-by-Section Plan

### 1. Navigation (Polish)
- Sticky nav with backdrop blur on scroll
- Logo stays as text-rendered "Or This?"
- Smooth scroll to anchor sections
- Mobile hamburger menu

### 2. Hero Section (Redesign)
- Split layout: text left, phone mockup right (stacked on mobile)
- Headline: "Stop second-guessing your outfits."
- Subtitle with value prop
- Waitlist email form with inline CTA button
- Floating badge: "AI-powered outfit feedback"
- SVG phone frame showing a stylized app screenshot

### 3. "How It Works" Section (New)
- 3-step horizontal flow with numbered circles and connecting lines
  1. **Snap** — Take a photo of your outfit
  2. **Get Feedback** — AI scores your look with detailed tips
  3. **Go Confident** — Walk out knowing you look great
- Clean icons (not emoji) for each step

### 4. Features Section (Enhance)
- 2-column layout with alternating image/text rows (desktop)
- Stacked on mobile
- 6 feature cards with:
  - Custom SVG icons (replacing emoji)
  - Slightly more descriptive copy
  - Subtle hover elevation effect
- Group into two rows of three

### 5. Social Proof Section (New)
- Stats bar: "Join X+ on the waitlist" / "37 app screens built" / "3 feedback modes"
- Placeholder for future testimonial quotes
- Styled as a horizontal band with brand gradient background

### 6. Pricing Section (Polish)
- Card design with more visual hierarchy
- "Most Popular" badge on Plus tier with subtle glow/shadow
- Feature list with checkmark icons
- CTA button on each card linking to waitlist

### 7. Final CTA Section (Polish)
- Full-width gradient banner
- Stronger headline
- Centered email capture form (duplicate of hero form)

### 8. Footer (Redesign)
- 3-column grid: Brand/tagline, Links (Product, Legal), Social
- "Made with love" tagline
- Copyright line

### 9. Visual Assets
- SVG phone frame component (reusable)
- Custom SVG icons for features and "how it works"
- All inline — no external image dependencies

### 10. Animations & Polish
- CSS transitions on card hover (lift + shadow)
- Smooth scroll behavior
- Fade-in on scroll using Intersection Observer
- Sticky nav with background transition

---

## Technical Approach

- **Single file refactor** — All changes in `orthis-web/app/page.tsx` and `orthis-web/app/globals.css`
- **No new dependencies** — Pure CSS animations, Intersection Observer for scroll effects
- **Tailwind classes** — Use the existing theme config (coral, cream, sage, clarity, charcoal)
- **Responsive** — Mobile-first with `sm:` and `lg:` breakpoints
- **SVG inline** — All icons and phone mockup as inline SVG components

---

## File Changes

| File | Action |
|------|--------|
| `orthis-web/app/page.tsx` | Major rewrite — new sections, components, layout |
| `orthis-web/app/globals.css` | Add animation keyframes, scroll behavior, utility classes |
| `orthis-web/tailwind.config.ts` | Minor — add animation config if needed |
| `WEBSITE_PLAN.md` | This file |

---

## Implementation Order

1. Write plan document (this file)
2. Update `globals.css` with animation utilities
3. Rewrite `page.tsx` with all new sections and components
4. Test responsive layout at mobile / tablet / desktop breakpoints
5. Commit and push
