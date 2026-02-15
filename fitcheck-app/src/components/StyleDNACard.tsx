import { View, Text, StyleSheet } from 'react-native';
import { StyleDNA } from '../services/api.service';
import FeedbackCard from './FeedbackCard';
import { Colors } from '../constants/theme';

interface StyleDNACardProps {
  styleDNA: StyleDNA;
  delay?: number;
}

export default function StyleDNACard({ styleDNA, delay = 600 }: StyleDNACardProps) {
  const getFormalityLabel = (level: number | null) => {
    if (!level) return 'Unknown';
    if (level === 1) return 'Very Casual';
    if (level === 2) return 'Casual';
    if (level === 3) return 'Smart Casual';
    if (level === 4) return 'Business';
    return 'Formal';
  };

  const getScoreColor = (score: number | null) => {
    if (!score) return Colors.textMuted;
    if (score >= 8) return '#10B981';  // Green
    if (score >= 6) return '#F59E0B';  // Amber
    return '#EF4444';                   // Red
  };

  return (
    <FeedbackCard
      title="Your Style DNA"
      icon="✨"
      iconColor="#8B5CF6"
      delay={delay}
    >
      {/* Colors */}
      {styleDNA.dominantColors && styleDNA.dominantColors.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Colors</Text>
          <View style={styles.colorRow}>
            {styleDNA.dominantColors.slice(0, 5).map((color, index) => (
              <View key={index} style={styles.colorItem}>
                <View
                  style={[
                    styles.colorDot,
                    { backgroundColor: color.toLowerCase() }
                  ]}
                />
                <Text style={styles.colorText}>{color}</Text>
              </View>
            ))}
          </View>
          {styleDNA.colorHarmony && (
            <Text style={styles.harmonyText}>
              {styleDNA.colorHarmony} harmony
            </Text>
          )}
        </View>
      )}

      {/* Style Archetypes */}
      {styleDNA.styleArchetypes && styleDNA.styleArchetypes.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Style</Text>
          <View style={styles.tagContainer}>
            {styleDNA.styleArchetypes.map((archetype, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{archetype}</Text>
              </View>
            ))}
            {styleDNA.formalityLevel && (
              <View style={[styles.tag, styles.formalityTag]}>
                <Text style={styles.tagText}>
                  {getFormalityLabel(styleDNA.formalityLevel)}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Garments */}
      {styleDNA.garments && styleDNA.garments.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Detected Items</Text>
          <Text style={styles.garmentText}>
            {styleDNA.garments.join(' • ')}
          </Text>
        </View>
      )}

      {/* Sub-Scores */}
      {(styleDNA.colorScore || styleDNA.proportionScore || styleDNA.fitScore || styleDNA.coherenceScore) && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Detailed Scores</Text>
          <View style={styles.scoresGrid}>
            {styleDNA.colorScore && (
              <View style={styles.scoreItem}>
                <Text style={styles.scoreLabel}>Color</Text>
                <Text style={[styles.scoreValue, { color: getScoreColor(styleDNA.colorScore) }]}>
                  {styleDNA.colorScore.toFixed(1)}
                </Text>
              </View>
            )}
            {styleDNA.proportionScore && (
              <View style={styles.scoreItem}>
                <Text style={styles.scoreLabel}>Proportion</Text>
                <Text style={[styles.scoreValue, { color: getScoreColor(styleDNA.proportionScore) }]}>
                  {styleDNA.proportionScore.toFixed(1)}
                </Text>
              </View>
            )}
            {styleDNA.fitScore && (
              <View style={styles.scoreItem}>
                <Text style={styles.scoreLabel}>Fit</Text>
                <Text style={[styles.scoreValue, { color: getScoreColor(styleDNA.fitScore) }]}>
                  {styleDNA.fitScore.toFixed(1)}
                </Text>
              </View>
            )}
            {styleDNA.coherenceScore && (
              <View style={styles.scoreItem}>
                <Text style={styles.scoreLabel}>Coherence</Text>
                <Text style={[styles.scoreValue, { color: getScoreColor(styleDNA.coherenceScore) }]}>
                  {styleDNA.coherenceScore.toFixed(1)}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          This data helps us learn your style and give better recommendations
        </Text>
      </View>
    </FeedbackCard>
  );
}

const styles = StyleSheet.create({
  section: {
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
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorItem: {
    alignItems: 'center',
  },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.border,
    marginBottom: 4,
  },
  colorText: {
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: 'capitalize',
  },
  harmonyText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 8,
    fontStyle: 'italic',
    textTransform: 'capitalize',
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  formalityTag: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  tagText: {
    fontSize: 13,
    color: '#C4B5FD',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  garmentText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    textTransform: 'capitalize',
  },
  scoresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  scoreItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  footer: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  footerText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
