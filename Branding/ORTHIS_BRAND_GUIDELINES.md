# OrThis? Brand Guidelines

## Brand Overview

**OrThis?** is an AI-powered outfit feedback app that transforms the daily "does this work?" moment into instant confidence. The brand captures the split-second of decision, the warmth of trusted advice, and the satisfaction of walking out knowing you nailed it.

### Tagline
**Confidence in every choice**

### Brand Essence
| Attribute | Description |
|-----------|-------------|
| **Decisive** | Clear answers, not endless scrolling |
| **Warm** | Supportive, not judgmental |
| **Confident** | Bold recommendations, not hedging |
| **Real** | Honest feedback, not flattery |

---

## Logo

### Primary Logo
The OrThis? logo pairs two typefaces to create meaningful tension:

- **"Or"** — DM Sans Medium, representing the practical, everyday nature of getting dressed
- **"This?"** — Playfair Display Italic, representing personal style, elegance, and confidence

### The Question Mark
The oversized, italicized question mark is the soul of the brand:
- Represents the moment of decision
- Embodies curiosity and exploration
- Invites users to ask for feedback
- Forward-leaning italic suggests momentum and confidence

### Logo Variations
1. **Full Logo** — Primary use for marketing, headers, splash screens
2. **Wordmark** — Logo without tagline for compact spaces
3. **App Icon Mark** — Question mark only, coral gradient background

### Clear Space
Maintain minimum clear space equal to the height of the question mark around all sides of the logo.

### Minimum Sizes
- Full Logo: 120px width minimum
- Wordmark: 80px width minimum
- App Icon: 44px minimum (iOS/Android guidelines)

---

## Color Palette

### Primary — Decision Coral
The hero color. Used for CTAs, emphasis, and brand recognition.

| Name | Hex | Usage |
|------|-----|-------|
| Decision Coral | `#E85D4C` | Primary buttons, logo accent, emphasis |
| Coral Light | `#FF7A6B` | Gradients, hover states, highlights |
| Coral Dark | `#C94A3A` | Active/pressed states, depth |

**Why Coral?**
Coral sits between red's confidence and orange's warmth. It's energetic without being aggressive, feminine without being limiting. It photographs well, stands out in app stores, and creates an emotional connection that feels both exciting and supportive.

### Neutrals — Confidence Cream & Clarity Black

| Name | Hex | Usage |
|------|-----|-------|
| Confidence Cream | `#FBF7F4` | Primary backgrounds |
| Cream Dark | `#F5EDE7` | Cards, sections, subtle division |
| Clarity Black | `#1A1A1A` | Primary text, icons |
| Charcoal | `#2D2D2D` | Secondary text |
| Gray 400 | `#9B9B9B` | Placeholder text, captions |
| Gray 200 | `#E8E8E8` | Borders, dividers |

### Accent — Soft Sage

| Name | Hex | Usage |
|------|-----|-------|
| Soft Sage | `#A8B5A0` | Success states, verified badges |
| Sage Light | `#C4CFBD` | Tags, subtle backgrounds |

### Gradients
Primary gradient for buttons and app icon:
```css
background: linear-gradient(135deg, #E85D4C 0%, #FF7A6B 100%);
```

Dark mode gradient:
```css
background: linear-gradient(135deg, #2D2D2D 0%, #1A1A1A 100%);
```

---

## Typography

### Display Font — Playfair Display
Used for headlines, the logo, and moments of emphasis.

**Weights:** 600 (Semibold), 700 (Bold)
**Style:** Italic preferred for headlines

```css
font-family: 'Playfair Display', Georgia, serif;
```

### Body Font — DM Sans
Used for body text, UI elements, buttons, and navigation.

**Weights:** 400 (Regular), 500 (Medium), 600 (Semibold)

```css
font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
```

### Type Scale

| Style | Font | Size | Weight | Use Case |
|-------|------|------|--------|----------|
| H1 / Hero | Playfair Display Italic | 48px | 600 | Hero headlines |
| H2 / Section | Playfair Display Italic | 32px | 600 | Section titles |
| H3 / Card | Playfair Display Italic | 24px | 600 | Card headers |
| Body Large | DM Sans | 18px | 500 | Intro paragraphs |
| Body | DM Sans | 16px | 400 | Primary body text |
| Small | DM Sans | 14px | 400 | Secondary info |
| Caption | DM Sans | 12px | 600 | Labels, timestamps |

### Line Heights
- Headlines: 1.1–1.2
- Body text: 1.5–1.7
- Captions: 1.4

---

## UI Components

### Buttons

**Primary Button**
- Background: Coral gradient
- Text: White, DM Sans 600
- Border radius: 100px (pill shape)
- Shadow: `0 4px 20px rgba(232, 93, 76, 0.3)`
- Padding: 12px 24px (medium), 16px 32px (large)

**Secondary Button**
- Background: White
- Text: Coral
- Border: 2px solid Coral
- Border radius: 100px

