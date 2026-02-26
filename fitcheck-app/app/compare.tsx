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
import { Colors, Spacing, FontSize, BorderRadius, Fonts } from '../src/constants/theme';
import * as FileSystem from 'expo-file-system/legacy';
import { comparisonService } from '../src/services/api.service';
import { track } from '../src/lib/analytics';
import ImageCropPreview from '../src/components/ImageCropPreview';

const toBase64 = async (uri: string): Promise<string> => {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return `data:image/jpeg;base64,${base64}`;
};

const OCCASIONS = ['Work', 'Casual', 'Date Night', 'Event', 'Interview', 'Party'];

type ScreenState = 'selecting' | 'analyzing' | 'verdict';

interface VerdictResult {
  winner: 'A' | 'B';
  analysisA: string;
  analysisB: string;
  reasoning: string;
}

interface CropState {
  uri: string;
  slot: 'A' | 'B';
}

function ImageSlot({
  image,
  label,
  onAdd,
  onRemove,
}: {
  image: string | null;
  label: string;
  onAdd: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={slotStyles.container}>
      <Text style={slotStyles.label}>{label}</Text>
      <View style={slotStyles.box}>
        {image ? (
          <>
            <Image
              source={{ uri: image }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />
            <TouchableOpacity
              style={slotStyles.removeBtn}
              onPress={onRemove}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Ionicons name="close-circle" size={26} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={slotStyles.editBtn}
              onPress={onAdd}
              activeOpacity={0.8}
            >
              <Ionicons name="pencil" size={14} color="#fff" />
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={slotStyles.emptyTap}
            onPress={onAdd}
            activeOpacity={0.7}
          >
            <Ionicons name="camera-outline" size={28} color={Colors.primary} />
            <Text style={slotStyles.addText}>Add Photo</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const slotStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  label: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 2.2,
    color: Colors.textMuted,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  box: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: BorderRadius.sharp,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyTap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  addText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: Colors.primary,
  },
  removeBtn: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 0,
  },
  editBtn: {
    position: 'absolute',
    bottom: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 0,
    padding: 6,
  },
});

export default function CompareScreen() {
  useEffect(() => {
    track('feature_used', { feature: 'compare_outfits' });
  }, []);

  const router = useRouter();
  const [imageA, setImageA] = useState<string | null>(null);
  const [imageB, setImageB] = useState<string | null>(null);
  const [cropState, setCropState] = useState<CropState | null>(null);
  const [question, setQuestion] = useState('');
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>([]);
  const [screenState, setScreenState] = useState<ScreenState>('selecting');
  const [verdict, setVerdict] = useState<VerdictResult | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  const pickImage = async (slot: 'A' | 'B') => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setCropState({ uri: result.assets[0].uri, slot });
      }
    } catch {
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const takePhoto = async (slot: 'A' | 'B') => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera access is needed to take photos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setCropState({ uri: result.assets[0].uri, slot });
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

  const handleCropAccept = (croppedUri: string) => {
    if (!cropState) return;
    if (cropState.slot === 'A') setImageA(croppedUri);
    else setImageB(croppedUri);
    setCropState(null);
  };

  const handleCropRetake = () => {
    setCropState(null);
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
        toBase64(imageA),
        toBase64(imageB),
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
    } catch (error: any) {
      setScreenState('selecting');
      console.error('[Compare] Analysis error:', {
        status: error?.response?.status,
        data: error?.response?.data,
        message: error?.message,
      });
      const msg =
        error?.response?.data?.error ||
        error?.message ||
        'Could not analyze your outfits. Please check your connection and try again.';
      Alert.alert('Analysis Failed', msg);
    }
  };

  const handleShareWithCommunity = async () => {
    if (!imageA || !imageB) return;
    if (selectedOccasions.length === 0) {
      Alert.alert('Select Occasion', 'Please select at least one occasion before sharing.');
      return;
    }
    setIsSharing(true);
    try {
      const [imageAData, imageBData] = await Promise.all([
        toBase64(imageA),
        toBase64(imageB),
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

  // ── Crop screen (full-screen overlay) ─────────────────────────────────────
  if (cropState) {
    return (
      <ImageCropPreview
        uri={cropState.uri}
        onAccept={handleCropAccept}
        onRetake={handleCropRetake}
      />
    );
  }

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
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
            <Ionicons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>The Verdict</Text>
          <View style={styles.headerBtn} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Editorial winner banner */}
          <View style={styles.verdictBanner}>
            <Text style={styles.verdictBannerLabel}>AI Verdict</Text>
            <View style={styles.verdictBannerRule} />
            <Text style={styles.verdictBannerWinner}>{winnerLabel} wins</Text>
          </View>

          {/* Verdict image pair */}
          <View style={styles.verdictRow}>
            {/* Winner */}
            <View style={styles.verdictSlot}>
              <View style={styles.winnerBadge}>
                <Text style={styles.winnerBadgeText}>Wear this</Text>
              </View>
              <View style={[styles.verdictBox, styles.verdictBoxWinner]}>
                <Image
                  source={{ uri: winnerImage! }}
                  style={StyleSheet.absoluteFillObject}
                  resizeMode="cover"
                />
              </View>
              <Text style={styles.verdictSlotLabel}>{winnerLabel}</Text>
            </View>

            {/* Loser */}
            <View style={[styles.verdictSlot, { marginTop: 32 }]}>
              <View style={styles.verdictBox}>
                <Image
                  source={{ uri: loserImage! }}
                  style={[StyleSheet.absoluteFillObject, { opacity: 0.45 }]}
                  resizeMode="cover"
                />
              </View>
              <Text style={[styles.verdictSlotLabel, { color: Colors.textMuted }]}>{loserLabel}</Text>
            </View>
          </View>

          {/* Verdict text blocks */}
          <View style={styles.verdictCard}>
            <Text style={styles.verdictCardLabel}>Why {winnerLabel} wins</Text>
            <View style={styles.verdictCardRule} />
            <Text style={styles.verdictCardText}>{verdict.reasoning}</Text>
          </View>

          <View style={styles.verdictCard}>
            <Text style={styles.verdictCardLabel}>{winnerLabel} — stylist notes</Text>
            <View style={styles.verdictCardRule} />
            <Text style={styles.verdictCardText}>{winnerAnalysis}</Text>
          </View>

          <View style={styles.verdictCard}>
            <Text style={styles.verdictCardLabel}>{loserLabel} — stylist notes</Text>
            <View style={styles.verdictCardRule} />
            <Text style={styles.verdictCardText}>{loserAnalysis}</Text>
          </View>

          <View style={styles.verdictActions}>
            <TouchableOpacity
              style={styles.shareBtn}
              onPress={handleShareWithCommunity}
              disabled={isSharing}
              activeOpacity={0.8}
            >
              {isSharing ? (
                <ActivityIndicator size="small" color={Colors.text} />
              ) : (
                <Text style={styles.shareBtnText}>Share with Community</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => router.back()}
              activeOpacity={0.8}
            >
              <Text style={styles.doneBtnText}>Done</Text>
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
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Can't decide?</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>
          Add two outfits. AI picks a winner.
        </Text>

        {/* Image slots */}
        <View style={styles.slotsRow}>
          <ImageSlot
            image={imageA}
            label="Option A"
            onAdd={() => showImageOptions('A')}
            onRemove={() => setImageA(null)}
          />

          <View style={styles.orDivider}>
            <View style={styles.orRule} />
            <Text style={styles.orText}>or</Text>
            <View style={styles.orRule} />
          </View>

          <ImageSlot
            image={imageB}
            label="Option B"
            onAdd={() => showImageOptions('B')}
            onRemove={() => setImageB(null)}
          />
        </View>

        {/* Question */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Your question</Text>
          <TextInput
            style={styles.questionInput}
            placeholder="e.g. Which works better for a first date?"
            placeholderTextColor={Colors.textMuted}
            value={question}
            onChangeText={setQuestion}
            multiline
            maxLength={150}
            fontFamily={Fonts.sans}
          />
          <Text style={styles.charCount}>{question.length}/150</Text>
        </View>

        {/* Occasion */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Occasion</Text>
          <View style={styles.occasionRow}>
            {OCCASIONS.map(occasion => {
              const selected = selectedOccasions.includes(occasion);
              return (
                <TouchableOpacity
                  key={occasion}
                  style={[styles.occasionChip, selected && styles.occasionChipSelected]}
                  onPress={() => toggleOccasion(occasion)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.occasionChipText, selected && styles.occasionChipTextSelected]}>
                    {occasion}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Analyze button */}
      <View style={styles.footer}>
        {screenState === 'analyzing' ? (
          <View style={styles.analyzingState}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.analyzingText}>Analyzing your outfits…</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.analyzeBtn, !canAnalyze && styles.analyzeBtnDisabled]}
            onPress={handleAnalyze}
            disabled={!canAnalyze}
            activeOpacity={0.85}
          >
            <Ionicons
              name="sparkles"
              size={16}
              color={canAnalyze ? Colors.white : Colors.textMuted}
            />
            <Text style={[styles.analyzeBtnText, !canAnalyze && styles.analyzeBtnTextDisabled]}>
              Get AI Verdict
            </Text>
          </TouchableOpacity>
        )}
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
  headerBtn: {
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
  subtitle: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    lineHeight: 20,
  },
  slotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    marginVertical: Spacing.md,
  },
  orDivider: {
    alignItems: 'center',
    gap: Spacing.xs,
    flexShrink: 0,
    width: 24,
  },
  orRule: {
    width: 1,
    height: 20,
    backgroundColor: Colors.border,
  },
  orText: {
    fontFamily: Fonts.serifItalic,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  section: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 2.2,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  questionInput: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sharp,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    fontSize: FontSize.sm,
    color: Colors.text,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  charCount: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'right',
    marginTop: Spacing.xs,
  },
  occasionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  occasionChip: {
    borderRadius: BorderRadius.sharp,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
  },
  occasionChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  occasionChipText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: Colors.text,
  },
  occasionChipTextSelected: {
    color: Colors.white,
  },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  analyzeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sharp,
    paddingVertical: Spacing.md + 2,
  },
  analyzeBtnDisabled: {
    backgroundColor: Colors.surfaceLight,
  },
  analyzeBtnText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.65,
    color: Colors.white,
  },
  analyzeBtnTextDisabled: {
    color: Colors.textMuted,
  },
  analyzingState: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md + 2,
  },
  analyzingText: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },

  // ── Verdict ───────────────────────────────────────────────────────────────
  verdictBanner: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  verdictBannerLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 2.2,
    color: Colors.textMuted,
  },
  verdictBannerRule: {
    width: 60,
    height: 1,
    backgroundColor: Colors.primary,
  },
  verdictBannerWinner: {
    fontFamily: Fonts.serif,
    fontSize: 28,
    color: Colors.text,
  },
  verdictRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
    marginBottom: Spacing.xl,
    alignItems: 'flex-start',
  },
  verdictSlot: {
    flex: 1,
    alignItems: 'center',
  },
  winnerBadge: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sharp,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    marginBottom: Spacing.xs,
  },
  winnerBadgeText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: Colors.white,
  },
  verdictBox: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: BorderRadius.sharp,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  verdictBoxWinner: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  verdictSlotLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: Colors.text,
    marginTop: Spacing.xs,
  },
  verdictCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  verdictCardLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 2.2,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  verdictCardRule: {
    width: 40,
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.12)',
    marginBottom: Spacing.sm,
  },
  verdictCardText: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.sm,
    color: Colors.text,
    lineHeight: 22,
  },
  verdictActions: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sharp,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
  },
  shareBtnText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: Colors.text,
  },
  doneBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sharp,
    backgroundColor: Colors.primary,
  },
  doneBtnText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.65,
    color: Colors.white,
  },
});
