import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../src/stores/auth';
import { occasions, settings, weather, vibes, loadingMessages } from '../src/lib/mockData';
import { Colors, Spacing, FontSize, BorderRadius, Fonts } from '../src/constants/theme';
import LoadingOverlay from '../src/components/LoadingOverlay';
import PillButton from '../src/components/PillButton';
import { uploadImage } from '../src/services/image-upload.service';
import { outfitService, ShareWith } from '../src/services/api.service';
import { useUserStats, useOutfitMemory, useContextPreferences } from '../src/hooks/useApi';

// Occasions that get a follow-up the next morning
const EVENT_OCCASIONS = ['Date Night', 'Interview', 'Event'];

const SHARE_OPTIONS: { value: ShareWith; label: string; icon: string; description: string }[] = [
  { value: 'private', label: 'Just Me', icon: 'lock-closed-outline', description: 'Only you can see this' },
  { value: 'inner_circle', label: 'Inner Circle', icon: 'people-outline', description: 'Only your trusted circle' },
  { value: 'public', label: 'Community', icon: 'globe-outline', description: 'Everyone can see & feedback' },
];

export default function ContextScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    capturedImage,
    selectedOccasions,
    selectedSetting,
    selectedWeather,
    selectedVibes,
    concerns,
    eventDate,
    toggleOccasion,
    setSelectedSetting,
    setSelectedWeather,
    toggleVibe,
    setConcerns,
    setEventDate,
    isAnalyzing,
  } = useAppStore();

  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [shareWith, setShareWith] = useState<ShareWith>('private');
  const [showDateModal, setShowDateModal] = useState(false);
  const [customDateText, setCustomDateText] = useState('');

  const hasEventOccasion = selectedOccasions.some((o) => EVENT_OCCASIONS.includes(o));

  // A6: Load user's most common occasions + vibes and pre-select on first render
  const { data: contextPrefs } = useContextPreferences();
  const [prefsApplied, setPrefsApplied] = useState(false);
  useEffect(() => {
    if (prefsApplied || !contextPrefs || selectedOccasions.length > 0) return;
    // Batch-set all occasions and vibes in a single store update to avoid a
    // re-render loop where each toggleOccasion call causes selectedOccasions.length
    // to change, re-triggering this effect and exiting early on guard check.
    useAppStore.setState({
      selectedOccasions: [...contextPrefs.topOccasions],
      selectedVibes: [...contextPrefs.topVibes],
    });
    setPrefsApplied(true);
  }, [contextPrefs, prefsApplied, selectedOccasions.length]);

  // Outfit memory — fetch best past outfit for selected occasions
  const { data: memoryData } = useOutfitMemory(selectedOccasions);
  const outfitMemory = memoryData?.memory;

  // Quick date helpers
  const getDateLabel = (d: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(d);
    target.setHours(0, 0, 0, 0);
    const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const setQuickDate = (daysFromNow: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    setEventDate(d);
  };

  const handleCustomDate = () => {
    setShowDateModal(true);
  };

  const confirmCustomDate = () => {
    const parsed = new Date(customDateText);
    if (isNaN(parsed.getTime())) {
      Alert.alert('Invalid date', 'Please enter a date like "2026-03-15"');
      return;
    }
    setEventDate(parsed);
    setShowDateModal(false);
    setCustomDateText('');
  };

  // Fetch user stats to check daily limit
  const { data: stats } = useUserStats();
  const dailyChecksRemaining = stats?.dailyChecksRemaining ?? null;
  const isAtLimit = dailyChecksRemaining !== null && dailyChecksRemaining <= 0;

  // If no image, go back to camera
  useEffect(() => {
    console.log('[Context] Captured image URI:', capturedImage);
    if (!capturedImage) {
      console.log('[Context] No image, going back to camera');
      router.back();
    }
  }, [capturedImage]);

  const handleSubmit = async () => {
    if (selectedOccasions.length === 0 || !capturedImage) return;

    // Guard against daily limit
    if (isAtLimit) {
      Alert.alert(
        'Daily Limit Reached',
        'Free accounts get 3 outfit checks per day. Upgrade to Plus for unlimited checks!',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      // Start analysis
      useAppStore.getState().startAnalysis();

      console.log('[Context] Starting image upload...');
      // Upload image and get base64
      const imageResult = await uploadImage(capturedImage);
      console.log('[Context] Image uploaded successfully, size:', imageResult.base64.length);

      console.log('[Context] Submitting to API...');
      // Submit to API
      const response = await outfitService.submitCheck({
        imageBase64: imageResult.base64,
        occasions: selectedOccasions,
        setting: selectedSetting || undefined,
        weather: selectedWeather || undefined,
        vibe: selectedVibes.join(', ') || undefined,
        specificConcerns: concerns || undefined,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        eventDate: eventDate ? eventDate.toISOString() : undefined,
        shareWith,
      });
      console.log('[Context] API response received:', response.id);

      // Clear isAnalyzing before navigating so the loading overlay doesn't
      // persist if the user presses back from the feedback screen.
      useAppStore.setState({ isAnalyzing: false });
      router.push(`/feedback?outfitId=${response.id}`);
    } catch (error: any) {
      console.error('[Context] Failed to submit outfit check:', error);
      console.error('[Context] Error name:', error.name);
      console.error('[Context] Error message:', error.message);
      console.error('[Context] Full error:', JSON.stringify(error, null, 2));

      useAppStore.getState().setFeedback(null as any);

      // Provide helpful error message
      let errorMessage = 'Failed to submit outfit check. Please try again.';

      if (error.message?.includes('upload')) {
        errorMessage = 'Failed to process image. Please try taking another photo.';
      } else if (error.message?.includes('Network') || error.name === 'AbortError') {
        errorMessage = 'Cannot connect to server. Make sure the backend is running and try again.';
      } else if (error.userMessage) {
        errorMessage = error.userMessage;
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert('Upload Failed', errorMessage, [{ text: 'OK' }]);
    }
  };

  const canSubmit = selectedOccasions.length > 0 && !isAtLimit;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Almost there!</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Daily limit banner */}
          {isAtLimit && (
            <View style={styles.limitBanner}>
              <Ionicons name="lock-closed" size={20} color={Colors.warning} />
              <Text style={styles.limitBannerText}>
                Daily limit reached. Free accounts get 3 outfit checks per day. Upgrade to Plus for unlimited!
              </Text>
            </View>
          )}

          {/* Image preview — contain so the full outfit is always visible */}
          {capturedImage && (
            <View style={styles.imagePreviewContainer}>
              <View style={styles.imagePreview}>
                <Image
                  source={{ uri: capturedImage }}
                  style={styles.image}
                  resizeMode="contain"
                  onError={(error) => {
                    console.error('[Context] Image load error:', error.nativeEvent.error);
                    console.error('[Context] Image URI:', capturedImage);
                  }}
                  onLoad={() => console.log('[Context] Image loaded successfully')}
                />
              </View>
            </View>
          )}

          {/* Occasion selector */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              What's the occasion? <Text style={styles.required}>*</Text>
            </Text>
            <Text style={styles.sectionHint}>Select one or more</Text>
            <View style={styles.pillsContainer}>
              {occasions.map((occasion) => (
                <PillButton
                  key={occasion}
                  label={occasion}
                  selected={selectedOccasions.includes(occasion)}
                  onPress={() => toggleOccasion(occasion)}
                />
              ))}
            </View>
          </View>

          {/* Outfit memory callback — show best past outfit for this occasion */}
          {outfitMemory && (
            <TouchableOpacity
              style={styles.memoryCard}
              onPress={() => router.push(`/outfit/${outfitMemory.id}` as any)}
              activeOpacity={0.8}
            >
              <View style={styles.memoryRow}>
                {(outfitMemory.thumbnailUrl || outfitMemory.thumbnailData) && (
                  <Image
                    source={{
                      uri: outfitMemory.thumbnailUrl ||
                        `data:image/jpeg;base64,${outfitMemory.thumbnailData}`,
                    }}
                    style={styles.memoryThumb}
                  />
                )}
                <View style={styles.memoryContent}>
                  <Text style={styles.memoryLabel}>Last time you dressed for {outfitMemory.occasion}</Text>
                  <Text style={styles.memoryScore}>
                    {outfitMemory.aiScore.toFixed(1)}/10
                  </Text>
                  {outfitMemory.summary && (
                    <Text style={styles.memorySummary} numberOfLines={2}>
                      {outfitMemory.summary}
                    </Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </View>
            </TouchableOpacity>
          )}

          {/* Event date picker — only shown when an event occasion is selected */}
          {hasEventOccasion && (
            <View style={styles.datePicker}>
              <Text style={styles.datePickerTitle}>When is the event?</Text>
              <Text style={styles.datePickerHint}>Optional — we'll follow up to see how it went</Text>
              <View style={styles.dateOptions}>
                {[0, 1, 2].map((daysFromNow) => {
                  const d = new Date();
                  d.setDate(d.getDate() + daysFromNow);
                  const isSelected =
                    eventDate &&
                    new Date(eventDate).toDateString() === d.toDateString();
                  return (
                    <TouchableOpacity
                      key={daysFromNow}
                      style={[styles.dateChip, isSelected && styles.dateChipActive]}
                      onPress={() => setQuickDate(daysFromNow)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.dateChipText, isSelected && styles.dateChipTextActive]}>
                        {getDateLabel(d)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={[
                    styles.dateChip,
                    eventDate &&
                      ![0, 1, 2].some(() => {
                        const d = new Date();
                        return [0, 1, 2].some((n) => {
                          const nd = new Date();
                          nd.setDate(nd.getDate() + n);
                          return eventDate && new Date(eventDate).toDateString() === nd.toDateString();
                        });
                      }) && styles.dateChipActive,
                  ]}
                  onPress={handleCustomDate}
                  activeOpacity={0.7}
                >
                  <Text style={styles.dateChipText}>Other date</Text>
                </TouchableOpacity>
                {eventDate && (
                  <TouchableOpacity
                    style={styles.dateClear}
                    onPress={() => setEventDate(null)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
              {eventDate && (
                <Text style={styles.dateSelected}>
                  {new Date(eventDate).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Text>
              )}
            </View>
          )}

          {/* Details accordion */}
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => setDetailsExpanded(!detailsExpanded)}
            activeOpacity={0.7}
          >
            <Text style={styles.accordionTitle}>Add more details (optional)</Text>
            <Ionicons
              name={detailsExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={Colors.textMuted}
            />
          </TouchableOpacity>

          {detailsExpanded && (
            <View style={styles.detailsContainer}>
              {/* Setting */}
              <View style={styles.subsection}>
                <Text style={styles.subsectionTitle}>Setting</Text>
                <View style={styles.toggleButtonGroup}>
                  {settings.map((setting) => (
                    <TouchableOpacity
                      key={setting}
                      style={[
                        styles.toggleButton,
                        selectedSetting === setting && styles.toggleButtonActive,
                      ]}
                      onPress={() => setSelectedSetting(setting)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.toggleButtonText,
                          selectedSetting === setting && styles.toggleButtonTextActive,
                        ]}
                      >
                        {setting}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Weather */}
              <View style={styles.subsection}>
                <Text style={styles.subsectionTitle}>Weather</Text>
                <View style={styles.toggleButtonGroup}>
                  {weather.map((w) => (
                    <TouchableOpacity
                      key={w}
                      style={[
                        styles.toggleButton,
                        selectedWeather === w && styles.toggleButtonActive,
                      ]}
                      onPress={() => setSelectedWeather(w)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.toggleButtonText,
                          selectedWeather === w && styles.toggleButtonTextActive,
                        ]}
                      >
                        {w}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Vibe */}
              <View style={styles.subsection}>
                <Text style={styles.subsectionTitle}>Vibe you're going for</Text>
                <View style={styles.pillsContainer}>
                  {vibes.map((vibe) => (
                    <PillButton
                      key={vibe}
                      label={vibe}
                      selected={selectedVibes.includes(vibe)}
                      onPress={() => toggleVibe(vibe)}
                      small
                    />
                  ))}
                </View>
              </View>

              {/* Concerns */}
              <View style={styles.subsection}>
                <Text style={styles.subsectionTitle}>Any specific concerns?</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g., Is this too formal? Does the color work?"
                  placeholderTextColor={Colors.textMuted}
                  value={concerns}
                  onChangeText={setConcerns}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            </View>
          )}

          {/* Who sees this? */}
          <View style={styles.shareSection}>
            <Text style={styles.sectionTitle}>Who sees this?</Text>
            <View style={styles.shareOptions}>
              {SHARE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.shareOption, shareWith === opt.value && styles.shareOptionActive]}
                  onPress={() => setShareWith(opt.value)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={opt.icon as any}
                    size={22}
                    color={shareWith === opt.value ? Colors.primary : Colors.textMuted}
                  />
                  <Text style={[styles.shareOptionLabel, shareWith === opt.value && styles.shareOptionLabelActive]}>
                    {opt.label}
                  </Text>
                  <Text style={styles.shareOptionDesc}>{opt.description}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Submit button */}
        <View style={[styles.footer, { paddingBottom: Spacing.lg + Math.round(insets.bottom * 0.75) }]}>
          {!isAtLimit && dailyChecksRemaining !== null && dailyChecksRemaining > 0 && (
            <Text style={styles.remainingText}>
              {dailyChecksRemaining} check{dailyChecksRemaining !== 1 ? 's' : ''} remaining today
            </Text>
          )}
          <TouchableOpacity
            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            activeOpacity={0.8}
          >
            <Text style={styles.submitButtonText}>Get My Feedback</Text>
            <Ionicons name="sparkles" size={20} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Custom date picker modal */}
      <Modal visible={showDateModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enter event date</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="YYYY-MM-DD (e.g. 2026-03-15)"
              placeholderTextColor={Colors.textMuted}
              value={customDateText}
              onChangeText={setCustomDateText}
              keyboardType="numbers-and-punctuation"
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => { setShowDateModal(false); setCustomDateText(''); }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={confirmCustomDate}>
                <Text style={styles.modalConfirmText}>Set Date</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Loading overlay */}
      {isAnalyzing && <LoadingOverlay messages={loadingMessages} />}
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
    fontFamily: Fonts.sansBold,
    fontSize: FontSize.lg,
    color: Colors.text,
  },
  scrollView: {
    flex: 1,
  },
  limitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    margin: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  limitBannerText: {
    flex: 1,
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.sm,
    color: Colors.warning,
    lineHeight: 18,
  },
  imagePreviewContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  imagePreview: {
    width: '100%',
    height: 260,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  section: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  sectionTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: FontSize.lg,
    color: Colors.text,
  },
  sectionHint: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: -Spacing.sm,
  },
  required: {
    color: Colors.primary,
  },
  pillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  accordionTitle: {
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  detailsContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.lg,
  },
  subsection: {
    gap: Spacing.sm,
  },
  subsectionTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  toggleButtonGroup: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 0,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleButtonActive: {
    backgroundColor: Colors.primary,
  },
  toggleButtonText: {
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  toggleButtonTextActive: {
    color: Colors.white,
  },
  textInput: {
    fontFamily: Fonts.sans,
    backgroundColor: Colors.surface,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
    minHeight: 80,
  },
  shareSection: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  shareOptions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  shareOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: 0,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: 4,
  },
  shareOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: '#FDF0EE',
  },
  shareOptionLabel: {
    fontFamily: Fonts.sansBold,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  shareOptionLabelActive: {
    color: Colors.primary,
  },
  shareOptionDesc: {
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 13,
  },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
    gap: Spacing.sm,
  },
  remainingText: {
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    borderRadius: 0,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.65,
    color: Colors.white,
  },
  // Outfit memory card
  memoryCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  memoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  memoryThumb: {
    width: 48,
    height: 64,
    borderRadius: 8,
    backgroundColor: Colors.backgroundSecondary,
  },
  memoryContent: {
    flex: 1,
    gap: 2,
  },
  memoryLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  memoryScore: {
    fontFamily: Fonts.sansBold,
    fontSize: FontSize.lg,
    color: Colors.primary,
  },
  memorySummary: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  // Event date picker
  datePicker: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  datePickerTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  datePickerHint: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  dateOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
    alignItems: 'center',
  },
  dateChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 0,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dateChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dateChipText: {
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  dateChipTextActive: {
    color: Colors.white,
  },
  dateClear: {
    padding: 4,
  },
  dateSelected: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: FontSize.sm,
    color: Colors.primary,
    marginTop: 4,
  },
  // Custom date modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    width: '100%',
    gap: Spacing.md,
  },
  modalTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: FontSize.lg,
    color: Colors.text,
    textAlign: 'center',
  },
  modalInput: {
    fontFamily: Fonts.sans,
    backgroundColor: Colors.surface,
    borderRadius: 0,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 0,
  },
  modalCancelText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: FontSize.md,
    color: Colors.textMuted,
  },
  modalConfirm: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 0,
  },
  modalConfirmText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: FontSize.md,
    color: Colors.white,
  },
});
