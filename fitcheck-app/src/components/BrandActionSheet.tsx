/**
 * BrandActionSheet
 *
 * Branded replacement for React Native's Alert.alert() — uses brand colors
 * instead of the device's system UI (which goes gunmetal grey in dark mode).
 *
 * Handles two use-cases:
 *   1. Action sheet — multiple options (long-press menus)
 *   2. Alert / confirmation — title + message + one or more buttons
 */

import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Fonts, Spacing } from '../constants/theme';

export interface SheetAction {
  text: string;
  style?: 'default' | 'destructive' | 'cancel';
  onPress?: () => void;
}

interface Props {
  visible: boolean;
  title?: string;
  message?: string;
  actions: SheetAction[];
  onClose: () => void;
}

export default function BrandActionSheet({ visible, title, message, actions, onClose }: Props) {
  const mainActions = actions.filter(a => a.style !== 'cancel');
  const cancelAction = actions.find(a => a.style === 'cancel');

  function handleAction(action: SheetAction) {
    onClose();
    action.onPress?.();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          {(title || message) && (
            <View style={styles.header}>
              {title && <Text style={styles.title}>{title}</Text>}
              {message && <Text style={styles.message}>{message}</Text>}
            </View>
          )}

          {mainActions.map((action, i) => (
            <TouchableOpacity
              key={i}
              style={[
                styles.action,
                i < mainActions.length - 1 && styles.actionBorder,
              ]}
              onPress={() => handleAction(action)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.actionText,
                  action.style === 'destructive' && styles.actionTextDestructive,
                ]}
              >
                {action.text}
              </Text>
            </TouchableOpacity>
          ))}

          {cancelAction && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => handleAction(cancelAction)}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelText}>{cancelAction.text}</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
    paddingBottom: 32,
    paddingHorizontal: Spacing.md,
  },
  sheet: {
    backgroundColor: Colors.surface,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  message: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  action: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 16,
  },
  actionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  actionText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 15,
    color: Colors.text,
  },
  actionTextDestructive: {
    color: Colors.error,
  },
  cancelButton: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 16,
    backgroundColor: Colors.backgroundSecondary,
  },
  cancelText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
