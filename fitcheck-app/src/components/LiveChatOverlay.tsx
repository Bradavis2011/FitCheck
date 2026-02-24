import { useRef, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing } from '../constants/theme';
import { LiveChatMessage } from './LiveChatMessage';
import { LiveChatInput } from './LiveChatInput';
import { LiveChatMessage as MessageType } from '../services/live.service';

interface Props {
  messages: MessageType[];
  onSendMessage: (message: string) => void;
  onTyping?: (isTyping: boolean) => void;
}

const { height } = Dimensions.get('window');

export function LiveChatOverlay({ messages, onSendMessage, onTyping }: Props) {
  const scrollViewRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((message) => (
          <LiveChatMessage key={message.id} message={message} />
        ))}
      </ScrollView>

      <View style={[styles.inputContainer, { paddingBottom: Math.round(insets.bottom * 0.75) + Spacing.lg }]}>
        <LiveChatInput onSend={onSendMessage} onTyping={onTyping} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.5,
    pointerEvents: 'box-none',
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    pointerEvents: 'box-none',
  },
  messagesContent: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    justifyContent: 'flex-end',
  },
  inputContainer: {
    paddingHorizontal: Spacing.md,
    pointerEvents: 'box-none',
  },
});
