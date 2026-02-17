import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, Animated } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getRecommendations, OutfitRecommendation } from '../src/services/style-intelligence.service';
import { Colors } from '../src/constants/theme';
import { useSubscriptionStore } from '../src/stores/subscriptionStore';

// Skeleton loader component
function SkeletonCard() {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const opacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.6],
  });

  return (
    <View style={styles.recommendationCard}>
      <Animated.View style={[styles.skeletonHeader, { opacity }]} />
      <Animated.View style={[styles.skeletonLine, { opacity, marginTop: 16 }]} />
      <Animated.View style={[styles.skeletonLine, { opacity, width: '80%' }]} />
      <Animated.View style={[styles.skeletonLine, { opacity, width: '60%' }]} />
      <View style={{ flexDirection: 'row', marginTop: 16, gap: 8 }}>
        <Animated.View style={[styles.skeletonPill, { opacity }]} />
        <Animated.View style={[styles.skeletonPill, { opacity }]} />
        <Animated.View style={[styles.skeletonPill, { opacity }]} />
      </View>
    </View>
  );
}

export default function RecommendationsScreen() {
  const { tier } = useSubscriptionStore();
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<OutfitRecommendation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fadeAnims = useRef<Animated.Value[]>([]).current;
  const slideAnims = useRef<Animated.Value[]>([]).current;

  useEffect(() => {
    if (tier === 'pro') {
      loadRecommendations();
    }
  }, [tier]);

  useEffect(() => {
    // Animate cards in when recommendations load
    if (recommendations.length > 0 && !loading) {
      // Initialize animations if needed
      if (fadeAnims.length !== recommendations.length) {
        fadeAnims.length = 0;
        slideAnims.length = 0;
        recommendations.forEach(() => {
          fadeAnims.push(new Animated.Value(0));
          slideAnims.push(new Animated.Value(30));
        });
      }

      // Stagger the animations
      const animations = recommendations.map((_, index) =>
        Animated.parallel([
          Animated.timing(fadeAnims[index], {
            toValue: 1,
            duration: 500,
            delay: index * 150,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnims[index], {
            toValue: 0,
            duration: 500,
            delay: index * 150,
            useNativeDriver: true,
          }),
        ])
      );

      Animated.stagger(0, animations).start();
    }
  }, [recommendations, loading]);

  const loadRecommendations = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getRecommendations();
      setRecommendations(data.recommendations);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return Colors.success; // Green
    if (confidence >= 0.6) return Colors.warning; // Amber
    return Colors.primary; // Coral
  };

  if (tier !== 'pro') {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Recommendations' }} />
        <View style={styles.errorContainer}>
          <Ionicons name="diamond-outline" size={64} color={Colors.primary} />
          <Text style={styles.errorText}>Pro Feature</Text>
          <Text style={styles.errorSubtext}>
            AI outfit recommendations require a Pro subscription. Upgrade to get personalized looks based on your Style DNA.
          </Text>
          <TouchableOpacity
            style={recUpgradeButtonStyle}
            onPress={() => router.push('/upgrade' as any)}
          >
            <Text style={recUpgradeButtonTextStyle}>Upgrade to Pro</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <ScrollView style={styles.container}>
        <Stack.Screen options={{ title: 'Recommendations' }} />
        <View style={styles.header}>
          <Text style={styles.title}>Your Perfect Outfits</Text>
          <Text style={styles.subtitle}>Finding your best looks...</Text>
        </View>
        {/* Skeleton loaders */}
        {[0, 1, 2].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </ScrollView>
    );
  }

  if (error || recommendations.length === 0) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Recommendations' }} />
        <View style={styles.errorContainer}>
          <Ionicons name="bulb-outline" size={64} color={Colors.textMuted} />
          <Text style={styles.errorText}>
            {error || 'No recommendations yet'}
          </Text>
          <Text style={styles.errorSubtext}>
            {error
              ? 'Something went wrong. Please try again.'
              : 'Submit a few more outfits to get personalized recommendations!'}
          </Text>
          {error && (
            <TouchableOpacity
              style={styles.retryButton}
              onPress={loadRecommendations}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh" size={20} color="#FFF" />
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen options={{ title: 'Recommendations' }} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Your Perfect Outfits</Text>
        <Text style={styles.subtitle}>
          Based on your {recommendations.length > 0 ? 'unique style DNA' : 'style preferences'}
        </Text>
      </View>

      {/* Recommendations */}
      {recommendations.map((rec, index) => (
        <Animated.View
          key={index}
          style={[
            styles.recommendationCard,
            {
              opacity: fadeAnims[index] || 1,
              transform: [{ translateY: slideAnims[index] || 0 }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.cardHeader}>
            <View style={styles.iconBadge}>
              <Ionicons name="sparkles" size={20} color={Colors.primary} />
            </View>
            <View style={styles.cardTitleContainer}>
              <Text style={styles.cardTitle}>{rec.title}</Text>
              <Text style={styles.cardDescription}>{rec.description}</Text>
            </View>
            <View style={[styles.confidenceBadge, { backgroundColor: getConfidenceColor(rec.confidence) + '20' }]}>
              <Text style={[styles.confidenceText, { color: getConfidenceColor(rec.confidence) }]}>
                {(rec.confidence * 100).toFixed(0)}%
              </Text>
            </View>
          </View>

          {/* Reasoning */}
          <View style={styles.reasoningSection}>
            <Text style={styles.sectionLabel}>Why this works for you</Text>
            {rec.reasoning.map((reason, i) => (
              <View key={i} style={styles.reasonItem}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.primary} style={styles.reasonIcon} />
                <Text style={styles.reasonText}>{reason}</Text>
              </View>
            ))}
          </View>

          {/* Color Palette */}
          {rec.suggestedColors.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Suggested Colors</Text>
              <View style={styles.colorPalette}>
                {rec.suggestedColors.map((color, i) => (
                  <View key={i} style={styles.colorItem}>
                    <View style={[styles.colorDot, { backgroundColor: color.toLowerCase() }]} />
                    <Text style={styles.colorName}>{color}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Style Archetypes */}
          {rec.suggestedArchetypes.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Style Vibe</Text>
              <View style={styles.tagsContainer}>
                {rec.suggestedArchetypes.map((archetype, i) => (
                  <View key={i} style={styles.tag}>
                    <Text style={styles.tagText}>{archetype}</Text>
                  </View>
                ))}
                {rec.colorHarmony && (
                  <View style={[styles.tag, styles.harmonyTag]}>
                    <Ionicons name="color-palette" size={12} color={Colors.primary} />
                    <Text style={styles.tagText}> {rec.colorHarmony}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Suggested Garments */}
          {rec.suggestedGarments.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Key Pieces</Text>
              <View style={styles.garmentList}>
                {rec.suggestedGarments.map((garment, i) => (
                  <View key={i} style={styles.garmentItem}>
                    <Ionicons name="shirt-outline" size={14} color={Colors.textMuted} />
                    <Text style={styles.garmentText}>{garment}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </Animated.View>
      ))}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const recUpgradeButtonStyle = {
  marginTop: 24,
  backgroundColor: Colors.primary,
  paddingHorizontal: 32,
  paddingVertical: 14,
  borderRadius: 12,
};

const recUpgradeButtonTextStyle = {
  color: '#FFF',
  fontSize: 16,
  fontWeight: '700' as const,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.textMuted,
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  errorSubtext: {
    color: Colors.textMuted,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
    gap: 8,
  },
  retryText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  recommendationCard: {
    backgroundColor: '#1E293B',
    margin: 16,
    marginTop: 16,
    marginBottom: 0,
    borderRadius: 16,
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardTitleContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  cardDescription: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  confidenceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '600',
  },
  reasoningSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  reasonIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  reasonText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  section: {
    marginTop: 16,
  },
  colorPalette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  colorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#475569',
  },
  colorName: {
    fontSize: 13,
    color: Colors.text,
    textTransform: 'capitalize',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  harmonyTag: {
    backgroundColor: 'rgba(236, 72, 153, 0.1)',
    borderColor: 'rgba(236, 72, 153, 0.2)',
  },
  tagText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  garmentList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  garmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(100, 116, 139, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 6,
  },
  garmentText: {
    fontSize: 12,
    color: Colors.textMuted,
    textTransform: 'capitalize',
  },
  // Skeleton loader styles
  skeletonHeader: {
    height: 60,
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
    borderRadius: 12,
  },
  skeletonLine: {
    height: 12,
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
    borderRadius: 6,
    marginTop: 8,
  },
  skeletonPill: {
    height: 28,
    width: 80,
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
    borderRadius: 14,
  },
});
