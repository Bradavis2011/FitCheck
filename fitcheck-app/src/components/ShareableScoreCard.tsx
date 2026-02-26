import { View, Text, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius, getScoreColor, Fonts } from '../constants/theme';

type Props = {
  score: number;
  imageUri?: string;
  summary: string;
  occasion?: string;
  username?: string;
};

/**
 * ShareableScoreCard — 400×600px branded PNG for social sharing.
 * Captured via react-native-view-shot (off-screen rendering).
 * Every share is a branded ad: "Or This? · orthis.app" in the footer.
 */
export default function ShareableScoreCard({ score, imageUri, summary, occasion, username }: Props) {
  const scoreColor = getScoreColor(score);

  const validImageUri = imageUri && imageUri.trim().length > 0 ? imageUri : null;

  return (
    <View style={styles.container}>
      <View style={styles.gradient}>
        {/* Header — editorial logo */}
        <View style={styles.header}>
          <Text style={styles.logo}>
            <Text style={styles.logoOr}>Or </Text>
            <Text style={styles.logoThis}>This?</Text>
          </Text>
          <Text style={styles.tagline}>CONFIDENCE IN EVERY CHOICE</Text>
        </View>

        {/* Outfit image */}
        <View style={styles.content}>
          {validImageUri ? (
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: validImageUri }}
                style={styles.image}
                resizeMode="cover"
                onError={(e) => console.error('ShareableScoreCard image error:', e.nativeEvent.error)}
              />
            </View>
          ) : (
            <View style={[styles.imageContainer, styles.placeholderImageContainer]}>
              <Ionicons name="shirt-outline" size={80} color="rgba(255,255,255,0.5)" />
            </View>
          )}

          {/* Score — editorial style */}
          <View style={[styles.scoreContainer, { borderColor: scoreColor }]}>
            <Text style={[styles.scoreValue, { color: scoreColor }]}>{score.toFixed(1)}</Text>
            <Text style={styles.scoreOutOf}>/10</Text>
          </View>

          {/* Summary */}
          <View style={styles.summaryContainer}>
            <Text style={styles.summary} numberOfLines={3}>
              {summary}
            </Text>
          </View>

          {/* Occasion */}
          {occasion && (
            <View style={styles.occasionBadge}>
              <Text style={styles.occasionText}>{occasion.toUpperCase()}</Text>
            </View>
          )}
        </View>

        {/* Branded footer — the watermark / ad unit */}
        <View style={styles.footer}>
          <View style={styles.footerRule} />
          <View style={styles.footerContent}>
            <Text style={styles.footerLogo}>
              <Text style={styles.footerLogoOr}>Or </Text>
              <Text style={styles.footerLogoThis}>This?</Text>
            </Text>
            <Text style={styles.footerUrl}>ORTHIS.APP</Text>
          </View>
          {username && (
            <Text style={styles.username}>shared by @{username}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 400,
    height: 600,
    backgroundColor: Colors.primary,
  },
  gradient: {
    flex: 1,
    padding: Spacing.lg,
    justifyContent: 'space-between',
    backgroundColor: Colors.primary,
  },
  // Header
  header: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  logo: {
    fontSize: 36,
  },
  logoOr: {
    color: Colors.white,
    fontFamily: Fonts.sansMedium,
  },
  logoThis: {
    color: Colors.white,
    fontFamily: Fonts.serifItalic,
  },
  tagline: {
    fontFamily: Fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 4,
  },
  // Content
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  imageContainer: {
    width: 200,
    height: 240,
    borderRadius: BorderRadius.sm, // 4px — barely rounded per editorial spec
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderImageContainer: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Score — editorial: white box, colored score number
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 0, // sharp — editorial
    borderLeftWidth: 3,
  },
  scoreValue: {
    fontFamily: Fonts.serif,
    fontSize: 48,
    lineHeight: 52,
  },
  scoreOutOf: {
    fontFamily: Fonts.sans,
    fontSize: 20,
    color: Colors.textMuted,
    marginLeft: 4,
  },
  // Summary
  summaryContainer: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 0, // sharp
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    maxWidth: 320,
  },
  summary: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.md,
    lineHeight: 22,
    color: Colors.text,
    textAlign: 'center',
  },
  // Occasion
  occasionBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 0, // sharp
  },
  occasionText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.5,
    color: Colors.white,
  },
  // Branded footer watermark
  footer: {
    alignItems: 'center',
    paddingTop: Spacing.md,
  },
  footerRule: {
    width: 60,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.5)',
    marginBottom: Spacing.sm,
  },
  footerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  footerLogo: {
    fontSize: 18,
  },
  footerLogoOr: {
    fontFamily: Fonts.sansMedium,
    color: Colors.white,
  },
  footerLogoThis: {
    fontFamily: Fonts.serifItalic,
    color: Colors.white,
  },
  footerUrl: {
    fontFamily: Fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.8)',
  },
  username: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
  },
});
