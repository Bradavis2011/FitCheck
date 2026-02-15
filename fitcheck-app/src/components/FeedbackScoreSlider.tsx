import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, Spacing, FontSize, BorderRadius, getScoreColor } from '../constants/theme';

type Props = {
  value: number;
  onChange: (value: number) => void;
};

export default function FeedbackScoreSlider({ value, onChange }: Props) {
  const scoreColor = getScoreColor(value);
  const scores = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Your Score</Text>
        <View style={[styles.scoreBadge, { backgroundColor: scoreColor }]}>
          <Text style={styles.scoreText}>{value}/10</Text>
        </View>
      </View>

      <View style={styles.scoresRow}>
        {scores.map((score) => (
          <TouchableOpacity
            key={score}
            style={[
              styles.scoreButton,
              score === value && { backgroundColor: scoreColor },
            ]}
            onPress={() => onChange(score)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.scoreButtonText,
                score === value && { color: Colors.white },
              ]}
            >
              {score}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  scoreBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  scoreText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.white,
  },
  scoresRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  scoreButton: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  scoreButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
});
