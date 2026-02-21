import { View, Text, StyleSheet, TouchableOpacity, ImageBackground, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Colors, FontSize, BorderRadius, Spacing, getScoreColor } from '../constants/theme';

type Props = {
  imageUrl: string;
  score: number;
  occasions: string[];
  isFavorite: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  onFavoritePress?: () => void;
};

export default function OutfitCard({ imageUrl, score, occasions, isFavorite, onPress, onLongPress, onFavoritePress }: Props) {
  const scoreColor = getScoreColor(score);
  // Ensure imageUrl is valid (not empty string or just whitespace)
  const hasValidImage = imageUrl && imageUrl.trim().length > 0;

  const content = (
    <Animated.View entering={FadeInDown.duration(400).springify()} style={styles.card}>
      {hasValidImage ? (
        <ImageBackground
          source={{ uri: imageUrl }}
          style={styles.image}
          imageStyle={styles.imageInner}
          onError={(error) => console.warn('[OutfitCard] Image failed to load:', imageUrl)}
        >
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.6)']}
            style={styles.gradient}
          />
          <CardOverlay
            score={score}
            scoreColor={scoreColor}
            occasions={occasions}
            isFavorite={isFavorite}
            onFavoritePress={onFavoritePress}
          />
        </ImageBackground>
      ) : (
        <View style={[styles.image, styles.placeholder]}>
          <Ionicons name="shirt-outline" size={32} color={Colors.textMuted} />
          <CardOverlay
            score={score}
            scoreColor={scoreColor}
            occasions={occasions}
            isFavorite={isFavorite}
            onFavoritePress={onFavoritePress}
          />
        </View>
      )}
    </Animated.View>
  );

  if (onPress || onLongPress) {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={400}
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      >
        {content}
      </Pressable>
    );
  }
  return content;
}

function CardOverlay({
  score,
  scoreColor,
  occasions,
  isFavorite,
  onFavoritePress,
}: {
  score: number;
  scoreColor: string;
  occasions: string[];
  isFavorite: boolean;
  onFavoritePress?: () => void;
}) {
  const displayText = occasions.length > 1
    ? `${occasions[0]} +${occasions.length - 1}`
    : occasions[0] || 'Unknown';

  return (
    <>
      {isFavorite && (
        <TouchableOpacity style={styles.heartButton} onPress={onFavoritePress}>
          <Ionicons name="heart" size={18} color={Colors.secondary} />
        </TouchableOpacity>
      )}
      <View style={[styles.scoreBadge, { backgroundColor: scoreColor }]}>
        <Text style={styles.scoreText}>{score.toFixed(1)}</Text>
      </View>
      <View style={styles.occasionTag}>
        <Text style={styles.occasionText}>{displayText}</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    aspectRatio: 3 / 4,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  image: {
    flex: 1,
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '40%',
  },
  imageInner: {
    borderRadius: BorderRadius.lg,
  },
  placeholder: {
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
  },
  heartButton: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
  },
  scoreBadge: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreText: {
    color: Colors.white,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  occasionTag: {
    position: 'absolute',
    bottom: Spacing.sm,
    left: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  occasionText: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    color: Colors.black,
  },
});
