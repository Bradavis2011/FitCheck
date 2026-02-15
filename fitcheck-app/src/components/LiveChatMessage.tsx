import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../constants/theme';
import { LiveChatMessage as MessageType } from '../services/live.service';

interface Props {
  message: MessageType;
}

export function LiveChatMessage({ message }: Props) {
  if (message.isAi) {
    return (
      <View style={styles.aiMessageContainer}>
        <View style={styles.aiHeader}>
          <Ionicons name="sparkles" size={16} color={Colors.primary} />
          <Text style={styles.aiLabel}>AI Style Assistant</Text>
        </View>
        <Text style={styles.aiMessage}>{message.content}</Text>
      </View>
    );
  }

  const username = message.user?.username || message.user?.name || 'Anonymous';

  return (
    <View style={styles.messageContainer}>
      <Text style={styles.username}>{username}</Text>
      <Text style={styles.message}>{message.content}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  messageContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xs,
    maxWidth: '80%',
  },
  username: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 2,
  },
  message: {
    fontSize: FontSize.sm,
    color: Colors.white,
  },
  aiMessageContainer: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xs,
    maxWidth: '90%',
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  aiLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.white,
  },
  aiMessage: {
    fontSize: FontSize.sm,
    color: Colors.white,
  },
});
