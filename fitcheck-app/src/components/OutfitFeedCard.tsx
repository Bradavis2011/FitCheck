import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, BorderRadius, Spacing, getScoreColor } from '../constants/theme';

type PublicOutfit = {
  id: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  thumbnailData?: string;
  score: number | null;
  occasions: string[];
  feedbackCount: number;
  username: string;
  createdAt: string;
  aiFeedback?: { summary?: string; editorialSummary?: string } | null;
};

type Props = {
  outfit: PublicOutfit;
  onPress: () => void;
};

export default function OutfitFeedCard({ outfit, onPress }: Props) {
  const hasScore = outfit.score != null && outfit.score > 0;
  const scoreColor = hasScore ? getScoreColor(outfit.score) : Colors.textMuted;
  const rawThumb = outfit.thumbnailData;
  const thumbUri = rawThumb
    ? (rawThumb.startsWith('data:') ? rawThumb : `data:image/jpeg;base64,${rawThumb}`)
    : null;
  const imageUri = outfit.thumbnailUrl || thumbUri || outfit.imageUrl;
  // Ensure imageUri is valid (not empty string or just whitespace)
  const hasValidImage = imageUri && imageUri.trim().length > 0;

  const displayOccasion = outfit.occasions.length > 1
    ? `${outfit.occasions[0]} +${outfit.occasions.length - 1}`
    : outfit.occasions[0] || 'Unknown';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.95}>
      <View style={styles.content}>
        {/* Thumbnail */}
        <View style={styles.thumbnailContainer}>
          {hasValidImage ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.thumbnail}
              resizeMode="cover"
              onError={(error) => console.warn('[OutfitFeedCard] Image failed to load:', imageUri)}
            />
          ) : (
            <View style={[styles.thumbnail, styles.placeholderThumbnail]}>
              <Ionicons name="shirt-outline" size={32} color={Colors.textMuted} />
            </View>
          )}
          {/* Score badge */}
          {hasScore && (
            <View style={[styles.scoreBadge, { backgroundColor: scoreColor }]}>
              <Text style={styles.scoreText}>{outfit.score.toFixed(1)}</Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.info}>
          <View style={styles.userRow}>
            <View style={styles.avatarSmall}>
              <Text style={styles.avatarSmallText}>
                {outfit.username.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.username}>@{outfit.username}</Text>
          </View>

          <View style={styles.occasionRow}>
            <Ionicons name="calendar-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.occasionText}>{displayOccasion}</Text>
          </View>

          {(outfit.aiFeedback?.summary || outfit.aiFeedback?.editorialSummary) ? (
            <Text style={styles.aiSummary} numberOfLines={2}>
              {outfit.aiFeedback.summary || outfit.aiFeedback.editorialSummary}
            </Text>
          ) : null}

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Ionicons name="chatbubble-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.statText}>{outfit.feedbackCount} feedback</Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  content: {
    flexDirection: 'row',
    padding: Spacing.md,
  },
  thumbnailContainer: {
    position: 'relative',
  },
  thumbnail: {
    width: 80,
    height: 100,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceLight,
  },
  placeholderThumbnail: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreBadge: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  info: {
    flex: 1,
    marginLeft: Spacing.md,
    justifyContent: 'space-between',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  avatarSmall: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryAlpha10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarSmallText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },
  username: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  occasionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  occasionText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  aiSummary: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
});
