import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../src/constants/theme';

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
    backgroundColor: Colors.surface,
    borderRadius: 9999,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  scrollView: {
    flex: 1,
  },
  intro: {
    padding: Spacing.lg,
    backgroundColor: Colors.primaryAlpha10,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  introTitle: {
    fontSize: FontSize.xl,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: Spacing.sm,
  },
  introText: {
    fontSize: FontSize.md,
    color: Colors.text,
    lineHeight: 22,
  },
  guidelineCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  guidelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryAlpha10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  guidelineTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  guidelineDescription: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  reportSection: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
    padding: Spacing.md,
    backgroundColor: Colors.infoAlpha10,
    borderRadius: BorderRadius.lg,
    borderLeftWidth: 4,
    borderLeftColor: Colors.info,
  },
  reportTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.info,
    marginBottom: Spacing.xs,
  },
  reportText: {
    fontSize: FontSize.sm,
    color: Colors.text,
    lineHeight: 20,
  },
  footer: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
  },
  footerText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
