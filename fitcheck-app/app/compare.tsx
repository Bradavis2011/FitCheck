import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, FontSize, BorderRadius } from '../src/constants/theme';
import PillButton from '../src/components/PillButton';
import { comparisonService } from '../src/services/api.service';
import { imageToBase64 } from '../src/services/image-upload.service';
import { track } from '../src/lib/analytics';

const OCCASIONS = ['Work', 'Casual', 'Date Night', 'Event', 'Interview', 'Party'];

type ScreenState = 'selecting' | 'analyzing' | 'verdict';

interface VerdictResult {
  winner: 'A' | 'B';
  analysisA: string;
  analysisB: string;
  reasoning: string;
}

export default function CompareScreen() {
  useEffect(() => {
    track('feature_used', { feature: 'compare_outfits' });
  }, []);

  const router = useRouter();
  const [imageA, setImageA] = useState<string | null>(null);
  const [imageB, setImageB] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>([]);
  const [screenState, setScreenState] = useState<ScreenState>('selecting');
  const [verdict, setVerdict] = useState<VerdictResult | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  const pickImage = async (slot: 'A' | 'B') => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        if (slot === 'A') setImageA(result.assets[0].uri);
        else setImageB(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const takePhoto = async (slot: 'A' | 'B') => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is needed to take photos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        if (slot === 'A') setImageA(result.assets[0].uri);
        else setImageB(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const showImageOptions = (slot: 'A' | 'B') => {
    Alert.alert('Add Photo', 'Choose an option', [
      { text: 'Take Photo', onPress: () => takePhoto(slot) },
      { text: 'Choose from Library', onPress: () => pickImage(slot) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const toggleOccasion = (occasion: string) => {
    setSelectedOccasions(prev =>
      prev.includes(occasion) ? prev.filter(o => o !== occasion) : [...prev, occasion]
    );
  };

  const handleAnalyze = async () => {
    if (!imageA || !imageB) return;
    setScreenState('analyzing');
    try {
      const [imageAData, imageBData] = await Promise.all([
        imageToBase64(imageA),
        imageToBase64(imageB),
      ]);
      const result = await comparisonService.analyze({
        imageAData,
        imageBData,
        question: question.trim() || undefined,
        occasions: selectedOccasions.length > 0 ? selectedOccasions : undefined,
      });
      setVerdict(result);
      setScreenState('verdict');
      track('ai_comparison_complete', { winner: result.winner });
    } catch {
      setScreenState('selecting');
      Alert.alert('Analysis Failed', 'Could not analyze your outfits. Please check your connection and try again.');
    }
  };

  const handleShareWithCommunity = async () => {
    if (!imageA || !imageB) return;
    if (selectedOccasions.length === 0) {
      Alert.alert('Select Occasion', 'Please select at least one occasion before sharing with the community.');
      return;
    }
    setIsSharing(true);
    try {
      const [imageAData, imageBData] = await Promise.all([
        imageToBase64(imageA),
        imageToBase64(imageB),
      ]);
      await comparisonService.createPost({
        imageAData,
        imageBData,
        question: question.trim() || undefined,
        occasions: selectedOccasions,
      });
      Alert.alert('Posted!', 'Your comparison has been shared with the community.', [
        { text: 'OK', onPress: () => router.push('/(tabs)/community') },
      ]);
    } catch (error: any) {
      const msg =
        error?.response?.data?.error ||
        'A Plus or Pro subscription is required to share comparisons.';
      Alert.alert('Could Not Share', msg);
    } finally {
      setIsSharing(false);
    }
  };

  const canAnalyze = imageA !== null && imageB !== null;

  // ── VERDICT SCREEN ────────────────────────────────────────────────────────
  if (screenState === 'verdict' && verdict) {
    const winnerImage = verdict.winner === 'A' ? imageA : imageB;
    const loserImage = verdict.winner === 'A' ? imageB : imageA;
    const winnerLabel = verdict.winner === 'A' ? 'Option A' : 'Option B';
    const loserLabel = verdict.winner === 'A' ? 'Option B' : 'Option A';
    const winnerAnalysis = verdict.winner === 'A' ? verdict.analysisA : verdict.analysisB;
    const loserAnalysis = verdict.winner === 'A' ? verdict.analysisB : verdict.analysisA;

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
            <Ionicons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>AI Verdict</Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Winner banner */}
          <LinearGradient
            colors={[Colors.primary, Colors.primaryLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.winnerBanner}
          >
            <Ionicons name="star" size={18} color={Colors.white} />
            <Text style={styles.winnerBannerText}>The AI has spoken</Text>
          </LinearGradient>

          {/* Side-by-side with winner highlighted */}
          <View style={styles.verdictImages}>
            <View style={styles.verdictSlotWinner}>
              <View style={styles.winnerBadge}>
                <Ionicons name="checkmark-circle" size={14} color={Colors.white} />
                <Text style={styles.winnerBadgeText}>Wear this</Text>
              </View>
              <View style={styles.verdictImageWrap}>
                <Image source={{ uri: winnerImage! }} style={styles.verdictImage} />
              </View>
              <Text style={styles.verdictSlotLabel}>{winnerLabel}</Text>
            </View>

            <View style={styles.verdictSlotLoser}>
              <View style={[styles.verdictImageWrap, styles.verdictImageWrapDimmed]}>
                <Image source={{ uri: loserImage! }} style={[styles.verdictImage, styles.verdictImageDimmed]} />
              </View>
              <Text style={[styles.verdictSlotLabel, styles.verdictSlotLabelMuted]}>{loserLabel}</Text>
            </View>
          </View>

          {/* Reasoning */}
          <View style={styles.verdictCard}>
            <Text style={styles.verdictCardTitle}>Why {winnerLabel} wins</Text>
            <Text style={styles.verdictCardText}>{verdict.reasoning}</Text>
          </View>

          <View style={styles.verdictCard}>
            <Text style={styles.verdictCardTitle}>{winnerLabel} — stylist notes</Text>
            <Text style={styles.verdictCardText}>{winnerAnalysis}</Text>
          </View>

          <View style={styles.verdictCard}>
            <Text style={styles.verdictCardTitle}>{loserLabel} — stylist notes</Text>
            <Text style={styles.verdictCardText}>{loserAnalysis}</Text>
          </View>

          {/* Actions */}
          <View style={styles.verdictActions}>
            <TouchableOpacity
              style={styles.shareButton}
              onPress={handleShareWithCommunity}
              disabled={isSharing}
              activeOpacity={0.8}
            >
              {isSharing ? (
                <ActivityIndicator size="small" color={Colors.text} />
              ) : (
                <>
                  <Ionicons name="people-outline" size={18} color={Colors.text} />
                  <Text style={styles.shareButtonText}>Share with Community</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => router.back()}
              activeOpacity={0.8}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── SELECTION SCREEN ──────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Can't decide?</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroSubtitle}>
            Add two outfits. AI picks a winner. Optionally share with the community.
          </Text>
        </View>

        {/* Image slots */}
        <View style={styles.imagesContainer}>
          {(['A', 'B'] as const).map(slot => {
            const image = slot === 'A' ? imageA : imageB;
            const setImage = slot === 'A' ? setImageA : setImageB;
            const gradientColors: [string, string] =
              slot === 'A'
                ? [Colors.primary, Colors.primaryLight]
                : [Colors.primaryLight, Colors.primary];

            return (
              <View key={slot} style={styles.imageSlot}>
                <Text style={styles.imageLabel}>Option {slot}</Text>
                {image ? (
                  <TouchableOpacity
                    style={styles.imagePreview}
                    onPress={() => showImageOptions(slot)}
                    activeOpacity={0.8}
                  >
                    <Image source={{ uri: image }} style={styles.image} />
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => setImage(null)}
                      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                    >
                      <Ionicons name="close-circle" size={24} color={Colors.white} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.imagePlaceholder}
                    onPress={() => showImageOptions(slot)}
                    activeOpacity={0.7}
                  >
                    <LinearGradient
                      colors={gradientColors}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.placeholderGradient}
                    >
                      <Ionicons name="camera" size={32} color={Colors.white} />
                      <Text style={styles.placeholderText}>Add Photo</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}

          {/* "or" badge between slots */}
          <View style={styles.orBadge}>
            <Text style={styles.orText}>or</Text>
          </View>
        </View>

        {/* Question */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your question (optional)</Text>
          <TextInput
            style={styles.questionInput}
            placeholder="e.g., Which is better for a first date?"
            placeholderTextColor={Colors.textMuted}
            value={question}
            onChangeText={setQuestion}
            multiline
            maxLength={150}
          />
          <Text style={styles.characterCount}>{question.length}/150</Text>
        </View>

        {/* Occasion */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Occasion (optional)</Text>
          <View style={styles.pillsContainer}>
            {OCCASIONS.map(occasion => (
              <PillButton
                key={occasion}
                label={occasion}
                selected={selectedOccasions.includes(occasion)}
                onPress={() => toggleOccasion(occasion)}
              />
            ))}
          </View>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Analyze button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.analyzeButton, (!canAnalyze || screenState === 'analyzing') && styles.analyzeButtonDisabled]}
          onPress={handleAnalyze}
          disabled={!canAnalyze || screenState === 'analyzing'}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={canAnalyze ? [Colors.primary, Colors.primaryLight] : [Colors.surface, Colors.surface]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.analyzeButtonGradient}
          >
            {screenState === 'analyzing' ? (
              <>
                <ActivityIndicator size="small" color={Colors.white} />
                <Text style={styles.analyzeButtonText}>Analyzing…</Text>
              </>
            ) : (
              <>
                <Ionicons
                  name="sparkles"
                  size={20}
                  color={canAnalyze ? Colors.white : Colors.textMuted}
                />
                <Text
                  style={[
                    styles.analyzeButtonText,
                    !canAnalyze && styles.analyzeButtonTextDisabled,
                  ]}
                >
                  Get AI Verdict
                </Text>
              </>
            )}
          </LinearGradient>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  scrollView: {
    flex: 1,
  },
  hero: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    alignItems: 'center',
  },
  heroSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  imagesContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    marginTop: Spacing.md,
  },
  imageSlot: {
    flex: 1,
  },
  imageLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  imagePlaceholder: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  placeholderGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  placeholderText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.white,
  },
  imagePreview: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removeButton: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: BorderRadius.full,
  },
  orBadge: {
    position: 'absolute',
    left: '50%',
    top: '55%',
    marginLeft: -18,
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  orText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.white,
    fontStyle: 'italic',
  },
  section: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  questionInput: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'right',
    marginTop: Spacing.xs,
  },
  pillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  analyzeButton: {
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  analyzeButtonDisabled: {
    opacity: 0.5,
  },
  analyzeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  analyzeButtonText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.white,
  },
  analyzeButtonTextDisabled: {
    color: Colors.textMuted,
  },

  // ── Verdict styles ────────────────────────────────────────────────────────
  winnerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.lg,
  },
  winnerBannerText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: 0.5,
  },
  verdictImages: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
    marginBottom: Spacing.lg,
    alignItems: 'flex-start',
  },
  verdictSlotWinner: {
    flex: 1,
    alignItems: 'center',
  },
  verdictSlotLoser: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 28, // offset for the winner badge height
  },
  winnerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    marginBottom: Spacing.xs,
  },
  winnerBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.white,
  },
  verdictImageWrap: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  verdictImageWrapDimmed: {
    borderColor: Colors.border,
  },
  verdictImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  verdictImageDimmed: {
    opacity: 0.55,
  },
  verdictSlotLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  verdictSlotLabelMuted: {
    color: Colors.textMuted,
  },
  verdictCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  verdictCardTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  verdictCardText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  verdictActions: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
  },
  shareButtonText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  doneButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
  },
  doneButtonText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.white,
  },
});
