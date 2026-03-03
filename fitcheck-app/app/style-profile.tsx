import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useState, useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getStyleProfile, StyleProfileResponse } from '../src/services/style-intelligence.service';
import { useSubscriptionStore } from '../src/stores/subscriptionStore';
import { track } from '../src/lib/analytics';
import { Colors, Spacing, FontSize, BorderRadius, Fonts, getScoreColor } from '../src/constants/theme';

export default function StyleProfileScreen() {
  const { tier } = useSubscriptionStore();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<StyleProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { track('feature_used', { feature: 'style_profile' }); }, []);

  useEffect(() => {
    if (tier === 'pro') {
      loadStyleProfile();
    }
  }, [tier]);

  const loadStyleProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getStyleProfile();
      setProfile(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load style profile');
    } finally {
      setLoading(false);
    }
  };

  if (tier !== 'pro') {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Style Profile' }} />
        <View style={styles.errorContainer}>
          <Ionicons name="diamond-outline" size={64} color={Colors.primary} />
          <Text style={styles.errorText}>Pro Feature</Text>
          <Text style={styles.errorSubtext}>
            Style Analytics requires a Pro subscription. Upgrade to unlock your Style DNA, color analysis, and more.
          </Text>
          <TouchableOpacity
            style={styles.upgradeButton}
            onPress={() => router.push('/upgrade' as any)}
          >
            <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Style Profile' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading your style profile...</Text>
        </View>
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Style Profile' }} />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={Colors.error} />
          <Text style={styles.errorText}>{error || 'No style data yet'}</Text>
          <Text style={styles.errorSubtext}>
            Submit a few outfits to build your style profile!
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen options={{ title: 'Style Profile' }} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Your Style DNA</Text>
        <Text style={styles.subtitle}>
          Based on {profile.totalOutfits} outfit{profile.totalOutfits !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Average Scores */}
      {profile.averageScores && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Style Strengths</Text>
          <View style={styles.scoresGrid}>
            {[
              { label: 'Color', value: profile.averageScores.colorCoordination },
              { label: 'Proportions', value: profile.averageScores.proportions },
              { label: 'Fit', value: profile.averageScores.fit },
              { label: 'Coherence', value: profile.averageScores.styleCoherence },
            ].map((item) => (
              <View key={item.label} style={styles.scoreCard}>
                <Text style={styles.scoreLabel}>{item.label}</Text>
                <Text style={[styles.scoreValue, { color: getScoreColor(item.value) }]}>
                  {item.value.toFixed(1)}
                </Text>
                <Text style={styles.scoreMax}>/10</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Top Colors */}
      {profile.topColors.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Best Colors</Text>
          <Text style={styles.sectionSubtitle}>
            Colors that score highest in your outfits
          </Text>
          {profile.topColors.slice(0, 5).map((colorData) => (
            <View key={colorData.color} style={styles.colorRow}>
              <View style={styles.colorInfo}>
                <View style={[styles.colorDot, { backgroundColor: colorData.color.toLowerCase() }]} />
                <Text style={styles.colorName}>{colorData.color}</Text>
              </View>
              <View style={styles.colorStats}>
                <Text style={[styles.colorScore, { color: getScoreColor(colorData.avgScore) }]}>
                  {colorData.avgScore.toFixed(1)}
                </Text>
                <Text style={styles.colorCount}>× {colorData.appearances}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Dominant Archetypes */}
      {profile.dominantArchetypes.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Style Identity</Text>
          <Text style={styles.sectionSubtitle}>
            Most common style archetypes in your wardrobe
          </Text>
          {profile.dominantArchetypes.map((archetype) => (
            <View key={archetype.archetype} style={styles.archetypeRow}>
              <View style={styles.archetypeInfo}>
                <Text style={styles.archetypeName}>{archetype.archetype}</Text>
                <Text style={styles.archetypePercentage}>{archetype.percentage.toFixed(0)}%</Text>
              </View>
              <View style={styles.archetypeBar}>
                <View
                  style={[
                    styles.archetypeBarFill,
                    { width: `${archetype.percentage}%` },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Recommendations Link */}
      <TouchableOpacity
        style={styles.evolutionButton}
        onPress={() => router.push('/recommendations' as any)}
        activeOpacity={0.7}
      >
        <View style={styles.evolutionIcon}>
          <Ionicons name="sparkles" size={24} color={Colors.primaryLight} />
        </View>
        <View style={styles.evolutionText}>
          <Text style={styles.evolutionTitle}>Get Outfit Recommendations</Text>
          <Text style={styles.evolutionSubtitle}>AI-powered suggestions based on your style DNA</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
      </TouchableOpacity>

      {/* Style Evolution Link */}
      <TouchableOpacity
        style={styles.evolutionButton}
        onPress={() => router.push('/style-evolution' as any)}
        activeOpacity={0.7}
      >
        <View style={styles.evolutionIcon}>
          <Ionicons name="trending-up" size={24} color={Colors.primary} />
        </View>
        <View style={styles.evolutionText}>
          <Text style={styles.evolutionTitle}>View Style Evolution</Text>
          <Text style={styles.evolutionSubtitle}>See how your style changes over time</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
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
  loadingText: {
    fontFamily: Fonts.sans,
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
    fontFamily: Fonts.sansSemiBold,
    color: Colors.error,
    fontSize: 18,
    marginTop: 16,
    textAlign: 'center',
  },
  errorSubtext: {
    fontFamily: Fonts.sans,
    color: Colors.textMuted,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  upgradeButton: {
    marginTop: 24,
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: BorderRadius.sharp,
  },
  upgradeButtonText: {
    fontFamily: Fonts.sansBold,
    color: Colors.white,
    fontSize: 16,
    textTransform: 'uppercase',
    letterSpacing: 1.65,
  },
  header: {
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 30,
    lineHeight: 38,
    color: Colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Colors.textMuted,
  },
  section: {
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sectionTitle: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 2.2,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 16,
  },
  scoresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  scoreCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    alignItems: 'center',
  },
  scoreLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 2.2,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  scoreValue: {
    fontFamily: Fonts.sansBold,
    fontSize: 32,
  },
  scoreMax: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: -4,
  },
  colorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  colorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  colorDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderSolid,
  },
  colorName: {
    fontFamily: Fonts.sans,
    fontSize: 16,
    color: Colors.text,
    textTransform: 'capitalize',
  },
  colorStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorScore: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 18,
  },
  colorCount: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Colors.textMuted,
  },
  archetypeRow: {
    marginBottom: 16,
  },
  archetypeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  archetypeName: {
    fontFamily: Fonts.sansMedium,
    fontSize: 16,
    color: Colors.text,
    textTransform: 'capitalize',
  },
  archetypePercentage: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 14,
    color: Colors.primary,
  },
  archetypeBar: {
    height: 8,
    backgroundColor: Colors.backgroundSecondary,
    overflow: 'hidden',
  },
  archetypeBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  evolutionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    marginTop: 16,
    padding: 16,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  evolutionIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primaryAlpha10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  evolutionText: {
    flex: 1,
  },
  evolutionTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 16,
    color: Colors.text,
    marginBottom: 2,
  },
  evolutionSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.textMuted,
  },
});
