// OrThis? Brand Colors - LIGHT MODE
export const Colors = {
  // Core - Decision Coral
  primary: '#E85D4C',       // coral - buttons, CTAs, brand emphasis
  primaryLight: '#FF7A6B',  // coral light - gradients, hover states
  primaryDark: '#C94A3A',   // coral dark - active/pressed states

  // Backgrounds - Confidence Cream
  background: '#FBF7F4',    // cream - primary backgrounds
  backgroundSecondary: '#F5EDE7', // cream dark - cards, sections
  surface: '#FFFFFF',       // white - cards, elevated surfaces
  surfaceLight: '#F8F8F8',  // gray 100 - subtle backgrounds

  // Text - Clarity Black
  text: '#1A1A1A',          // black - primary text, icons
  textSecondary: '#2D2D2D', // charcoal - secondary text
  textMuted: '#9B9B9B',     // gray 400 - placeholder, captions

  // Accent - Soft Sage
  sage: '#A8B5A0',          // sage - success states, verified badges
  sageLight: '#C4CFBD',     // sage light - tags, subtle backgrounds

  // Semantic (keeping existing for compatibility)
  success: '#10B981',       // green - high scores, positive feedback
  warning: '#F59E0B',       // amber - medium scores, stars, streaks
  info: '#3B82F6',          // blue - quick fix tips
  error: '#EF4444',         // red - low scores, destructive actions

  // Utility
  border: '#E8E8E8',        // gray 200 - borders, dividers
  white: '#FFFFFF',
  black: '#1A1A1A',
  charcoal: '#2D2D2D',

  // Opacity helpers (coral-based)
  primaryAlpha10: 'rgba(232, 93, 76, 0.1)',
  primaryAlpha30: 'rgba(232, 93, 76, 0.3)',
  sageAlpha10: 'rgba(168, 181, 160, 0.1)',
  successAlpha10: 'rgba(16, 185, 129, 0.1)',
  warningAlpha10: 'rgba(245, 158, 11, 0.1)',
  infoAlpha10: 'rgba(59, 130, 246, 0.1)',
  overlay: 'rgba(0, 0, 0, 0.5)',

  // Deprecated (for backwards compatibility - will remove later)
  secondary: '#E85D4C',     // alias to primary for gradual migration
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

export const BorderRadius = {
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  pill: 100,  // pill-shaped buttons per OrThis? brand guidelines
  full: 9999,
} as const;

// Score color thresholds from mockup
export const getScoreColor = (score: number) => {
  if (score >= 8) return Colors.success;
  if (score >= 6) return Colors.warning;
  return Colors.error;
};
