import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius, Fonts } from '../src/constants/theme';

export default function CommunityGuidelinesScreen() {
  const router = useRouter();

  const guidelines = [
    {
      icon: 'heart',
      title: 'Be Respectful',
      description:
        'Treat everyone with kindness and respect. We celebrate diverse styles and perspectives.',
    },
    {
      icon: 'chatbubbles',
      title: 'Constructive Feedback Only',
      description:
        'Give helpful, specific feedback. Focus on the outfit, not the person. Be encouraging and supportive.',
    },
    {
      icon: 'shield-checkmark',
      title: 'No Harassment',
      description:
        'Harassment, bullying, or hateful content of any kind will not be tolerated. This includes body shaming, discrimination, or personal attacks.',
    },
    {
      icon: 'sparkles',
      title: 'Fashion is Subjective',
      description:
        'Remember that style is personal. What works for one person may not work for another, and that\'s okay!',
    },
    {
      icon: 'shirt',
      title: 'Appropriate Content',
      description:
        'Share outfits that are appropriate for a public community. No explicit, offensive, or spam content.',
    },
    {
      icon: 'people',
      title: 'Build Community',
      description:
        'Help others grow their style confidence. Uplift, inspire, and learn from each other.',
    },
  ];

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Community Guidelines</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.intro}>
            <Text style={styles.introTitle}>Welcome to Or This? Community</Text>
            <Text style={styles.introText}>
              Our community thrives when everyone feels safe, respected, and inspired. Please
              follow these guidelines to help us maintain a positive environment for fashion
              enthusiasts of all styles.
            </Text>
          </View>

          {guidelines.map((guideline, index) => (
            <View key={index} style={styles.guidelineCard}>
              <View style={styles.guidelineHeader}>
                <View style={styles.iconContainer}>
                  <Ionicons name={guideline.icon as any} size={24} color={Colors.primary} />
                </View>
                <Text style={styles.guidelineTitle}>{guideline.title}</Text>
              </View>
              <Text style={styles.guidelineDescription}>{guideline.description}</Text>
            </View>
          ))}

          <View style={styles.reportSection}>
            <Text style={styles.reportTitle}>Report Violations</Text>
            <Text style={styles.reportText}>
              If you see content that violates these guidelines, please report it using the report
              button. Our team reviews all reports and takes appropriate action.
            </Text>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              By participating in the Or This? community, you agree to follow these guidelines.
              Violations may result in content removal or account suspension.
            </Text>
          </View>

          <View style={{ height: 60 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: Fonts.serif,
    fontSize: FontSize.lg,
    color: Colors.text,
  },
  scrollView: {
    flex: 1,
  },
  intro: {
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  introTitle: {
    fontFamily: Fonts.serif,
    fontSize: FontSize.xl,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  introText: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  guidelineCard: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    padding: Spacing.lg,
    marginHorizontal: Spacing.md,
  },
  guidelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryAlpha10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guidelineTitle: {
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.md,
    color: Colors.text,
    flex: 1,
  },
  guidelineDescription: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  reportSection: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
    padding: Spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: Colors.primary,
  },
  reportTitle: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 2.2,
    marginBottom: Spacing.xs,
  },
  reportText: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  footer: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  footerText: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
