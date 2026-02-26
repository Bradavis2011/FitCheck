import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius, Fonts } from '../src/constants/theme';
import PillButton from '../src/components/PillButton';
import { useUser, useUpdateProfile } from '../src/hooks/useApi';

const STYLE_CATEGORIES = [
  'Casual',
  'Formal',
  'Streetwear',
  'Minimalist',
  'Bohemian',
  'Preppy',
  'Edgy',
  'Vintage',
  'Sporty',
  'Elegant',
];

const FASHION_PRIORITIES = [
  { id: 'comfort', label: 'Comfort', icon: 'happy-outline' as const },
  { id: 'style', label: 'Style', icon: 'star-outline' as const },
  { id: 'trends', label: 'On-trend', icon: 'trending-up-outline' as const },
  { id: 'versatility', label: 'Versatility', icon: 'repeat-outline' as const },
  { id: 'budget', label: 'Budget-friendly', icon: 'wallet-outline' as const },
];

const BODY_CONCERNS = [
  'Highlight shoulders',
  'Define waist',
  'Elongate legs',
  'Balance proportions',
  'Minimize specific areas',
  'No specific concerns',
];

export default function StylePreferencesScreen() {
  const router = useRouter();
  const { data: user, isLoading } = useUser();
  const updateProfile = useUpdateProfile();
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [selectedConcerns, setSelectedConcerns] = useState<string[]>([]);
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  // Load existing preferences when user data is available
  useEffect(() => {
    if (user?.stylePreferences) {
      setSelectedStyles(user.stylePreferences.styles || []);
      setSelectedPriorities(user.stylePreferences.priorities || []);
      setSelectedConcerns(user.stylePreferences.bodyConcerns || []);
    }
  }, [user]);

  const toggleStyle = (style: string) => {
    setSelectedStyles((prev) =>
      prev.includes(style) ? prev.filter((s) => s !== style) : [...prev, style]
    );
  };

  const togglePriority = (priority: string) => {
    setSelectedPriorities((prev) =>
      prev.includes(priority) ? prev.filter((p) => p !== priority) : [...prev, priority]
    );
  };

  const toggleConcern = (concern: string) => {
    setSelectedConcerns((prev) =>
      prev.includes(concern) ? prev.filter((c) => c !== concern) : [...prev, concern]
    );
  };

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    router.back();
  };

  const handleComplete = async () => {
    setIsSaving(true);
    try {
      await updateProfile.mutateAsync({
        stylePreferences: {
          styles: selectedStyles,
          priorities: selectedPriorities,
          bodyConcerns: selectedConcerns,
        },
      } as any);

      Alert.alert('Success', 'Your style preferences have been saved!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      console.error('[StylePreferences] Failed to save:', error);
      Alert.alert('Error', 'Failed to save preferences. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const canProceed = () => {
    if (step === 1) return selectedStyles.length > 0;
    if (step === 2) return selectedPriorities.length > 0;
    if (step === 3) return selectedConcerns.length > 0;
    return false;
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading your preferences...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Style Profile</Text>
        <TouchableOpacity onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Progress */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${(step / 3) * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>Step {step} of 3</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Step 1: Style Categories */}
        {step === 1 && (
          <View style={styles.stepContent}>
            <View style={styles.iconContainer}>
              <View style={styles.iconBox}>
                <Ionicons name="shirt-outline" size={40} color={Colors.white} />
              </View>
            </View>

            <Text style={styles.stepTitle}>What's your style?</Text>
            <Text style={styles.stepSubtitle}>
              Select all styles that describe you (choose at least one)
            </Text>

            <View style={styles.pillsContainer}>
              {STYLE_CATEGORIES.map((style) => (
                <PillButton
                  key={style}
                  label={style}
                  selected={selectedStyles.includes(style)}
                  onPress={() => toggleStyle(style)}
                />
              ))}
            </View>
          </View>
        )}

        {/* Step 2: Fashion Priorities */}
        {step === 2 && (
          <View style={styles.stepContent}>
            <View style={styles.iconContainer}>
              <View style={styles.iconBox}>
                <Ionicons name="star-outline" size={40} color={Colors.white} />
              </View>
            </View>

            <Text style={styles.stepTitle}>What matters most?</Text>
            <Text style={styles.stepSubtitle}>
              Choose your top fashion priorities (select 1-3)
            </Text>

            <View style={styles.optionsList}>
              {FASHION_PRIORITIES.map((priority) => (
                <TouchableOpacity
                  key={priority.id}
                  style={[
                    styles.optionCard,
                    selectedPriorities.includes(priority.id) && styles.optionCardSelected,
                  ]}
                  onPress={() => togglePriority(priority.id)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.optionIconContainer,
                      selectedPriorities.includes(priority.id) && styles.optionIconSelected,
                    ]}
                  >
                    <Ionicons
                      name={priority.icon}
                      size={24}
                      color={
                        selectedPriorities.includes(priority.id)
                          ? Colors.white
                          : Colors.primary
                      }
                    />
                  </View>
                  <Text
                    style={[
                      styles.optionLabel,
                      selectedPriorities.includes(priority.id) && styles.optionLabelSelected,
                    ]}
                  >
                    {priority.label}
                  </Text>
                  {selectedPriorities.includes(priority.id) && (
                    <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Step 3: Body Concerns */}
        {step === 3 && (
          <View style={styles.stepContent}>
            <View style={styles.iconContainer}>
              <View style={styles.iconBox}>
                <Ionicons name="body-outline" size={40} color={Colors.white} />
              </View>
            </View>

            <Text style={styles.stepTitle}>Any styling goals?</Text>
            <Text style={styles.stepSubtitle}>
              This helps us give better tailored feedback (optional)
            </Text>

            <View style={styles.pillsContainer}>
              {BODY_CONCERNS.map((concern) => (
                <PillButton
                  key={concern}
                  label={concern}
                  selected={selectedConcerns.includes(concern)}
                  onPress={() => toggleConcern(concern)}
                />
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextButton, (!canProceed() || isSaving) && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={!canProceed() || isSaving}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <>
              <Text
                style={[styles.nextButtonText, !canProceed() && styles.nextButtonTextDisabled]}
              >
                {step === 3 ? 'Complete' : 'Next'}
              </Text>
              <Ionicons
                name={step === 3 ? 'checkmark' : 'arrow-forward'}
                size={20}
                color={canProceed() ? Colors.white : Colors.textMuted}
              />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
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
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
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
    fontFamily: Fonts.sansBold,
    fontSize: FontSize.lg,
    color: Colors.text,
  },
  skipText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: FontSize.md,
    color: Colors.primary,
  },
  progressContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  progressBar: {
    height: 2,
    backgroundColor: Colors.surface,
    borderRadius: 0,
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 0,
  },
  progressText: {
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  stepContent: {
    padding: Spacing.lg,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  iconBox: {
    width: 72,
    height: 72,
    borderRadius: 0,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepTitle: {
    fontFamily: Fonts.serif,
    fontSize: 28,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  stepSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  pillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'center',
  },
  optionsList: {
    gap: Spacing.sm,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: Spacing.md,
  },
  optionCardSelected: {
    backgroundColor: Colors.primaryAlpha10,
    borderColor: Colors.primary,
  },
  optionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primaryAlpha10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionIconSelected: {
    backgroundColor: Colors.primary,
  },
  optionLabel: {
    flex: 1,
    fontFamily: Fonts.sansSemiBold,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  optionLabelSelected: {
    color: Colors.primary,
  },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.primary,
    borderRadius: 0,
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.65,
    color: Colors.white,
  },
  nextButtonTextDisabled: {
    color: Colors.textMuted,
  },
});