**Ghost Button**
- Background: Transparent
- Text: Clarity Black
- No border

### Cards
- Background: White (`#FFFFFF`)
- Border radius: 24px
- Shadow: `0 8px 40px rgba(0, 0, 0, 0.08)`
- Padding: 24–32px

### Tags & Badges
- Border radius: 100px (pill)
- Padding: 6px 14px
- Font: DM Sans 500, 13px

**Occasion tags:** Cream Dark background, Charcoal text
**Verified badge:** Sage Light background, dark sage text
**Trending badge:** Coral gradient background, white text

### Voting Interface
The core A/B comparison interface:
- Two outfit images side by side
- "or" connector in Playfair Display Italic
- Selected choice highlighted with coral border
- Percentage indicator pill below selected image

---

## Design Principles

### 1. Generous Radius
Soft, rounded corners (16–24px for containers, 100px for buttons) feel approachable and modern. Avoid sharp corners except for specific editorial moments.

### 2. Confident Whitespace
Let content breathe. Generous padding creates hierarchy and reduces visual stress. When in doubt, add more space.

### 3. Subtle Depth
Soft shadows and layering create hierarchy without harsh borders. Cards should float gently above backgrounds, not cast heavy shadows.

### 4. Warm Over Cool
Default to cream/warm white backgrounds rather than pure white or cool grays. The palette should feel inviting, not clinical.

### 5. Motion With Purpose
Animations should reinforce the "decision" narrative:
- Quick, confident transitions (200–300ms)
- Subtle scaling on selection
- Smooth reveals, not bouncy distractions

---

## App Icon

### Design
- Background: Coral gradient (135°, #E85D4C → #FF7A6B)
- Mark: Playfair Display Italic question mark, white
- Border radius: iOS/Android standard (continuous corners)

### Sizes Required
- 1024×1024 (App Store)
- 180×180 (iPhone)
- 120×120 (iPad)
- 512×512 (Google Play)
- 48×48, 72×72, 96×96 (Android variants)

---

## Voice & Tone

### Personality
OrThis? speaks like your most stylish, supportive friend—someone who tells you the truth but always makes you feel good about yourself.

### Do ✓
- "You've got this!"
- "Both are gorgeous—here's why one might work better..."
- "The community has spoken 🔥"
- "This silhouette is *chef's kiss*"
- "Trust your instincts—you picked a winner"

### Don't ✗
- "This outfit is wrong"
- "You should probably change..."
- "Not flattering"
- "Are you sure about that?"
- Clinical language without warmth

### Emoji Usage
Selective and purposeful. Preferred emojis:
- 🔥 (trending/hot take)
- ✨ (confidence/glow)
- 💫 (magic moment)
- 👏 (community approval)

Avoid excessive emoji strings or childish tones.

---

## Photography & Imagery

### Style
- Natural lighting, slightly warm color grade
- Real bodies, diverse representation
- Authentic moments (getting ready, mirror selfies, walking out the door)
- Avoid overly posed or editorial fashion photography

### Image Treatment
- Slight warmth (+5-10% temperature)
- Soft contrast
- Avoid heavy filters or dramatic editing

---

## Social Media

### Profile Picture
App icon mark (question mark on coral gradient)

### Cover Images
- Hero photography with logo overlay
- Or solid coral background with white wordmark

### Post Templates
- Maintain cream/white backgrounds
- Use coral for emphasis
- Playfair Display for headlines
- Clean, generous whitespace

---

## Downloads & Assets

### Fonts
- [Playfair Display](https://fonts.google.com/specimen/Playfair+Display)
- [DM Sans](https://fonts.google.com/specimen/DM+Sans)

### Color Tokens (CSS Variables)
```css
:root {
  --color-coral: #E85D4C;
  --color-coral-light: #FF7A6B;
  --color-coral-dark: #C94A3A;
  --color-cream: #FBF7F4;
  --color-cream-dark: #F5EDE7;
  --color-black: #1A1A1A;
  --color-charcoal: #2D2D2D;
  --color-sage: #A8B5A0;
  --color-sage-light: #C4CFBD;
  --color-white: #FFFFFF;
  --color-gray-100: #F8F8F8;
  --color-gray-200: #E8E8E8;
  --color-gray-400: #9B9B9B;
  --color-gray-600: #666666;
  
  --gradient-coral: linear-gradient(135deg, #E85D4C 0%, #FF7A6B 100%);
  --gradient-dark: linear-gradient(135deg, #2D2D2D 0%, #1A1A1A 100%);
  
  --shadow-card: 0 8px 40px rgba(0, 0, 0, 0.08);
  --shadow-button: 0 4px 20px rgba(232, 93, 76, 0.3);
  
  --radius-small: 8px;
  --radius-medium: 16px;
  --radius-large: 24px;
  --radius-pill: 100px;
}
```

---

## Contact

For brand questions or asset requests:
[Your contact info here]

---

*Last updated: February 2026*
*Version 1.0*
