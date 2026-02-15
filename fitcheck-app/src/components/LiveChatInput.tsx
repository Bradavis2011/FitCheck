import { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../constants/theme';

interface Props {
  onSend: (message: string) => void;
  onTyping?: (isTyping: boolean) => void;
}

export function LiveChatInput({ onSend, onTyping }: Props) {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (message.trim()) {
      onSend(message.trim());
      setMessage('');
      onTyping?.(false);
    }
  };

  const handleChangeText = (text: string) => {
    setMessage(text);
    onTyping?.(text.length > 0);
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Send a message..."
        placeholderTextColor={Colors.textMuted}
        value={message}
        onChangeText={handleChangeText}
        multiline
        maxLength={200}
      />
      <TouchableOpacity
        style={[styles.sendButton, !message.trim() && styles.sendButtonDisabled]}
        onPress={handleSend}
        disabled={!message.trim()}
      >
        <Ionicons
          name="send"
          size={20}
          color={message.trim() ? Colors.white : Colors.textMuted}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.sm,
    color: Colors.white,
    maxHeight: 100,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});
