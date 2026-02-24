// OrThis? Brand Colors - LIGHT MODE
export const Colors = {
  // Core - Decision Coral
  primary: '#E85D4C',       // coral - buttons, CTAs, brand emphasis
  primaryLight: '#FF7A6B',  // coral light
  primaryDark: '#C94A3A',   // coral dark - active/pressed states

  // Backgrounds - Confidence Cream
  background: '#FBF7F4',    // cream - primary backgrounds
  backgroundSecondary: '#F5EDE7', // cream dark - cards, sections
  surface: '#FFFFFF',       // white - cards, elevated surfaces
  surfaceLight: '#F8F8F8',  // gray 100 - subtle backgrounds

  // Text - Clarity Black
  text: '#1A1A1A',          // black - primary text, icons
  textSecondary: '#2D2D2D', // charcoal - secondary text
  textMuted: '#9B9B9B',     // gray 400 - placeholder, captions, section labels

  // Semantic (score colors - functional only, keep these)
  success: '#10B981',       // green - high scores (>=8)
  warning: '#F59E0B',       // amber - medium scores (6-7), streaks
  error: '#EF4444',         // red - low scores (<6)

  // Utility
  border: 'rgba(0,0,0,0.1)', // alpha border - all borders and dividers
  borderSolid: '#E8E8E8',   // solid border for components that need it
  white: '#FFFFFF',
  black: '#1A1A1A',
  charcoal: '#2D2D2D',

  // Opacity helpers (coral-based)
  primaryAlpha10: 'rgba(232, 93, 76, 0.1)',
  primaryAlpha30: 'rgba(232, 93, 76, 0.3)',
  overlay: 'rgba(0, 0, 0, 0.5)',

  // Legacy / backwards compat — kept for components not yet redesigned
  sage: '#A8B5A0',
  sageLight: '#C4CFBD',
  sageAlpha10: 'rgba(168, 181, 160, 0.1)',
  info: '#3B82F6',
  infoAlpha10: 'rgba(59, 130, 246, 0.1)',
  successAlpha10: 'rgba(16, 185, 129, 0.1)',
  warningAlpha10: 'rgba(245, 158, 11, 0.1)',
  secondary: '#E85D4C',     // alias to primary
  secondaryAlpha10: 'rgba(232, 93, 76, 0.1)',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const FontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 24,
  xxl: 32,
  hero: 40,
} as const;

// Editorial border radii per brand brief
export const BorderRadius = {
  sharp: 0,    // primary buttons, inputs, tags, chips — editorial
  sm: 4,       // barely rounded — image containers
  md: 8,       // cards
  lg: 8,       // was 24 — now matches card spec
  xl: 8,       // was 32 — now matches card spec
  pill: 9999,  // toggles (standard mobile pattern — exception per spec)
  full: 9999,  // avatars, score badges (exception per spec)
} as const;

// Brand font families (loaded via @expo-google-fonts in _layout.tsx)
// Usage rule: serifItalic = ONLY for "This?" in the logo (matches orthis.app web exactly).
//             serif (regular) = display headlines, score numbers, screen titles.
//             sans* = everything else (UI, buttons, labels, data/stats).
export const Fonts = {
  // DM Sans — body, UI, buttons, labels, stats
  sans: 'DMSans_400Regular',
  sansMedium: 'DMSans_500Medium',
  sansSemiBold: 'DMSans_600SemiBold',
  sansBold: 'DMSans_700Bold',
  // Playfair Display — display/editorial headlines only
  serif: 'PlayfairDisplay_400Regular',
  // Playfair Display Italic — ONLY for "This?" in the logo
  serifItalic: 'PlayfairDisplay_400Regular_Italic',
} as const;

// Editorial text style tokens (StyleSheet-compatible, no-spread approach)
// Rule: Playfair italic ONLY for "This?" in the logo (matches web exactly).
//       All headlines/display text use Playfair Regular.
export const Editorial = {
  screenTitle: {
    fontFamily: 'PlayfairDisplay_400Regular' as const,
    fontSize: 30,
    color: '#1A1A1A',
    lineHeight: 38,
  },
  sectionLabel: {
    fontFamily: 'DMSans_500Medium' as const,
    fontSize: 11,
    textTransform: 'uppercase' as const,
    letterSpacing: 2.2,
    color: '#9B9B9B',
  },
  buttonLabel: {
    fontFamily: 'DMSans_500Medium' as const,
    fontSize: 12,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.65,
    color: '#FFFFFF',
  },
  cardTitle: {
    fontFamily: 'DMSans_600SemiBold' as const,
    fontSize: 16,
    color: '#1A1A1A',
  },
  body: {
    fontFamily: 'DMSans_400Regular' as const,
    fontSize: 15,
    color: '#1A1A1A',
    lineHeight: 22,
  },
  caption: {
    fontFamily: 'DMSans_400Regular' as const,
    fontSize: 13,
    color: '#9B9B9B',
  },
} as const;

// Score color thresholds
export const getScoreColor = (score: number) => {
  if (score >= 8) return Colors.success;
  if (score >= 6) return Colors.warning;
  return Colors.error;
};
