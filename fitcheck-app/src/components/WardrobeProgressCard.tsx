import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../constants/theme';
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
        <View style={styles.lockedHeader}>
          <View style={styles.iconWrap}>
            <Ionicons name="lock-closed" size={18} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Your Closet is Building</Text>
        </View>

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
        <View style={[styles.iconWrap, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
          <Ionicons name="shirt" size={18} color="#10B981" />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Your Closet</Text>
          <Text style={styles.itemCount}>{wardrobeItemCount} items</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
      </View>

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
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  lockedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  unlockedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  headerText: {
    flex: 1,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primaryAlpha10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  itemCount: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  teaser: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '500',
    marginBottom: Spacing.sm,
  },
  progressBar: {
    height: 6,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    backgroundColor: Colors.backgroundSecondary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  chipText: {
    fontSize: FontSize.xs,
    color: Colors.text,
  },
});
