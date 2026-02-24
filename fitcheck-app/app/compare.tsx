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
import * as FileSystem from 'expo-file-system/legacy';
import { comparisonService } from '../src/services/api.service';
import { track } from '../src/lib/analytics';

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
            style={StyleSheet.absoluteFillObject}
            onPress={onAdd}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={[Colors.primary, Colors.primaryLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={slotStyles.gradient}
            >
              <Ionicons name="camera" size={32} color="#fff" />
              <Text style={slotStyles.addText}>Add Photo</Text>
            </LinearGradient>
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
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  box: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  addText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: '#fff',
  },
  removeBtn: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 99,
  },
  editBtn: {
    position: 'absolute',
    bottom: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 99,
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
        quality: 0.5,
      });
      if (!result.canceled && result.assets[0]) {
        slot === 'A' ? setImageA(result.assets[0].uri) : setImageB(result.assets[0].uri);
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
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.5,
      });
      if (!result.canceled && result.assets[0]) {
        slot === 'A' ? setImageA(result.assets[0].uri) : setImageB(result.assets[0].uri);
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
        code: error?.code,
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
          <Text style={styles.headerTitle}>AI Verdict</Text>
          <View style={styles.headerBtn} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          <LinearGradient
            colors={[Colors.primary, Colors.primaryLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.winnerBanner}
          >
            <Ionicons name="star" size={18} color="#fff" />
            <Text style={styles.winnerBannerText}>The AI has spoken</Text>
          </LinearGradient>

          {/* Verdict image pair */}
          <View style={styles.verdictRow}>
            {/* Winner */}
            <View style={styles.verdictSlot}>
              <View style={styles.winnerBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#fff" />
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
            <View style={[styles.verdictSlot, { marginTop: 30 }]}>
              <View style={styles.verdictBox}>
                <Image
                  source={{ uri: loserImage! }}
                  style={[StyleSheet.absoluteFillObject, { opacity: 0.5 }]}
                  resizeMode="cover"
                />
              </View>
              <Text style={[styles.verdictSlotLabel, { color: Colors.textMuted }]}>{loserLabel}</Text>
            </View>
          </View>

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
                <>
                  <Ionicons name="people-outline" size={18} color={Colors.text} />
                  <Text style={styles.shareBtnText}>Share with Community</Text>
                </>
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
          Add two outfits. AI picks a winner. Optionally share with the community.
        </Text>

        {/* Image slots */}
        <View style={styles.slotsRow}>
          <ImageSlot
            image={imageA}
            label="Option A"
            onAdd={() => showImageOptions('A')}
            onRemove={() => setImageA(null)}
          />

          <View style={styles.orBadge}>
            <Text style={styles.orText}>or</Text>
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
          <Text style={styles.charCount}>{question.length}/150</Text>
        </View>

        {/* Occasion */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Occasion (optional)</Text>
          <View style={styles.pills}>
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
          style={[styles.analyzeBtn, !canAnalyze && styles.analyzeBtnDisabled]}
          onPress={handleAnalyze}
          disabled={!canAnalyze || screenState === 'analyzing'}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={canAnalyze ? [Colors.primary, Colors.primaryLight] : [Colors.surface, Colors.surface]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.analyzeBtnGradient}
          >
            {screenState === 'analyzing' ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.analyzeBtnText}>Analyzing…</Text>
              </>
            ) : (
              <>
                <Ionicons
                  name="sparkles"
                  size={20}
                  color={canAnalyze ? '#fff' : Colors.textMuted}
                />
                <Text style={[styles.analyzeBtnText, !canAnalyze && { color: Colors.textMuted }]}>
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
  headerBtn: {
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
  subtitle: {
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
  orBadge: {
    width: 36,
    height: 36,
    borderRadius: 99,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  orText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: '#fff',
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
  charCount: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'right',
    marginTop: Spacing.xs,
  },
  pills: {
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
  analyzeBtn: {
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  analyzeBtnDisabled: {
    opacity: 0.5,
  },
  analyzeBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  analyzeBtnText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: '#fff',
  },

  // ── Verdict ───────────────────────────────────────────────────────────────
  winnerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  winnerBannerText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: '#fff',
  },
  verdictRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
    marginVertical: Spacing.lg,
    alignItems: 'flex-start',
  },
  verdictSlot: {
    flex: 1,
    alignItems: 'center',
  },
  winnerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    borderRadius: 99,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    marginBottom: Spacing.xs,
  },
  winnerBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: '#fff',
  },
  verdictBox: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  verdictBoxWinner: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  verdictSlotLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    marginTop: Spacing.xs,
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
  shareBtn: {
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
  shareBtnText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  doneBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
  },
  doneBtnText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: '#fff',
  },
});
