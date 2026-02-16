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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../src/stores/auth';
import { occasions, settings, weather, vibes, loadingMessages } from '../src/lib/mockData';
import { Colors, Spacing, FontSize, BorderRadius } from '../src/constants/theme';
import LoadingOverlay from '../src/components/LoadingOverlay';
import PillButton from '../src/components/PillButton';
import { uploadImage } from '../src/services/image-upload.service';
import { outfitService } from '../src/services/api.service';
import { useUserStats } from '../src/hooks/useApi';

export default function ContextScreen() {
  const router = useRouter();
  const {
    capturedImage,
    selectedOccasions,
    selectedSetting,
    selectedWeather,
    selectedVibes,
    concerns,
    toggleOccasion,
    setSelectedSetting,
    setSelectedWeather,
    toggleVibe,
    setConcerns,
    isAnalyzing,
  } = useAppStore();

  const [detailsExpanded, setDetailsExpanded] = useState(false);

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
      });
      console.log('[Context] API response received:', response.id);

      // Navigate to feedback with outfit ID
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

          {/* Image preview */}
          {capturedImage && (
            <View style={styles.imagePreviewContainer}>
              <View style={styles.imagePreview}>
                <Image
                  source={{ uri: capturedImage }}
                  style={styles.image}
                  resizeMode="cover"
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

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Submit button */}
        <View style={styles.footer}>
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
    fontSize: FontSize.sm,
    color: Colors.warning,
    fontWeight: '500',
    lineHeight: 18,
  },
  imagePreviewContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  imagePreview: {
    width: 128,
    height: 176,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
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
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  sectionHint: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: -Spacing.sm,
  },
  required: {
    color: Colors.secondary,
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
    fontSize: FontSize.sm,
    fontWeight: '500',
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
    fontSize: FontSize.sm,
    fontWeight: '600',
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
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleButtonActive: {
    backgroundColor: Colors.primary,
  },
  toggleButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    color: Colors.textMuted,
  },
  toggleButtonTextActive: {
    color: Colors.white,
  },
  textInput: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
    minHeight: 80,
  },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
    gap: Spacing.sm,
  },
  remainingText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    fontWeight: '500',
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonText: {
    color: Colors.white,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
});
