import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, Fonts, Editorial } from '../src/constants/theme';
import PillButton from '../src/components/PillButton';
import { useUser, useUpdateProfile } from '../src/hooks/useApi';

const TOTAL_STEPS = 7;

const GENDER_OPTIONS = [
  { id: 'female', label: "Women's", icon: 'woman-outline' as const, description: "Show me women's product recommendations." },
  { id: 'male',   label: "Men's",   icon: 'man-outline' as const,   description: "Show me men's product recommendations." },
  { id: null,     label: 'No preference', icon: 'people-outline' as const, description: "Use the AI's best guess per photo." },
];

const STYLE_CATEGORIES = [
  'Casual', 'Formal', 'Streetwear', 'Minimalist',
  'Bohemian', 'Preppy', 'Edgy', 'Vintage', 'Sporty', 'Elegant',
];

const FASHION_PRIORITIES = [
  { id: 'comfort',      label: 'Comfort',         icon: 'happy-outline' as const },
  { id: 'style',        label: 'Style',            icon: 'star-outline' as const },
  { id: 'trends',       label: 'On-trend',         icon: 'trending-up-outline' as const },
  { id: 'versatility',  label: 'Versatility',      icon: 'repeat-outline' as const },
  { id: 'budget',       label: 'Budget-friendly',  icon: 'wallet-outline' as const },
];

const BODY_CONCERNS = [
  'Highlight shoulders', 'Define waist', 'Elongate legs',
  'Balance proportions', 'Minimize specific areas', 'No specific concerns',
];

const HONESTY_OPTIONS = [
  {
    id: 'brutal',
    label: 'Unfiltered',
    description: "No sugar-coating. Tell me exactly what's off and how to fix it.",
    icon: 'flash-outline' as const,
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'Honest but fair — acknowledge what works, call out what doesn\'t.',
    icon: 'scale-outline' as const,
  },
  {
    id: 'gentle',
    label: 'Encouraging',
    description: 'Lead with strengths, suggest improvements as possibilities.',
    icon: 'heart-outline' as const,
  },
];

const PRESET_NO_GOS = [
  'No heels', 'No crop tops', 'No suits', 'No athleisure',
  'No miniskirts', 'No bold prints', 'No tight fits',
  'No oversized', 'No visible logos', 'No color',
];

