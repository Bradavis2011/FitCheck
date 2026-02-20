import { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, FontSize, BorderRadius } from '../src/constants/theme';
import { ProgressDots } from '../src/components/ProgressDots';
import { useAuthStore } from '../src/stores/authStore';
import OrThisLogo from '../src/components/OrThisLogo';

const { width } = Dimensions.get('window');

interface OnboardingSlide {
  id: number;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  gradient: [string, string];
}

const slides: OnboardingSlide[] = [
  {
    id: 1,
    title: 'Welcome to Or This?',
    subtitle: 'Get instant outfit feedback from AI and community',
    icon: 'camera',
    gradient: [Colors.primary, Colors.primaryLight],
  },
  {
    id: 2,
    title: 'How It Works',
    subtitle: '1. Take a photo of your outfit\n2. Tell us the occasion\n3. Get AI-powered feedback in seconds',
    icon: 'bulb',
    gradient: [Colors.primaryLight, Colors.primary],
  },
  {
    id: 3,
    title: 'AI + Community',
    subtitle: 'Get instant AI feedback, then share with the community for more perspectives',
    icon: 'people',
    gradient: [Colors.primary, Colors.primaryLight],
  },
  {
    id: 4,
    title: 'Ready to Go',
    subtitle: 'Your supportive style community awaits. Let\'s check your first outfit!',
    icon: 'sparkles',
    gradient: [Colors.primaryLight, Colors.primary],
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { completeOnboarding } = useAuthStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      const nextIndex = currentIndex + 1;
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setCurrentIndex(nextIndex);
    }
  };

  const handleSkip = () => {
    const lastIndex = slides.length - 1;
    flatListRef.current?.scrollToIndex({ index: lastIndex, animated: true });
    setCurrentIndex(lastIndex);
  };

  const handleGetStarted = () => {
    completeOnboarding();
    router.replace('/(tabs)' as any);
  };

  const renderSlide = ({ item }: { item: OnboardingSlide }) => (
    <View style={styles.slide}>
      <LinearGradient
        colors={item.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.iconContainer}
      >
        <Ionicons name={item.icon} size={80} color={Colors.white} />
      </LinearGradient>

      {item.id === 1 ? (
        <View style={styles.titleLogoRow}>
          <Text style={styles.title}>Welcome to </Text>
          <OrThisLogo size={28} />
        </View>
      ) : (
        <Text style={styles.title}>{item.title}</Text>
      )}
      <Text style={styles.subtitle}>{item.subtitle}</Text>
    </View>
  );

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index || 0);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const isLastSlide = currentIndex === slides.length - 1;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Skip Button - Hidden on last slide (Get Started is already there) */}
        {!isLastSlide && (
          <TouchableOpacity style={styles.skipButton} onPress={handleGetStarted}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}

        {/* Slides */}
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
          scrollEnabled={true}
        />

        {/* Progress Dots */}
        <View style={styles.footer}>
          <ProgressDots current={currentIndex} total={slides.length} />

          {/* Action Button */}
          {isLastSlide ? (
            <TouchableOpacity style={styles.getStartedButton} onPress={handleGetStarted}>
              <LinearGradient
                colors={[Colors.primary, Colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientButton}
              >
                <Text style={styles.getStartedText}>Get Started</Text>
                <Ionicons name="arrow-forward" size={20} color={Colors.white} />
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
              <Text style={styles.nextText}>Next</Text>
              <Ionicons name="arrow-forward" size={20} color={Colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
  },
  skipButton: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.lg,
    zIndex: 10,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  skipText: {
    fontSize: FontSize.lg,
    color: Colors.primary,
    fontWeight: '700',
  },
  slide: {
    width,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  iconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  titleLogoRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  subtitle: {
    fontSize: FontSize.lg,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.lg,
    alignItems: 'center',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    borderWidth: 3,
    borderColor: Colors.primary,
    minWidth: 250,
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  nextText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
  },
  getStartedButton: {
    width: '100%',
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  getStartedText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
  },
});
