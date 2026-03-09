import { View, Text, StyleSheet, TouchableOpacity, ImageBackground, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, BorderRadius, Spacing, Fonts } from '../constants/theme';

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
  // Ensure imageUrl is valid (not empty string or just whitespace)
  const hasValidImage = imageUrl && imageUrl.trim().length > 0;

  const content = (
    <View style={styles.card}>
      {hasValidImage ? (
        <ImageBackground
          source={{ uri: imageUrl }}
          style={styles.image}
          imageStyle={styles.imageInner}
          onError={(error) => console.warn('[OutfitCard] Image failed to load:', imageUrl)}
        >
          <View style={styles.bottomBar} />
          <CardOverlay
            score={score}
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
            occasions={occasions}
            isFavorite={isFavorite}
            onFavoritePress={onFavoritePress}
          />
        </View>
      )}
    </View>
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
  occasions,
  isFavorite,
  onFavoritePress,
}: {
  score: number;
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
      <View style={styles.scoreBadge}>
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
  },
  image: {
    flex: 1,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '35%',
    backgroundColor: 'rgba(0,0,0,0.35)',
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
    top: 0,
    right: 0,
    backgroundColor: 'rgba(26,26,26,0.75)',
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  scoreText: {
    fontFamily: Fonts.serif,
    fontSize: 13,
    color: '#fff',
  },
  occasionTag: {
    position: 'absolute',
    bottom: Spacing.sm,
    left: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  occasionText: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.sansMedium,
    color: Colors.black,
  },
});
