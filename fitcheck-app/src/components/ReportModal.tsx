import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../constants/theme';

type ReportReason = 'inappropriate' | 'spam' | 'other';
type TargetType = 'outfit' | 'user';

type Props = {
  visible: boolean;
  onClose: () => void;
  targetType: TargetType;
  targetId: string;
  targetName: string;
  onSubmit: (reason: ReportReason, details: string) => Promise<void>;
};

export default function ReportModal({
  visible,
  onClose,
  targetType,
  targetName,
  onSubmit,
}: Props) {
  const [selectedReason, setSelectedReason] = useState<ReportReason>('inappropriate');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reasons: Array<{ value: ReportReason; label: string; description: string }> = [
    {
      value: 'inappropriate',
      label: 'Inappropriate Content',
      description: 'Offensive, harmful, or violates guidelines',
    },
    {
      value: 'spam',
      label: 'Spam',
      description: 'Repetitive or promotional content',
    },
    {
      value: 'other',
      label: 'Other',
      description: 'Something else',
    },
  ];

  const handleSubmit = async () => {
    if (!details.trim() && selectedReason === 'other') {
      Alert.alert('Details Required', 'Please provide details for your report');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit(selectedReason, details);
      setDetails('');
      setSelectedReason('inappropriate');
      onClose();
      Alert.alert('Report Submitted', 'Thank you. We will review this report.');
    } catch (error: any) {
      Alert.alert(
        'Error',
        error?.response?.data?.error || 'Failed to submit report. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Report {targetType}</Text>
          <TouchableOpacity onPress={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Text style={styles.submitText}>Submit</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.targetInfo}>
            Reporting: {targetType === 'outfit' ? 'Outfit by' : ''} @{targetName}
          </Text>

          <Text style={styles.sectionTitle}>Why are you reporting this?</Text>

          {reasons.map((reason) => (
            <TouchableOpacity
              key={reason.value}
              style={[
                styles.reasonOption,
                selectedReason === reason.value && styles.reasonOptionSelected,
              ]}
              onPress={() => setSelectedReason(reason.value)}
              activeOpacity={0.7}
            >
              <View style={styles.reasonContent}>
                <Text
                  style={[
                    styles.reasonLabel,
                    selectedReason === reason.value && styles.reasonLabelSelected,
                  ]}
                >
                  {reason.label}
                </Text>
                <Text style={styles.reasonDescription}>{reason.description}</Text>
              </View>
              <View
                style={[
                  styles.radioOuter,
                  selectedReason === reason.value && styles.radioOuterSelected,
                ]}
              >
                {selectedReason === reason.value && <View style={styles.radioInner} />}
              </View>
            </TouchableOpacity>
          ))}

          <Text style={styles.sectionTitle}>Additional details (optional)</Text>
          <TextInput
            style={styles.detailsInput}
            value={details}
            onChangeText={setDetails}
            placeholder="Provide more information..."
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={500}
            numberOfLines={4}
          />
          <Text style={styles.characterCount}>{details.length}/500</Text>

          <Text style={styles.disclaimerText}>
            Reports are reviewed by our team. False reports may result in action against your
            account.
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
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
  cancelText: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  submitText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.primary,
  },
  content: {
    flex: 1,
    padding: Spacing.md,
  },
  targetInfo: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reasonOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryAlpha10,
  },
  reasonContent: {
    flex: 1,
    marginRight: Spacing.md,
  },
  reasonLabel: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  reasonLabelSelected: {
    color: Colors.primary,
  },
  reasonDescription: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterSelected: {
    borderColor: Colors.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  detailsInput: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    height: 100,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'right',
    marginTop: Spacing.xs,
  },
  disclaimerText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: Spacing.lg,
    fontStyle: 'italic',
  },
});
