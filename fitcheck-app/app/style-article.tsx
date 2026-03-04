import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, Fonts, BorderRadius } from '../src/constants/theme';
import { useStyleArticle, useGenerateStyleArticle } from '../src/hooks/useApi';
import type { StyleArticleType } from '../src/services/api.service';

const TYPE_LABELS: Record<StyleArticleType, string> = {
  wardrobe_snapshot: 'Closet at a Glance',
  color_story: 'Color Story',
  capsule_builder: 'Essential Capsule',
  monthly_report: 'Monthly Report',
  occasion_playbook: 'Occasion Playbook',
};

export default function StyleArticleScreen() {
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type: string }>();
  const articleType = (type ?? '') as StyleArticleType;

  const { data, isLoading, refetch } = useStyleArticle(articleType || null);
  const generateArticle = useGenerateStyleArticle();

  const article = data?.article;
  const isStale = article ? new Date() > new Date(article.validUntil) : false;

  async function handleRefresh() {
    try {
      await generateArticle.mutateAsync(articleType);
      refetch();
    } catch (err: any) {
      Alert.alert('Generation Failed', err?.message ?? 'Please try again.');
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!article) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{TYPE_LABELS[articleType] ?? 'Article'}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="document-outline" size={40} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No article yet</Text>
          <Text style={styles.emptyText}>Go back to Style Journal and generate this article.</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>BACK TO JOURNAL</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Render markdown-like content: treat \n\n as paragraph breaks, ## as headings
  function renderContent(content: string) {
    const blocks = content.split(/\n\n+/);
    return blocks.map((block, i) => {
      if (block.startsWith('## ')) {
        return (
          <Text key={i} style={styles.heading2}>
            {block.slice(3)}
          </Text>
        );
      }
      if (block.startsWith('# ')) {
        return (
          <Text key={i} style={styles.heading1}>
            {block.slice(2)}
          </Text>
        );
      }
      if (block.startsWith('- ') || block.startsWith('· ')) {
        const lines = block.split('\n').filter((l) => l.trim());
        return (
          <View key={i} style={styles.bulletBlock}>
            {lines.map((line, j) => (
              <Text key={j} style={styles.bulletItem}>
                {line.replace(/^[-·]\s*/, '· ')}
              </Text>
            ))}
          </View>
        );
      }
      return (
        <Text key={i} style={styles.paragraph}>
          {block.trim()}
        </Text>
      );
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{TYPE_LABELS[articleType] ?? 'Article'}</Text>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={handleRefresh}
          disabled={generateArticle.isPending}
        >
          {generateArticle.isPending ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Ionicons
              name="refresh-outline"
              size={20}
              color={isStale ? Colors.primary : Colors.textMuted}
            />
          )}
        </TouchableOpacity>
      </View>
      <View style={styles.rule} />

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Article header */}
        <Text style={styles.articleLabel}>
          {articleType.replace(/_/g, ' ').toUpperCase()}
        </Text>
        <Text style={styles.articleTitle}>{article.title}</Text>
        <Text style={styles.articleMeta}>
          v{article.version} · {new Date(article.generatedAt).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
          {isStale ? ' · Refresh available' : ''}
        </Text>

        <View style={styles.divider} />

        {/* Article body */}
        <View style={styles.articleBody}>
          {renderContent(article.content)}
        </View>

        {/* Structured data visualizations (if any) */}
        {article.data && Object.keys(article.data).length > 0 && (
          <DataVisualizations data={article.data as Record<string, unknown>} articleType={articleType} />
        )}

        {/* Stale refresh prompt */}
        {isStale && (
          <TouchableOpacity
            style={styles.refreshBanner}
            onPress={handleRefresh}
            disabled={generateArticle.isPending}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh-outline" size={14} color={Colors.primary} />
            <Text style={styles.refreshBannerText}>Your data has changed — regenerate this article</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function DataVisualizations({ data, articleType }: { data: Record<string, unknown>; articleType: StyleArticleType }) {
  const sections: React.ReactNode[] = [];

  // Category breakdown (wardrobe_snapshot)
  if (data.categoryBreakdown && typeof data.categoryBreakdown === 'object') {
    const cats = data.categoryBreakdown as Record<string, number>;
    const total = Object.values(cats).reduce((a, b) => a + b, 0);
    if (total > 0) {
      sections.push(
        <View key="cats" style={styles.dataSection}>
          <Text style={styles.dataSectionLabel}>CATEGORY BREAKDOWN</Text>
          {Object.entries(cats).map(([cat, count]) => (
            <View key={cat} style={styles.barRow}>
              <Text style={styles.barLabel}>{cat}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${Math.round((count / total) * 100)}%` as any }]} />
              </View>
              <Text style={styles.barValue}>{count}</Text>
            </View>
          ))}
        </View>
      );
    }
  }

  // Top performing colors (color_story)
  if (Array.isArray(data.topPerformingColors) && data.topPerformingColors.length > 0) {
    const colors = data.topPerformingColors as Array<{ color: string; avgScore: number }>;
    sections.push(
      <View key="colors" style={styles.dataSection}>
        <Text style={styles.dataSectionLabel}>TOP COLORS BY SCORE</Text>
        {colors.slice(0, 6).map((c, i) => (
          <View key={i} style={styles.colorRow}>
            <Text style={styles.colorName}>{c.color}</Text>
            <Text style={styles.colorScore}>{c.avgScore?.toFixed(1)}/10</Text>
          </View>
        ))}
      </View>
    );
  }

  // Outfit formulas (capsule_builder / occasion_playbook)
  if (Array.isArray(data.outfitFormulas) && data.outfitFormulas.length > 0) {
    const formulas = data.outfitFormulas as Array<{ name: string; pieces: string[] }>;
    sections.push(
      <View key="formulas" style={styles.dataSection}>
        <Text style={styles.dataSectionLabel}>OUTFIT FORMULAS</Text>
        {formulas.map((f, i) => (
          <View key={i} style={styles.formulaCard}>
            <Text style={styles.formulaName}>{f.name}</Text>
            {f.pieces?.map((piece, j) => (
              <Text key={j} style={styles.formulaPiece}>· {piece}</Text>
            ))}
          </View>
        ))}
      </View>
    );
  }

  if (sections.length === 0) return null;

  return (
    <View style={styles.dataBlock}>
      <View style={styles.divider} />
      <Text style={styles.dataSectionHeader}>DATA HIGHLIGHTS</Text>
      {sections}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  headerTitle: {
    fontFamily: Fonts.serif,
    fontSize: FontSize.lg,
    color: Colors.text,
  },
  refreshBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  rule: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  articleLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 2,
    color: Colors.primary,
    marginBottom: 4,
  },
  articleTitle: {
    fontFamily: Fonts.serif,
    fontSize: 28,
    color: Colors.text,
    lineHeight: 34,
    marginBottom: 6,
  },
  articleMeta: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginBottom: Spacing.lg,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginBottom: Spacing.lg,
  },
  articleBody: {
    gap: Spacing.md,
  },
  heading1: {
    fontFamily: Fonts.serif,
    fontSize: FontSize.xl,
    color: Colors.text,
    lineHeight: 28,
  },
  heading2: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: FontSize.md,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: Colors.text,
  },
  paragraph: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.md,
    color: Colors.text,
    lineHeight: 26,
  },
  bulletBlock: {
    gap: 6,
    paddingLeft: Spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: Colors.primary,
  },
  bulletItem: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.sm,
    color: Colors.text,
    lineHeight: 22,
  },
  refreshBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  refreshBannerText: {
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.xs,
    color: Colors.primary,
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    fontFamily: Fonts.serif,
    fontSize: FontSize.xl,
    color: Colors.text,
  },
  emptyText: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 0,
  },
  backButtonText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.5,
    color: Colors.white,
  },
  // Data sections
  dataBlock: {
    marginTop: Spacing.lg,
  },
  dataSectionHeader: {
    fontFamily: Fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 2,
    color: Colors.textMuted,
    marginBottom: Spacing.md,
  },
  dataSection: {
    marginBottom: Spacing.lg,
  },
  dataSectionLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.5,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 6,
  },
  barLabel: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.xs,
    color: Colors.text,
    width: 80,
    textTransform: 'capitalize',
  },
  barTrack: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  barValue: {
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    width: 20,
    textAlign: 'right',
  },
  colorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  colorName: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.sm,
    color: Colors.text,
    textTransform: 'capitalize',
  },
  colorScore: {
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.sm,
    color: Colors.primary,
  },
  formulaCard: {
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
    gap: 4,
  },
  formulaName: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: FontSize.sm,
    color: Colors.text,
    marginBottom: 4,
  },
  formulaPiece: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
});
