import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useState, useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getStyleProfile, StyleProfileResponse } from '../src/services/style-intelligence.service';
import { useSubscriptionStore } from '../src/stores/subscriptionStore';

export default function StyleProfileScreen() {
  const { tier } = useSubscriptionStore();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<StyleProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const getScoreColor = (score: number) => {
    if (score >= 8) return '#10B981';  // Green
    if (score >= 6) return '#F59E0B';  // Amber
    return '#EF4444';                   // Red
  };

  if (tier !== 'pro') {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Style Profile' }} />
        <View style={styles.errorContainer}>
          <Ionicons name="diamond-outline" size={64} color="#E85D4C" />
          <Text style={styles.errorText}>Pro Feature</Text>
          <Text style={styles.errorSubtext}>
            Style Analytics requires a Pro subscription. Upgrade to unlock your Style DNA, color analysis, and more.
          </Text>
          <TouchableOpacity
            style={upgradeButtonStyle}
            onPress={() => router.push('/upgrade' as any)}
          >
            <Text style={upgradeButtonTextStyle}>Upgrade to Pro</Text>
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
          <ActivityIndicator size="large" color="#E85D4C" />
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
          <Ionicons name="alert-circle" size={64} color="#EF4444" />
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
          <Ionicons name="sparkles" size={24} color="#FF7A6B" />
        </View>
        <View style={styles.evolutionText}>
          <Text style={styles.evolutionTitle}>Get Outfit Recommendations</Text>
          <Text style={styles.evolutionSubtitle}>AI-powered suggestions based on your style DNA</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#64748B" />
      </TouchableOpacity>

      {/* Style Evolution Link */}
      <TouchableOpacity
        style={styles.evolutionButton}
        onPress={() => router.push('/style-evolution' as any)}
        activeOpacity={0.7}
      >
        <View style={styles.evolutionIcon}>
          <Ionicons name="trending-up" size={24} color="#E85D4C" />
        </View>
        <View style={styles.evolutionText}>
          <Text style={styles.evolutionTitle}>View Style Evolution</Text>
          <Text style={styles.evolutionSubtitle}>See how your style changes over time</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#64748B" />
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const upgradeButtonStyle = {
  marginTop: 24,
  backgroundColor: '#E85D4C',
  paddingHorizontal: 32,
  paddingVertical: 14,
  borderRadius: 12,
};

const upgradeButtonTextStyle = {
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
    color: '#94A3B8',
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
    color: '#EF4444',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  errorSubtext: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  header: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
  },
  section: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#F1F5F9',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 16,
  },
  scoresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  scoreCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  scoreMax: {
    fontSize: 14,
    color: '#64748B',
    marginTop: -4,
  },
  colorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
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
    borderColor: '#475569',
  },
  colorName: {
    fontSize: 16,
    color: '#F1F5F9',
    textTransform: 'capitalize',
  },
  colorStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorScore: {
    fontSize: 18,
    fontWeight: '600',
  },
  colorCount: {
    fontSize: 14,
    color: '#94A3B8',
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
    fontSize: 16,
    color: '#F1F5F9',
    textTransform: 'capitalize',
    fontWeight: '500',
  },
  archetypePercentage: {
    fontSize: 14,
    color: '#E85D4C',
    fontWeight: '600',
  },
  archetypeBar: {
    height: 8,
    backgroundColor: '#1E293B',
    borderRadius: 4,
    overflow: 'hidden',
  },
  archetypeBarFill: {
    height: '100%',
    backgroundColor: '#E85D4C',
    borderRadius: 4,
  },
  evolutionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    marginHorizontal: 24,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  evolutionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  evolutionText: {
    flex: 1,
  },
  evolutionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F1F5F9',
    marginBottom: 2,
  },
  evolutionSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
  },
});
