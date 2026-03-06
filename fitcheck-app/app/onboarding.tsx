import { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Fonts } from '../src/constants/theme';
import { useAuthStore } from '../src/stores/authStore';
import OrThisLogo from '../src/components/OrThisLogo';
import ScoreDisplay from '../src/components/ScoreDisplay';
import { track } from '../src/lib/analytics';

const { width } = Dimensions.get('window');

const SLIDE_CAMERA_ID = 4;

interface OnboardingSlide {
  id: number;
  label: string;
  headline: string;
  body: string;
}

const slides: OnboardingSlide[] = [
  {
    id: 1,
    label: '',
    headline: 'Confidence in\nevery choice.',
    body: 'Honest AI outfit feedback in 30 seconds. No filters, no flattery — just real style intel.',
  },
  {
    id: 2,
    label: 'How it works',
    headline: 'Get your score.',
    body: 'Set the scene — occasion, weather, vibe. Our AI scores your outfit and tells you exactly what to improve.',
  },
  {
    id: 3,
    label: 'Your closet',
    headline: 'The more you use it,\nthe smarter it gets.',
    body: 'Every outfit you check builds your digital wardrobe — so feedback gets sharper and more personal over time.',
  },
  {
    id: SLIDE_CAMERA_ID,
    label: 'One more thing',
    headline: 'Your camera.\nYour style.',
    body: 'We need camera access to analyze your outfits. You can also upload from your gallery at any time.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { completeOnboarding } = useAuthStore();
  const [, requestCameraPermission] = useCameraPermissions();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      const nextIndex = currentIndex + 1;
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setCurrentIndex(nextIndex);
    }
  };

  const finish = async () => {
    track('onboarding_completed');
    await completeOnboarding();
    router.replace('/(tabs)' as any);
  };

  const handleAllowCamera = async () => {
    // Fire the OS dialog with context already set — improves grant rate
    await requestCameraPermission();
    track('onboarding_camera_permission_requested');
    await finish();
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index || 0);
    }
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const isLastSlide = currentIndex === slides.length - 1;

  const renderSlide = ({ item }: { item: OnboardingSlide }) => (
    <View style={styles.slide}>
      {item.id === 1 ? (
        <View style={styles.logoWrap}>
          <OrThisLogo size={32} />
        </View>
      ) : (
        <View style={styles.labelWrap}>
          <Text style={styles.sectionLabel}>{item.label}</Text>
          <View style={styles.rule} />
        </View>
      )}

      {item.id === 2 && (
        <View style={styles.scorePreview}>
          <ScoreDisplay score={8} />
          <Text style={styles.scoreCaption}>Your outfit. Scored.</Text>
        </View>
      )}

      {item.id === SLIDE_CAMERA_ID && (
        <View style={styles.cameraIconWrap}>
          <Ionicons name="camera-outline" size={64} color={Colors.primary} />
        </View>
      )}

      <Text style={[styles.headline, item.id === 2 && styles.headlineSmall]}>
        {item.headline}
      </Text>
      <Text style={styles.body}>{item.body}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Skip only shown on non-final slides */}
      {!isLastSlide && (
        <TouchableOpacity style={styles.skipButton} onPress={finish}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id.toString()}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        style={styles.flatList}
        scrollEnabled={false}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View key={i} style={[styles.dot, i === currentIndex && styles.dotActive]} />
          ))}
        </View>

        {isLastSlide ? (
          <TouchableOpacity style={styles.primaryButton} onPress={handleAllowCamera}>
            <Text style={styles.primaryButtonText}>Allow Camera Access</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.secondaryButton} onPress={handleNext}>
            <Text style={styles.secondaryButtonText}>Next</Text>
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
  skipButton: {
    position: 'absolute',
    top: Spacing.lg,
    right: Spacing.lg,
    zIndex: 10,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  skipText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Colors.textMuted,
  },
  flatList: {
    flex: 1,
  },
  slide: {
    width,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: 60,
  },
  logoWrap: {
    marginBottom: Spacing.xl,
  },
  labelWrap: {
    marginBottom: Spacing.xl,
  },
  sectionLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 2.2,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  rule: {
    width: 60,
    height: 1,
    backgroundColor: Colors.primary,
  },
  scorePreview: {
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  scoreCaption: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 6,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  cameraIconWrap: {
    marginBottom: Spacing.lg,
  },
  headline: {
    fontFamily: Fonts.serif,
    fontSize: 36,
    color: Colors.text,
    lineHeight: 44,
    marginBottom: Spacing.lg,
  },
  headlineSmall: {
    fontSize: 28,
    lineHeight: 36,
  },
  body: {
    fontFamily: Fonts.sans,
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.lg,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  dot: {
    width: 20,
    height: 2,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  dotActive: {
    backgroundColor: Colors.primary,
    width: 32,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.65,
    color: Colors.white,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.65,
    color: Colors.primary,
  },
});
