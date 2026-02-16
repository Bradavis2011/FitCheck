import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, TextInput, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, FontSize, BorderRadius } from '../src/constants/theme';
import PillButton from '../src/components/PillButton';

const OCCASIONS = ['Work', 'Casual', 'Date Night', 'Event', 'Interview', 'Party'];

export default function CreateComparisonScreen() {
  const router = useRouter();
  const [imageA, setImageA] = useState<string | null>(null);
  const [imageB, setImageB] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pickImage = async (slot: 'A' | 'B') => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        if (slot === 'A') {
          setImageA(result.assets[0].uri);
        } else {
          setImageB(result.assets[0].uri);
        }
      }
    } catch (error) {
      console.error('Failed to pick image:', error);
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
        if (slot === 'A') {
          setImageA(result.assets[0].uri);
        } else {
          setImageB(result.assets[0].uri);
        }
      }
    } catch (error) {
      console.error('Failed to take photo:', error);
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
    setSelectedOccasions((prev) =>
      prev.includes(occasion)
        ? prev.filter((o) => o !== occasion)
        : [...prev, occasion]
    );
  };

  const handleSubmit = async () => {
    if (!imageA || !imageB) {
      Alert.alert('Missing Photos', 'Please add both outfit photos.');
      return;
    }

    if (selectedOccasions.length === 0) {
      Alert.alert('Select Occasion', 'Please select at least one occasion.');
      return;
    }

    setIsSubmitting(true);
    try {
      // TODO: Upload images and create comparison post via API
      console.log('Creating comparison:', {
        imageA,
        imageB,
        question: question || 'Which outfit works better?',
        occasions: selectedOccasions,
      });

      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate API call

      Alert.alert('Posted!', 'Your comparison has been shared with the community.', [
        { text: 'OK', onPress: () => router.push('/(tabs)/community') },
      ]);
    } catch (error) {
      console.error('Failed to create comparison:', error);
      Alert.alert('Error', 'Failed to post comparison. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = imageA && imageB && selectedOccasions.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Or This?</Text>
        <View style={styles.closeButton} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Hero Text */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Can't decide?</Text>
          <Text style={styles.heroSubtitle}>
            Post two outfits and let the community help you choose
          </Text>
        </View>

        {/* Image Selection */}
        <View style={styles.imagesContainer}>
          {/* Option A */}
          <View style={styles.imageSlot}>
            <Text style={styles.imageLabel}>Option A</Text>
            {imageA ? (
              <TouchableOpacity
                style={styles.imagePreview}
                onPress={() => showImageOptions('A')}
                activeOpacity={0.8}
              >
                <Image source={{ uri: imageA }} style={styles.image} />
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => setImageA(null)}
                >
                  <Ionicons name="close-circle" size={24} color={Colors.white} />
                </TouchableOpacity>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.imagePlaceholder}
                onPress={() => showImageOptions('A')}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={[Colors.primary, Colors.primaryLight]}
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

          {/* "Or" Badge */}
          <View style={styles.orBadge}>
            <Text style={styles.orText}>or</Text>
          </View>

          {/* Option B */}
          <View style={styles.imageSlot}>
            <Text style={styles.imageLabel}>Option B</Text>
            {imageB ? (
              <TouchableOpacity
                style={styles.imagePreview}
                onPress={() => showImageOptions('B')}
                activeOpacity={0.8}
              >
                <Image source={{ uri: imageB }} style={styles.image} />
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => setImageB(null)}
                >
                  <Ionicons name="close-circle" size={24} color={Colors.white} />
                </TouchableOpacity>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.imagePlaceholder}
                onPress={() => showImageOptions('B')}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={[Colors.primaryLight, Colors.primary]}
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
        </View>

        {/* Question Input */}
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

        {/* Occasion Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Occasion <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.pillsContainer}>
            {OCCASIONS.map((occasion) => (
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

      {/* Submit Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, (!canSubmit || isSubmitting) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || isSubmitting}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={
              canSubmit && !isSubmitting
                ? [Colors.primary, Colors.secondary]
                : [Colors.surface, Colors.surface]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.submitButtonGradient}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <>
                <Ionicons
                  name="people"
                  size={20}
                  color={canSubmit ? Colors.white : Colors.textMuted}
                />
                <Text
                  style={[
                    styles.submitButtonText,
                    !canSubmit && styles.submitButtonTextDisabled,
                  ]}
                >
                  Share with Community
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
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.primary,
    fontStyle: 'italic',
  },
  scrollView: {
    flex: 1,
  },
  hero: {
    padding: Spacing.lg,
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  heroSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  imagesContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    alignItems: 'center',
    marginBottom: Spacing.lg,
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
    aspectRatio: 3 / 4,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: BorderRadius.full,
  },
  orBadge: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: -Spacing.xs,
    zIndex: 1,
  },
  orText: {
    fontSize: FontSize.sm,
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
  required: {
    color: Colors.secondary,
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
  submitButton: {
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  submitButtonText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.white,
  },
  submitButtonTextDisabled: {
    color: Colors.textMuted,
  },
});
