import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius, Fonts } from '../constants/theme';
import { useWardrobeProgress } from '../hooks/useApi';

const CATEGORY_LABELS: Record<string, string> = {
  tops: 'Tops',
  bottoms: 'Bottoms',
  shoes: 'Shoes',
  accessories: 'Accessories',
  outerwear: 'Outerwear',
};

export default function WardrobeProgressCard() {
  const router = useRouter();
  const { data: progress, isLoading } = useWardrobeProgress();

  if (isLoading || !progress) return null;

  const { outfitCheckCount, wardrobeItemCount, unlockThreshold, isUnlocked, categoryCounts } = progress;
  const pct = Math.min((outfitCheckCount / unlockThreshold) * 100, 100);

  if (!isUnlocked) {
    return (
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>The Closet</Text>
        <View style={styles.rule} />

        <Text style={styles.title}>Your Closet is Building</Text>

        {wardrobeItemCount > 0 && (
          <Text style={styles.teaser}>{wardrobeItemCount} item{wardrobeItemCount !== 1 ? 's' : ''} detected so far</Text>
        )}

        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
        </View>
        <Text style={styles.progressLabel}>{outfitCheckCount}/{unlockThreshold} outfit checks</Text>
        <Text style={styles.subtitle}>Keep checking outfits to unlock your AI-built wardrobe</Text>
      </View>
    );
  }

  // Unlocked state
  const categoryEntries = Object.entries(categoryCounts).filter(([, count]) => count > 0);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push('/wardrobe' as any)}
      activeOpacity={0.8}
    >
      <View style={styles.unlockedHeader}>
        <Text style={styles.sectionLabel}>The Closet</Text>
        <View style={styles.itemCountRow}>
          <Text style={styles.itemCount}>{wardrobeItemCount} items</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
        </View>
      </View>
      <View style={styles.rule} />

      {categoryEntries.length > 0 && (
        <View style={styles.chips}>
          {categoryEntries.map(([cat, count]) => (
            <View key={cat} style={styles.chip}>
              <Text style={styles.chipText}>{count} {CATEGORY_LABELS[cat] ?? cat}</Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  sectionLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 2.2,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  rule: {
    width: 60,
    height: 1,
    backgroundColor: Colors.primary,
    marginBottom: Spacing.md,
  },
  unlockedHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  itemCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 1,
  },
  itemCount: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  title: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: FontSize.sm,
    color: Colors.text,
    marginBottom: 6,
  },
  teaser: {
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.xs,
    color: Colors.primary,
    marginBottom: Spacing.sm,
  },
  progressBar: {
    height: 2,
    backgroundColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  progressLabel: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.xs,
    color: Colors.text,
  },
});
