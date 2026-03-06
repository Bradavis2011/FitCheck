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

function getMilestoneTeaser(outfitCheckCount: number, wardrobeItemCount: number): string | null {
  if (outfitCheckCount < 1) return '1 check to enable AI item detection';
  if (outfitCheckCount < 3) return `${3 - outfitCheckCount} more check${3 - outfitCheckCount !== 1 ? 's' : ''} to unlock virtual outfit analysis`;
  if (outfitCheckCount < 5) return `${5 - outfitCheckCount} more check${5 - outfitCheckCount !== 1 ? 's' : ''} to unlock AI outfit suggestions`;
  if (wardrobeItemCount === 0) return 'Add items to seed your closet';
  return null;
}

export default function WardrobeProgressCard() {
  const router = useRouter();
  const { data: progress, isLoading } = useWardrobeProgress();

  if (isLoading || !progress) return null;

  const { outfitCheckCount, wardrobeItemCount, categoryCounts } = progress;
  const categoryEntries = Object.entries(categoryCounts).filter(([, count]) => count > 0);
  const teaser = getMilestoneTeaser(outfitCheckCount, wardrobeItemCount);
  const aiActive = outfitCheckCount >= 5;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push('/wardrobe' as any)}
      activeOpacity={0.8}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.sectionLabel}>The Closet</Text>
          <View style={styles.rule} />
        </View>
        <View style={styles.headerRight}>
          {wardrobeItemCount > 0 && (
            <Text style={styles.itemCount}>{wardrobeItemCount} items</Text>
          )}
          <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
        </View>
      </View>

      {wardrobeItemCount === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Seed your closet</Text>
          <Text style={styles.emptySubtitle}>Add items from day 1 — no outfit checks needed</Text>
          <View style={styles.addCta}>
            <Text style={styles.addCtaText}>ADD ITEMS</Text>
          </View>
        </View>
      ) : (
        categoryEntries.length > 0 && (
          <View style={styles.chips}>
            {categoryEntries.map(([cat, count]) => (
              <View key={cat} style={styles.chip}>
                <Text style={styles.chipText}>{count} {CATEGORY_LABELS[cat] ?? cat}</Text>
              </View>
            ))}
          </View>
        )
      )}

      {aiActive && (
        <View style={styles.aiActiveRow}>
          <Ionicons name="checkmark-circle" size={12} color={Colors.primary} />
          <Text style={styles.aiActiveText}>AI styling active</Text>
        </View>
      )}

      {!aiActive && teaser && (
        <Text style={styles.teaser}>{teaser}</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  itemCount: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
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
  },
  emptyState: {
    gap: 4,
  },
  emptyTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  emptySubtitle: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  addCta: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 0,
  },
  addCtaText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.5,
    color: Colors.primary,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 0,
  },
  chipText: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.xs,
    color: Colors.text,
  },
  teaser: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 4,
  },
  aiActiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  aiActiveText: {
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.xs,
    color: Colors.primary,
  },
});
