import { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, Fonts, BorderRadius } from '../src/constants/theme';
import { useStyleJournal, useGenerateStyleArticle } from '../src/hooks/useApi';
import { useSubscriptionStore } from '../src/stores/subscriptionStore';
import type { StyleArticleType, StyleArticleOverviewItem } from '../src/services/api.service';

const TYPE_ICONS: Record<StyleArticleType, string> = {
  wardrobe_snapshot: 'shirt-outline',
  color_story: 'color-palette-outline',
  capsule_builder: 'cube-outline',
  monthly_report: 'bar-chart-outline',
  occasion_playbook: 'calendar-outline',
};

function ArticleCard({
  item,
  isPaid,
  onGenerate,
  onRead,
  isGenerating,
}: {
  item: StyleArticleOverviewItem;
  isPaid: boolean;
  onGenerate: () => void;
  onRead: () => void;
  isGenerating: boolean;
}) {
  const icon = TYPE_ICONS[item.type] ?? 'document-outline';
  const isStaleOrNew = !item.hasArticle || item.isStale;

  return (
    <View style={styles.articleCard}>
      <View style={styles.articleCardHeader}>
        <View style={styles.articleIconWrap}>
          <Ionicons name={icon as any} size={20} color={Colors.primary} />
        </View>
        <View style={styles.articleCardMeta}>
          <Text style={styles.articleType}>{item.type.replace(/_/g, ' ').toUpperCase()}</Text>
          <Text style={styles.articleTitle}>{item.title}</Text>
        </View>
      </View>

      <Text style={styles.articlePreview}>{item.previewDescription}</Text>

      {!item.dataThresholdMet ? (
        <View style={styles.thresholdBadge}>
          <Ionicons name="hourglass-outline" size={12} color={Colors.textMuted} />
          <Text style={styles.thresholdText}>{item.dataThresholdMessage}</Text>
        </View>
      ) : !isPaid ? (
        <TouchableOpacity
          style={styles.upgradeButton}
          activeOpacity={0.85}
          onPress={() => router.push('/upgrade' as any)}
        >
          <Ionicons name="lock-closed" size={14} color={Colors.white} />
          <Text style={styles.upgradeButtonText}>UPGRADE TO UNLOCK</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.articleActions}>
          {item.hasArticle && !item.isStale && (
            <TouchableOpacity style={styles.readButton} onPress={onRead} activeOpacity={0.8}>
              <Text style={styles.readButtonText}>READ</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.generateButton, isGenerating && styles.generateButtonDisabled]}
            onPress={onGenerate}
            disabled={isGenerating}
            activeOpacity={0.8}
          >
            {isGenerating ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Ionicons name="create-outline" size={14} color={Colors.white} />
            )}
            <Text style={styles.generateButtonText}>
              {isGenerating ? 'GENERATING…' : isStaleOrNew ? 'GENERATE' : 'REFRESH'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {item.generatedAt && (
        <Text style={styles.generatedAt}>
          Last generated {new Date(item.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          {item.isStale ? ' · Stale' : ''}
        </Text>
      )}
    </View>
  );
}

export default function StyleJournalScreen() {
  const router = useRouter();
  const { tier } = useSubscriptionStore();
  const isPaid = tier === 'plus' || tier === 'pro';

  const { data, isLoading, refetch } = useStyleJournal();
  const generateArticle = useGenerateStyleArticle();

  const articles = data?.articles ?? [];

  async function handleGenerate(type: StyleArticleType) {
    try {
      await generateArticle.mutateAsync(type);
      refetch();
    } catch (err: any) {
      // Error is shown by the mutation state — no Alert needed, keep UI clean
      console.error('[StyleJournal] generate failed:', err?.message);
    }
  }

  function handleRead(type: StyleArticleType) {
    router.push(`/style-article?type=${type}` as any);
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.headerLabel}>EDITORIAL</Text>
          <Text style={styles.headerTitle}>Style Journal</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.rule} />

      {!isPaid && (
        <View style={styles.upgradeBanner}>
          <Ionicons name="lock-closed-outline" size={14} color={Colors.primary} />
          <Text style={styles.upgradeBannerText}>
            Articles require Plus or Pro. Add items to see your data.
          </Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>
            Personalized editorial articles generated from your wardrobe, style history, and outfit data.
          </Text>

          {articles.map((item) => (
            <ArticleCard
              key={item.type}
              item={item}
              isPaid={isPaid}
              onGenerate={() => handleGenerate(item.type)}
              onRead={() => handleRead(item.type)}
              isGenerating={generateArticle.isPending && generateArticle.variables === item.type}
            />
          ))}

          <View style={{ height: 48 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitles: {
    alignItems: 'center',
    gap: 2,
  },
  headerLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 2,
    color: Colors.textMuted,
  },
  headerTitle: {
    fontFamily: Fonts.serif,
    fontSize: FontSize.xl,
    color: Colors.text,
  },
  rule: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  upgradeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.primaryAlpha10,
    borderLeftWidth: 2,
    borderLeftColor: Colors.primary,
  },
  upgradeBannerText: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.xs,
    color: Colors.text,
    flex: 1,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  intro: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  articleCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  articleCardHeader: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'flex-start',
  },
  articleIconWrap: {
    width: 40,
    height: 40,
    backgroundColor: Colors.primaryAlpha10,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 0,
  },
  articleCardMeta: {
    flex: 1,
    gap: 2,
  },
  articleType: {
    fontFamily: Fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.5,
    color: Colors.primary,
  },
  articleTitle: {
    fontFamily: Fonts.serif,
    fontSize: FontSize.lg,
    color: Colors.text,
    lineHeight: 22,
  },
  articlePreview: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  thresholdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.surfaceLight,
    alignSelf: 'flex-start',
  },
  thresholdText: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: Spacing.lg,
    alignSelf: 'stretch',
  },
  upgradeButtonText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.5,
    color: Colors.white,
  },
  articleActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  readButton: {
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingVertical: 8,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  readButtonText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.5,
    color: Colors.primary,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingVertical: 8,
    paddingHorizontal: Spacing.lg,
    flex: 1,
    justifyContent: 'center',
  },
  generateButtonDisabled: {
    opacity: 0.7,
  },
  generateButtonText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.5,
    color: Colors.white,
  },
  generatedAt: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    color: Colors.textMuted,
    alignSelf: 'flex-end',
  },
});
