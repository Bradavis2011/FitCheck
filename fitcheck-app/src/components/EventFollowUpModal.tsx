import { View, Text, StyleSheet, TouchableOpacity, Modal, Image, ActivityIndicator } from 'react-native';
import { Colors, Fonts, Spacing, FontSize, BorderRadius } from '../constants/theme';
import { useRespondToEventFollowUp } from '../hooks/useApi';
import { EventFollowUpResponse } from '../services/api.service';

interface EventFollowUpModalProps {
  visible: boolean;
  followUpId: string;
  occasion: string;
  thumbnailUrl?: string | null;
  thumbnailData?: string | null;
  onDismiss: () => void;
}

const RESPONSE_OPTIONS: { key: EventFollowUpResponse; emoji: string; label: string }[] = [
  { key: 'crushed_it', emoji: '🔥', label: 'Crushed it' },
  { key: 'felt_good', emoji: '😊', label: 'Felt good' },
  { key: 'meh', emoji: '😐', label: 'Meh' },
  { key: 'not_great', emoji: '😬', label: 'Not great' },
];

export default function EventFollowUpModal({
  visible,
  followUpId,
  occasion,
  thumbnailUrl,
  thumbnailData,
  onDismiss,
}: EventFollowUpModalProps) {
  const respond = useRespondToEventFollowUp();

  const handleResponse = async (response: EventFollowUpResponse) => {
    try {
      await respond.mutateAsync({ followUpId, response });
    } catch (err) {
      // Best-effort — don't block dismiss on error
    }
    onDismiss();
  };

  const imageUri = thumbnailUrl || (thumbnailData ? `data:image/jpeg;base64,${thumbnailData}` : null);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {imageUri && (
            <Image source={{ uri: imageUri }} style={styles.thumb} resizeMode="cover" />
          )}

          <Text style={styles.title}>How did your {occasion} go?</Text>
          <Text style={styles.subtitle}>Tap to let us know — it helps us improve your next suggestion</Text>

          <View style={styles.grid}>
            {RESPONSE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={styles.option}
                onPress={() => handleResponse(opt.key)}
                disabled={respond.isPending}
                activeOpacity={0.7}
              >
                {respond.isPending ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <>
                    <Text style={styles.emoji}>{opt.emoji}</Text>
                    <Text style={styles.optionLabel}>{opt.label}</Text>
                  </>
                )}
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.skip} onPress={onDismiss} activeOpacity={0.7}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.lg,
    paddingBottom: 40,
    alignItems: 'center',
    gap: Spacing.md,
  },
  thumb: {
    width: 80,
    height: 110,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    marginBottom: 4,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: FontSize.xl,
    color: Colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'center',
    width: '100%',
  },
  option: {
    width: '46%',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: 6,
  },
  emoji: {
    fontSize: 32,
  },
  optionLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  skip: {
    paddingVertical: Spacing.sm,
  },
  skipText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    fontWeight: '500',
  },
});
