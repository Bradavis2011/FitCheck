import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, Animated } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getStyleEvolution, StyleEvolutionResponse } from '../src/services/style-intelligence.service';
import SimpleLineChart from '../src/components/SimpleLineChart';
import { Colors } from '../src/constants/theme';

type MetricKey = 'avgOverallScore' | 'avgColorScore' | 'avgFitScore' | 'avgProportionScore' | 'avgCoherenceScore';

const METRICS: Array<{ key: MetricKey; label: string; color: string }> = [
  { key: 'avgOverallScore', label: 'Overall Score', color: '#E85D4C' },
  { key: 'avgColorScore', label: 'Color', color: '#FF7A6B' },
  { key: 'avgFitScore', label: 'Fit', color: '#10B981' },
  { key: 'avgProportionScore', label: 'Proportion', color: '#F59E0B' },
  { key: 'avgCoherenceScore', label: 'Coherence', color: '#8B5CF6' },
];

export default function StyleEvolutionScreen() {
  const [loading, setLoading] = useState(true);
  const [evolution, setEvolution] = useState<StyleEvolutionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('avgOverallScore');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadEvolution();
  }, []);

  useEffect(() => {
    if (!loading && evolution) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }
  }, [loading, evolution]);

  const loadEvolution = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getStyleEvolution();
      setEvolution(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load style evolution');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Style Evolution' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading your style journey...</Text>
        </View>
      </View>
    );
  }

  if (error || !evolution || evolution.weeklyData.length === 0) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Style Evolution' }} />
        <View style={styles.errorContainer}>
          <Ionicons name="trending-up" size={64} color={Colors.textMuted} />
          <Text style={styles.errorText}>
            {error || 'Not enough data yet'}
          </Text>
          <Text style={styles.errorSubtext}>
            {error
              ? 'Something went wrong. Please try again.'
              : 'Submit more outfits to see your style evolution over time!'}
          </Text>
          {error && (
            <TouchableOpacity
              style={styles.retryButton}
              onPress={loadEvolution}
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

  const selectedMetricData = METRICS.find(m => m.key === selectedMetric)!;

  const chartData = evolution.weeklyData.map(week => ({
    label: week.week.replace(/^\d{4}-W/, 'W'),
    value: week[selectedMetric],
  }));

  // Calculate trend
  const recentAvg = chartData.slice(-3).reduce((sum, d) => sum + d.value, 0) / 3;
  const olderAvg = chartData.slice(0, 3).reduce((sum, d) => sum + d.value, 0) / 3;
  const trend = recentAvg > olderAvg ? 'up' : recentAvg < olderAvg ? 'down' : 'stable';
  const trendPercent = Math.abs(((recentAvg - olderAvg) / olderAvg) * 100);

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen options={{ title: 'Style Evolution' }} />
      <Animated.View style={{ opacity: fadeAnim }}>
        {/* Header */}
        <View style={styles.header}>
        <Text style={styles.title}>Your Style Journey</Text>
        <Text style={styles.subtitle}>
          {evolution.weeklyData.length} weeks of data
        </Text>
      </View>

      {/* Metric Selector */}
      <View style={styles.metricSelector}>
        <Text style={styles.sectionLabel}>Select Metric</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.metricButtons}>
            {METRICS.map(metric => (
              <TouchableOpacity
                key={metric.key}
                style={[
                  styles.metricButton,
                  selectedMetric === metric.key && {
                    backgroundColor: metric.color,
                    borderColor: metric.color,
                  },
                ]}
                onPress={() => setSelectedMetric(metric.key)}
              >
                <Text
                  style={[
                    styles.metricButtonText,
                    selectedMetric === metric.key && styles.metricButtonTextActive,
                  ]}
                >
                  {metric.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Trend Indicator */}
      <View style={styles.trendCard}>
        <View style={styles.trendHeader}>
          <Ionicons
            name={trend === 'up' ? 'trending-up' : trend === 'down' ? 'trending-down' : 'remove'}
            size={24}
            color={trend === 'up' ? '#10B981' : trend === 'down' ? '#EF4444' : Colors.textMuted}
          />
          <Text style={styles.trendLabel}>
            {trend === 'up' ? 'Improving' : trend === 'down' ? 'Declining' : 'Stable'}
          </Text>
        </View>
        <Text style={styles.trendText}>
          {trendPercent > 1 && (
            <>
              {trend === 'up' ? '↗' : '↘'} {trendPercent.toFixed(1)}% vs earlier weeks
            </>
          )}
          {trendPercent <= 1 && 'Consistent performance'}
        </Text>
      </View>

      {/* Chart */}
      <View style={styles.chartSection}>
        <SimpleLineChart
          data={chartData}
          height={250}
          color={selectedMetricData.color}
          label={`${selectedMetricData.label} Over Time`}
        />
      </View>

      {/* Weekly Stats */}
      <View style={styles.statsSection}>
        <Text style={styles.sectionLabel}>Weekly Breakdown</Text>
        {evolution.weeklyData.slice().reverse().map((week, index) => (
          <View key={week.week} style={styles.weekCard}>
            <View style={styles.weekHeader}>
              <Text style={styles.weekLabel}>{week.week}</Text>
              <Text style={styles.weekCount}>{week.outfitCount} outfits</Text>
            </View>
            <View style={styles.weekScores}>
              <View style={styles.scoreRow}>
                <Text style={styles.scoreLabel}>Overall</Text>
                <Text style={styles.scoreValue}>{week.avgOverallScore.toFixed(1)}</Text>
              </View>
              <View style={styles.scoreRow}>
                <Text style={styles.scoreLabel}>Color</Text>
                <Text style={styles.scoreValue}>{week.avgColorScore.toFixed(1)}</Text>
              </View>
              <View style={styles.scoreRow}>
                <Text style={styles.scoreLabel}>Fit</Text>
                <Text style={styles.scoreValue}>{week.avgFitScore.toFixed(1)}</Text>
              </View>
            </View>
          </View>
        ))}
      </View>

        <View style={{ height: 40 }} />
      </Animated.View>
    </ScrollView>
  );
}

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
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  metricSelector: {
    padding: 24,
    paddingBottom: 16,
  },
  metricButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  metricButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#475569',
    backgroundColor: 'transparent',
  },
  metricButtonText: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  metricButtonTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  trendCard: {
    marginHorizontal: 24,
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#1E293B',
    borderRadius: 12,
  },
  trendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  trendLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  trendText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  chartSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  statsSection: {
    padding: 24,
  },
  weekCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  weekLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  weekCount: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  weekScores: {
    gap: 8,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scoreLabel: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  scoreValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
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
});
