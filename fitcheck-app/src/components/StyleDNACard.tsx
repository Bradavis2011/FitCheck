import { View, Text, StyleSheet } from 'react-native';
import { StyleDNA } from '../services/api.service';
import FeedbackCard from './FeedbackCard';
import { Colors, Fonts } from '../constants/theme';

interface StyleDNACardProps {
  styleDNA: StyleDNA;
  delay?: number;
}

// Maps fashion color names (AI output) to valid hex/CSS colors for React Native
const FASHION_COLORS: Record<string, string> = {
  // Neutrals
  'black': '#000000', 'white': '#FFFFFF', 'cream': '#FFFDD0', 'ivory': '#FFFFF0',
  'off-white': '#FAF9F6', 'eggshell': '#F0EAD6', 'beige': '#F5F5DC',
  'tan': '#D2B48C', 'camel': '#C19A6B', 'khaki': '#C3B091', 'sand': '#C2B280',
  'taupe': '#B09080', 'charcoal': '#36454F', 'grey': '#808080', 'gray': '#808080',
  'light gray': '#D3D3D3', 'dark gray': '#404040', 'silver': '#C0C0C0',
  // Browns
  'brown': '#8B4513', 'chocolate': '#7B3F00', 'coffee': '#6F4E37',
  'cognac': '#9F381D', 'rust': '#B7410E', 'terracotta': '#E2725B',
  // Reds / Pinks
  'red': '#FF0000', 'burgundy': '#800020', 'maroon': '#800000', 'wine': '#722F37',
  'crimson': '#DC143C', 'coral': '#FF7F50', 'salmon': '#FA8072',
  'rose': '#FF007F', 'blush': '#DE5D83', 'pink': '#FFC0CB', 'mauve': '#E0B0FF',
  // Blues
  'navy': '#000080', 'royal blue': '#4169E1', 'blue': '#0000FF',
  'sky blue': '#87CEEB', 'light blue': '#ADD8E6', 'baby blue': '#89CFF0',
  'cobalt': '#0047AB', 'teal': '#008080', 'indigo': '#4B0082', 'denim': '#1560BD',
  // Greens
  'olive': '#808000', 'forest green': '#228B22', 'sage': '#BCB88A',
  'emerald': '#50C878', 'mint': '#98FF98', 'hunter green': '#355E3B',
  'moss': '#8A9A5B', 'army green': '#4B5320', 'green': '#008000',
  // Yellows / Oranges
  'mustard': '#FFDB58', 'gold': '#FFD700', 'yellow': '#FFFF00',
  'amber': '#FFBF00', 'orange': '#FFA500', 'peach': '#FFCBA4',
  'apricot': '#FBCEB1',
  // Purples
  'lavender': '#E6E6FA', 'lilac': '#C8A2C8', 'plum': '#8E4585',
  'purple': '#800080', 'violet': '#EE82EE', 'eggplant': '#614051',
};

const resolveColor = (name: string): string => {
  const lower = name.toLowerCase().trim();
  return FASHION_COLORS[lower] || lower;
};

export default function StyleDNACard({ styleDNA, delay = 600 }: StyleDNACardProps) {
  const getFormalityLabel = (level: number | null) => {
    if (level == null) return 'Unknown';
    if (level === 1) return 'Very Casual';
    if (level === 2) return 'Casual';
    if (level === 3) return 'Smart Casual';
    if (level === 4) return 'Business';
    return 'Formal';
  };

  const getScoreColor = (score: number | null) => {
    if (score == null) return Colors.textMuted;
    if (score >= 8) return '#10B981';
    if (score >= 6) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <FeedbackCard
      title="Style DNA"
      icon=""
      iconColor={Colors.primary}
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
                    { backgroundColor: resolveColor(color) }
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
            {styleDNA.garments.join(' · ')}
          </Text>
        </View>
      )}

      {/* Sub-Scores */}
      {(styleDNA.colorScore != null || styleDNA.proportionScore != null || styleDNA.fitScore != null || styleDNA.coherenceScore != null) && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Detailed Scores</Text>
          <View style={styles.scoresGrid}>
            {styleDNA.colorScore != null && (
              <View style={styles.scoreItem}>
                <Text style={styles.scoreLabel}>Color</Text>
                <Text style={[styles.scoreValue, { color: getScoreColor(styleDNA.colorScore) }]}>
                  {styleDNA.colorScore.toFixed(1)}
                </Text>
              </View>
            )}
            {styleDNA.proportionScore != null && (
              <View style={styles.scoreItem}>
                <Text style={styles.scoreLabel}>Proportion</Text>
                <Text style={[styles.scoreValue, { color: getScoreColor(styleDNA.proportionScore) }]}>
                  {styleDNA.proportionScore.toFixed(1)}
                </Text>
              </View>
            )}
            {styleDNA.fitScore != null && (
              <View style={styles.scoreItem}>
                <Text style={styles.scoreLabel}>Fit</Text>
                <Text style={[styles.scoreValue, { color: getScoreColor(styleDNA.fitScore) }]}>
                  {styleDNA.fitScore.toFixed(1)}
                </Text>
              </View>
            )}
            {styleDNA.coherenceScore != null && (
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
          Style data improves your recommendations over time
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
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 2.2,
    color: Colors.textMuted,
    marginBottom: 10,
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
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
    marginBottom: 4,
  },
  colorText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: 'capitalize',
  },
  harmonyText: {
    fontFamily: Fonts.sans,
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
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 0,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  formalityTag: {
    borderColor: Colors.primaryAlpha30,
  },
  tagText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: Colors.text,
  },
  garmentText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    textTransform: 'capitalize',
  },
  scoresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  scoreItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 0,
    padding: 12,
    alignItems: 'center',
  },
  scoreLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  scoreValue: {
    fontFamily: Fonts.serif,
    fontSize: 24,
  },
  footer: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  footerText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
