import { View, Text, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, FontSize, Spacing, BorderRadius, getScoreColor } from '../constants/theme';

type Props = {
  score: number;
  imageUri?: string;
  summary: string;
  occasion?: string;
  username?: string;
};

/**
 * ShareableScoreCard - A beautiful branded card for sharing outfit scores
 * This component is captured as an image using react-native-view-shot
 */
export default function ShareableScoreCard({ score, imageUri, summary, occasion, username }: Props) {
  const scoreColor = getScoreColor(score);
  const scoreEmoji = score >= 8 ? '🔥' : score >= 6 ? '✨' : '💭';

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.primary, Colors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>
            <Text style={styles.logoOr}>Or </Text>
            <Text style={styles.logoThis}>This?</Text>
          </Text>
          <Text style={styles.tagline}>Confidence in every choice</Text>
        </View>

        {/* Main Content */}
        <View style={styles.content}>
          {/* Outfit Image */}
          {imageUri && (
            <View style={styles.imageContainer}>
              <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
            </View>
          )}

          {/* Score Display */}
          <View style={[styles.scoreContainer, { backgroundColor: scoreColor }]}>
            <Text style={styles.scoreEmoji}>{scoreEmoji}</Text>
            <Text style={styles.scoreValue}>{score.toFixed(1)}</Text>
            <Text style={styles.scoreOutOf}>/10</Text>
          </View>

          {/* Summary */}
          <View style={styles.summaryContainer}>
            <Text style={styles.summary} numberOfLines={3}>
              {summary}
            </Text>
          </View>

          {/* Occasion Badge */}
          {occasion && (
            <View style={styles.occasionBadge}>
              <Text style={styles.occasionText}>{occasion}</Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.cta}>Get your style scored at</Text>
          <Text style={styles.url}>OrThis.app</Text>
          {username && (
            <Text style={styles.username}>Shared by @{username}</Text>
          )}
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 400,
    height: 600,
    backgroundColor: Colors.background,
  },
  gradient: {
    flex: 1,
    padding: Spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  logo: {
    fontSize: 32,
    fontWeight: '700',
  },
  logoOr: {
    color: Colors.white,
    fontFamily: 'System',
  },
  logoThis: {
    color: Colors.white,
    fontFamily: 'System',
    fontStyle: 'italic',
  },
  tagline: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    width: 200,
    height: 250,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
    borderWidth: 3,
    borderColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  scoreEmoji: {
    fontSize: 28,
    marginRight: 8,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: '700',
    color: Colors.white,
  },
  scoreOutOf: {
    fontSize: 24,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    marginLeft: 4,
  },
  summaryContainer: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    maxWidth: 320,
  },
  summary: {
    fontSize: FontSize.md,
    lineHeight: 22,
    color: Colors.text,
    textAlign: 'center',
  },
  occasionBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  occasionText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.white,
  },
  footer: {
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  cta: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 4,
  },
  url: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: 1,
  },
  username: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8,
  },
});
