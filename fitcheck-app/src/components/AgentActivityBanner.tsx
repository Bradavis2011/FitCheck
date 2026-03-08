import { View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts, Spacing, FontSize, BorderRadius } from '../constants/theme';
import { AgentActivity } from '../hooks/useApi';

interface AgentActivityBannerProps {
  activity: AgentActivity;
}

export default function AgentActivityBanner({ activity }: AgentActivityBannerProps) {
  const { outfitsAnalyzedOvernight, improvementsMade } = activity;

  // Only show when there's meaningful activity
  if (outfitsAnalyzedOvernight === 0 && improvementsMade === 0) return null;

  const lines: string[] = [];
  if (outfitsAnalyzedOvernight > 0) {
    lines.push(`${outfitsAnalyzedOvernight} outfit${outfitsAnalyzedOvernight === 1 ? '' : 's'} analyzed overnight`);
  }
  if (improvementsMade > 0) {
    lines.push(`${improvementsMade} improvement${improvementsMade === 1 ? '' : 's'} deployed this week`);
  }

  return (
    <View style={styles.banner}>
      <View style={styles.dot} />
      <Text style={styles.text}>{lines.join(' · ')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primaryAlpha10,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sharp,
    marginHorizontal: Spacing.md,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  text: {
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.xs,
    color: Colors.primary,
    letterSpacing: 0.3,
    flex: 1,
  },
});