export default function StylePreferencesScreen() {
  const router = useRouter();
  const { data: user, isLoading } = useUser();
  const updateProfile = useUpdateProfile();

  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  // Steps 1–3 (existing)
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [selectedConcerns, setSelectedConcerns] = useState<string[]>([]);

  // Steps 4–7
  const [selectedHonesty, setSelectedHonesty] = useState<string>('');
  const [selectedNoGos, setSelectedNoGos] = useState<string[]>([]);
  const [customNoGo, setCustomNoGo] = useState('');
  const [styleDirection, setStyleDirection] = useState('');
  const [selectedGender, setSelectedGender] = useState<string | null>(undefined as any);

  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (user) {
      const prefs = user.stylePreferences as any;
      if (prefs) {
        setSelectedStyles(prefs.styles || []);
        setSelectedPriorities(prefs.priorities || []);
        setSelectedConcerns(prefs.bodyConcerns || []);
      }
      if ((user as any).honestyLevel) setSelectedHonesty((user as any).honestyLevel);
      if ((user as any).styleNoGos) setSelectedNoGos((user as any).styleNoGos);
      if ((user as any).styleDirection) setStyleDirection((user as any).styleDirection);
      // undefined = not yet loaded; null = no preference; 'male'/'female' = explicit
      setSelectedGender((user as any).genderPreference ?? null);
    }
  }, [user]);

  // Scroll to top on step change
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step]);

  const canProceed = (): boolean => {
    if (step === 1) return selectedStyles.length > 0;
    if (step === 2) return selectedPriorities.length > 0;
    if (step === 3) return selectedConcerns.length > 0;
    if (step === 4) return selectedHonesty !== '';
    return true; // steps 5, 6 optional
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  const addCustomNoGo = () => {
    const trimmed = customNoGo.trim();
    if (!trimmed || selectedNoGos.includes(trimmed)) {
      setCustomNoGo('');
      return;
    }
    setSelectedNoGos((prev) => [...prev, trimmed]);
    setCustomNoGo('');
  };

  const toggleNoGo = (item: string) => {
    setSelectedNoGos((prev) =>
      prev.includes(item) ? prev.filter((n) => n !== item) : [...prev, item]
    );
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
        honestyLevel: selectedHonesty || undefined,
        styleNoGos: selectedNoGos,
        styleDirection: styleDirection.trim() || undefined,
        genderPreference: selectedGender ?? null,
      } as any);

      Alert.alert('Saved', 'Your style profile is updated.', [
        { text: 'Done', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      console.error('[StylePreferences] save failed:', error);
      Alert.alert('Error', 'Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Style Profile</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Progress */}
      <View style={styles.progressRow}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View
            key={i}
            style={[styles.progressSegment, i < step && styles.progressSegmentFilled]}
          />
        ))}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Step 1: Style Categories ───────────────────────────────────── */}
          {step === 1 && (
            <>
              <StepIcon icon="shirt-outline" />
              <Text style={styles.stepTitle}>What's your style?</Text>
              <Text style={styles.stepSubtitle}>Select all that describe you</Text>
              <View style={styles.chips}>
                {STYLE_CATEGORIES.map((s) => (
                  <PillButton
                    key={s}
                    label={s}
                    selected={selectedStyles.includes(s)}
                    onPress={() =>
                      setSelectedStyles((prev) =>
                        prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
                      )
                    }
                  />
                ))}
              </View>
            </>
          )}

          {/* ── Step 2: Fashion Priorities ─────────────────────────────────── */}
          {step === 2 && (
            <>
              <StepIcon icon="star-outline" />
              <Text style={styles.stepTitle}>What matters most?</Text>
              <Text style={styles.stepSubtitle}>Choose your top priorities (pick 1–3)</Text>
              <View style={styles.optionList}>
                {FASHION_PRIORITIES.map((p) => {
                  const selected = selectedPriorities.includes(p.id);
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.optionCard, selected && styles.optionCardSelected]}
                      onPress={() =>
                        setSelectedPriorities((prev) =>
                          prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id]
                        )
                      }
                      activeOpacity={0.7}
                    >
                      <View style={[styles.optionIcon, selected && styles.optionIconSelected]}>
                        <Ionicons name={p.icon} size={22} color={selected ? Colors.white : Colors.primary} />
                      </View>
                      <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                        {p.label}
                      </Text>
                      {selected && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* ── Step 3: Body Concerns ──────────────────────────────────────── */}
          {step === 3 && (
            <>
              <StepIcon icon="body-outline" />
              <Text style={styles.stepTitle}>Any styling goals?</Text>
              <Text style={styles.stepSubtitle}>Helps us give more tailored feedback</Text>
              <View style={styles.chips}>
                {BODY_CONCERNS.map((c) => (
                  <PillButton
                    key={c}
                    label={c}
                    selected={selectedConcerns.includes(c)}
                    onPress={() =>
                      setSelectedConcerns((prev) =>
                        prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
                      )
                    }
                  />
                ))}
              </View>
            </>
          )}

          {/* ── Step 4: Honesty Level ──────────────────────────────────────── */}
          {step === 4 && (
            <>
              <StepIcon icon="chatbubble-outline" />
              <Text style={styles.stepTitle}>How honest?</Text>
              <Text style={styles.stepSubtitle}>
                How direct should the AI be with its feedback?
              </Text>
              <View style={styles.optionList}>
                {HONESTY_OPTIONS.map((opt) => {
                  const selected = selectedHonesty === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[styles.honestyCard, selected && styles.honestyCardSelected]}
                      onPress={() => setSelectedHonesty(opt.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.honestyCardTop}>
                        <View style={[styles.optionIcon, selected && styles.optionIconSelected]}>
                          <Ionicons name={opt.icon} size={22} color={selected ? Colors.white : Colors.primary} />
                        </View>
                        <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                          {opt.label}
                        </Text>
                        {selected && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
                      </View>
                      <Text style={styles.honestyDesc}>{opt.description}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* ── Step 5: No-go Zones ────────────────────────────────────────── */}
          {step === 5 && (
            <>
              <StepIcon icon="close-circle-outline" />
              <Text style={styles.stepTitle}>Off limits?</Text>
              <Text style={styles.stepSubtitle}>
                Things the AI should never suggest — optional
              </Text>
              <View style={styles.chips}>
                {PRESET_NO_GOS.map((item) => (
                  <PillButton
                    key={item}
                    label={item}
                    selected={selectedNoGos.includes(item)}
                    onPress={() => toggleNoGo(item)}
                  />
                ))}
                {/* Custom entries */}
                {selectedNoGos
                  .filter((n) => !PRESET_NO_GOS.includes(n))
                  .map((custom) => (
                    <PillButton
                      key={custom}
                      label={custom}
                      selected
                      onPress={() => toggleNoGo(custom)}
                    />
                  ))}
              </View>

              {/* Custom input */}
              <View style={styles.customInputRow}>
                <TextInput
                  style={styles.customInput}
                  placeholder="Add your own…"
                  placeholderTextColor={Colors.textMuted}
                  value={customNoGo}
                  onChangeText={setCustomNoGo}
                  onSubmitEditing={addCustomNoGo}
                  returnKeyType="done"
                  maxLength={50}
                />
                <TouchableOpacity
                  style={[styles.addBtn, !customNoGo.trim() && styles.addBtnDisabled]}
                  onPress={addCustomNoGo}
                  disabled={!customNoGo.trim()}
                >
                  <Ionicons name="add" size={20} color={customNoGo.trim() ? Colors.white : Colors.textMuted} />
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ── Step 6: Style Direction ────────────────────────────────────── */}
          {step === 6 && (
            <>
              <StepIcon icon="compass-outline" />
              <Text style={styles.stepTitle}>Where are you headed?</Text>
              <Text style={styles.stepSubtitle}>
                Describe the style you're working toward — optional
              </Text>
              <TextInput
                style={styles.directionInput}
                placeholder={'e.g. "More structured workwear"\n"Less trendy, more timeless"\n"Ready for fashion week"'}
                placeholderTextColor={Colors.textMuted}
                value={styleDirection}
                onChangeText={(t) => setStyleDirection(t.slice(0, 300))}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                returnKeyType="default"
              />
              <Text style={styles.charCount}>{styleDirection.length} / 300</Text>
            </>
          )}

          {/* ── Step 7: Shopping Gender Preference ─────────────────────────── */}
          {step === 7 && (
            <>
              <StepIcon icon="bag-handle-outline" />
              <Text style={styles.stepTitle}>Shopping for?</Text>
              <Text style={styles.stepSubtitle}>
                Sets which products appear in recommendations — optional
              </Text>
              <View style={styles.optionList}>
                {GENDER_OPTIONS.map((opt) => {
                  const selected = selectedGender === opt.id;
                  return (
                    <TouchableOpacity
                      key={String(opt.id)}
                      style={[styles.honestyCard, selected && styles.honestyCardSelected]}
                      onPress={() => setSelectedGender(opt.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.honestyCardTop}>
                        <View style={[styles.optionIcon, selected && styles.optionIconSelected]}>
                          <Ionicons name={opt.icon} size={22} color={selected ? Colors.white : Colors.primary} />
                        </View>
                        <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                          {opt.label}
                        </Text>
                        {selected && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
                      </View>
                      <Text style={styles.honestyDesc}>{opt.description}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer */}
      <View style={styles.footer}>
        {step > 1 && (
          <TouchableOpacity style={styles.backBtn} onPress={() => setStep(step - 1)}>
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            styles.nextButton,
            step === 1 && styles.nextButtonFull,
            (!canProceed() || isSaving) && styles.nextButtonDisabled,
          ]}
          onPress={handleNext}
          disabled={!canProceed() || isSaving}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Text style={styles.nextButtonText}>
              {step === TOTAL_STEPS ? 'Save Profile' : 'Next'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function StepIcon({ icon }: { icon: React.ComponentProps<typeof Ionicons>['name'] }) {
  return (
    <View style={styles.iconWrap}>
      <View style={styles.iconBox}>
        <Ionicons name={icon} size={36} color={Colors.white} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  iconBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { ...Editorial.screenTitle, fontSize: FontSize.lg },
  skipText: { fontFamily: Fonts.sansMedium, fontSize: FontSize.sm, color: Colors.primary },

  // Progress segments
  progressRow: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  progressSegment: {
    flex: 1,
    height: 2,
    backgroundColor: Colors.borderSolid,
  },
  progressSegmentFilled: {
    backgroundColor: Colors.primary,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: Spacing.xxl },

  // Step icon
  iconWrap: { alignItems: 'center', marginBottom: Spacing.lg },
  iconBox: {
    width: 68,
    height: 68,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Step headings
  stepTitle: {
    fontFamily: Fonts.serif,
    fontSize: 28,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  stepSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },

  // Chips grid
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'center',
  },

  // Option cards (priorities, honesty)
  optionList: { gap: Spacing.sm },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  optionCardSelected: {
    backgroundColor: Colors.primaryAlpha10,
    borderColor: Colors.primary,
  },
  optionIcon: {
    width: 44,
    height: 44,
    backgroundColor: Colors.primaryAlpha10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionIconSelected: { backgroundColor: Colors.primary },
  optionLabel: {
    flex: 1,
    fontFamily: Fonts.sansSemiBold,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  optionLabelSelected: { color: Colors.primary },

  // Honesty cards (with description below)
  honestyCard: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  honestyCardSelected: {
    backgroundColor: Colors.primaryAlpha10,
    borderColor: Colors.primary,
  },
  honestyCardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  honestyDesc: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    lineHeight: 19,
    paddingLeft: 44 + Spacing.md, // align with label
  },

  // Custom no-go input
  customInputRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  customInput: {
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: FontSize.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
  },
  addBtn: {
    width: 44,
    height: 44,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtnDisabled: { backgroundColor: Colors.borderSolid },

  // Direction text input
  directionInput: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    minHeight: 140,
    lineHeight: 22,
  },
  charCount: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'right',
    marginTop: Spacing.xs,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  backBtn: {
    width: 52,
    height: 52,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  nextButton: {
    flex: 1,
    height: 52,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButtonFull: { flex: 1 },
  nextButtonDisabled: { opacity: 0.4 },
  nextButtonText: { ...Editorial.buttonLabel },
});
