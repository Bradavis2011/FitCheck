import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../src/constants/theme';
import { expertReviewService } from '../src/services/api.service';

const SPECIALTIES = [
  'Casual',
  'Formal',
  'Business',
  'Streetwear',
  'Minimalist',
  'Maximalist',
  'Sustainable',
  'Athletic',
  'Vintage',
  'Boho',
  'Preppy',
  'Edgy',
];

export default function BecomeStylistScreen() {
  const router = useRouter();

  const [bio, setBio] = useState('');
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [instagramUrl, setInstagramUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleSpecialty = (s: string) => {
    setSpecialties((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const handleSubmit = async () => {
    if (bio.trim().length < 20) {
      Alert.alert('Bio too short', 'Please write at least 20 characters about your experience.');
      return;
    }
    if (specialties.length === 0) {
      Alert.alert('Select specialties', 'Please select at least one style specialty.');
      return;
    }

    setIsSubmitting(true);
    try {
      await expertReviewService.applyStylist({
        bio: bio.trim(),
        specialties,
        instagramUrl: instagramUrl.trim() || undefined,
      });

      Alert.alert(
        'Application Submitted!',
        'Thank you for applying. Our team will review your application and get back to you within 3-5 business days.',
        [{ text: 'Done', onPress: () => router.back() }]
      );
    } catch (error: any) {
      const message = error?.response?.data?.error || error?.message || 'Something went wrong.';
      Alert.alert('Error', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Become a Stylist</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="ribbon" size={36} color={Colors.primary} />
          </View>
          <Text style={styles.heroTitle}>Share your style expertise</Text>
          <Text style={styles.heroText}>
            Verified stylists review outfits for Pro subscribers and earn recognition in the
            community. Once approved, your profile will be visible to users seeking expert advice.
          </Text>
        </View>

        {/* Bio */}
        <View style={styles.section}>
          <Text style={styles.label}>Your background *</Text>
          <Text style={styles.hint}>Describe your styling experience and qualifications</Text>
          <TextInput
            style={styles.textArea}
            value={bio}
            onChangeText={setBio}
            placeholder="e.g. I'm a certified personal stylist with 5 years of experience working with clients across NYC. I specialize in helping people build versatile wardrobes that work for their lifestyle..."
            placeholderTextColor={Colors.textMuted}
            multiline
            numberOfLines={5}
            maxLength={1000}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{bio.length}/1000</Text>
        </View>

        {/* Specialties */}
        <View style={styles.section}>
          <Text style={styles.label}>Style specialties *</Text>
          <Text style={styles.hint}>Select the styles you know best</Text>
          <View style={styles.specialtiesGrid}>
            {SPECIALTIES.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.specialtyChip, specialties.includes(s) && styles.specialtyChipActive]}
                onPress={() => toggleSpecialty(s)}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.specialtyText, specialties.includes(s) && styles.specialtyTextActive]}
                >
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Instagram */}
        <View style={styles.section}>
          <Text style={styles.label}>Instagram profile (optional)</Text>
          <Text style={styles.hint}>Helps us verify your work</Text>
          <TextInput
            style={styles.input}
            value={instagramUrl}
            onChangeText={setInstagramUrl}
            placeholder="https://instagram.com/youraccount"
            placeholderTextColor={Colors.textMuted}
            keyboardType="url"
            autoCapitalize="none"
          />
        </View>

        {/* What happens next */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>What happens next?</Text>
          <View style={styles.infoRow}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
            <Text style={styles.infoText}>Our team reviews your application within 3-5 days</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
            <Text style={styles.infoText}>You'll receive an in-app notification when approved</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
            <Text style={styles.infoText}>
              Approved stylists appear in the stylist directory for Pro users
            </Text>
          </View>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.submitText}>Submit Application</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
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
  headerTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.md,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  heroTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  heroText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  hint: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  textArea: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.sm,
    color: Colors.text,
    minHeight: 120,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  charCount: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'right',
    marginTop: 4,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.sm,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  specialtiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  specialtyChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  specialtyChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  specialtyText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  specialtyTextActive: {
    color: Colors.white,
  },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  infoTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  infoText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    flex: 1,
    lineHeight: 20,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.white,
  },
});
