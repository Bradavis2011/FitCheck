import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Fonts, FontSize } from '../src/constants/theme';
import {
  useStylistChatHistory,
  useSendStylistMessage,
  useStylistChatStatus,
  StylistChatMessage,
} from '../src/hooks/useApi';
import { useSubscriptionStore } from '../src/stores/subscriptionStore';

const SUGGESTION_CHIPS = [
  'What should I wear today?',
  "What's missing from my closet?",
  'Build me an outfit for work',
  "How's my style evolving?",
];

function TypingIndicator() {
  const [dot, setDot] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setDot((d) => (d + 1) % 3), 450);
    return () => clearInterval(t);
  }, []);
  return (
    <View style={styles.typingRow}>
      <Text style={styles.messageLabel}>Noa</Text>
      <View style={styles.rule} />
      <View style={styles.typingDots}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={[styles.typingDot, { opacity: dot === i ? 1 : 0.3 }]}
          />
        ))}
      </View>
    </View>
  );
}

export default function StylistChatScreen() {
  const router = useRouter();
  const { initialMessage } = useLocalSearchParams<{ initialMessage?: string }>();
  const { tier } = useSubscriptionStore();
  const scrollRef = useRef<ScrollView>(null);

  const { data: historyData, isLoading: historyLoading } = useStylistChatHistory();
  const { data: statusData } = useStylistChatStatus();
  const sendMutation = useSendStylistMessage();

  const [inputText, setInputText] = useState('');
  const [optimisticMessages, setOptimisticMessages] = useState<
    Array<{ id: string; role: 'user' | 'model'; content: string; createdAt: string }>
  >([]);
  const [isSending, setIsSending] = useState(false);

  // Pre-populate from navigation params (e.g. "Plan with Noa" from event card)
  useEffect(() => {
    if (initialMessage) {
      setInputText(initialMessage);
    }
  }, [initialMessage]);

  // Scroll to bottom when messages load or new ones arrive
  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [historyData, optimisticMessages]);

  const allMessages: StylistChatMessage[] = [
    ...(historyData?.messages || []),
    ...optimisticMessages,
  ];

  const handleSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isSending) return;

      // Check limit for free tier
      if (tier === 'free' && statusData?.remaining === 0) {
        Alert.alert(
          'Daily limit reached',
          'Upgrade to Plus for 20 messages per day, or Pro for unlimited.',
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Upgrade', onPress: () => router.push('/subscription' as any) },
          ]
        );
        return;
      }

      const userMsg = {
        id: `opt-${Date.now()}`,
        role: 'user' as const,
        content: trimmed,
        createdAt: new Date().toISOString(),
      };

      setInputText('');
      setIsSending(true);
      setOptimisticMessages((prev) => [...prev, userMsg]);

      try {
        await sendMutation.mutateAsync(trimmed);
        setOptimisticMessages([]);
      } catch (err: any) {
        setOptimisticMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
        if (err?.response?.status === 429) {
          Alert.alert(
            'Daily limit reached',
            'Upgrade to Plus for more messages.',
            [
              { text: 'Later', style: 'cancel' },
              { text: 'Upgrade', onPress: () => router.push('/subscription' as any) },
            ]
          );
        } else {
          Alert.alert('Error', 'Could not send message. Please try again.');
        }
      } finally {
        setIsSending(false);
      }
    },
    [isSending, sendMutation, tier, statusData, router]
  );

  const handleChipPress = (chip: string) => {
    handleSend(chip);
  };

  const isEmpty = allMessages.length === 0 && !historyLoading;

  const remaining =
    tier === 'pro'
      ? null
      : statusData?.remaining ?? (tier === 'free' ? 5 : 20);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Noa</Text>
        <View style={{ width: 34 }} />
      </View>
      <View style={styles.headerRule} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Empty state */}
          {isEmpty && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Noa is your AI stylist.</Text>
              <Text style={styles.emptySubtitle}>
                She sees your wardrobe, your weather,{'\n'}and your patterns.
              </Text>
              <View style={styles.chipRow}>
                {SUGGESTION_CHIPS.map((chip) => (
                  <TouchableOpacity
                    key={chip}
                    style={styles.suggestionChip}
                    onPress={() => handleChipPress(chip)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.suggestionChipText}>{chip.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {historyLoading && (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xxl }} />
          )}

          {/* Messages — editorial advice-column format */}
          {allMessages.map((msg, idx) => (
            <View key={msg.id} style={styles.messageBlock}>
              {msg.role === 'user' ? (
                <>
                  <Text style={styles.messageLabel}>You</Text>
                  <Text style={styles.userContent}>{msg.content}</Text>
                </>
              ) : (
                <>
                  <Text style={[styles.messageLabel, styles.noaLabel]}>Noa</Text>
                  <View style={styles.rule} />
                  <Text style={styles.noaContent}>{msg.content}</Text>
                </>
              )}
              {idx < allMessages.length - 1 && <View style={styles.messageDivider} />}
            </View>
          ))}

          {/* Typing indicator */}
          {isSending && <TypingIndicator />}
        </ScrollView>

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask Noa..."
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={1000}
            onSubmitEditing={() => handleSend(inputText)}
            returnKeyType="send"
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || isSending) && styles.sendButtonDisabled]}
            onPress={() => handleSend(inputText)}
            disabled={!inputText.trim() || isSending}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-forward" size={18} color={Colors.white} />
          </TouchableOpacity>
        </View>

        {/* Remaining messages counter (free tier) */}
        {tier !== 'pro' && remaining !== null && (
          <Text style={styles.remainingText}>
            {remaining} of {tier === 'free' ? 5 : 20} remaining today
          </Text>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    color: Colors.text,
  },
  headerRule: {
    height: 60,
    width: 1,
    backgroundColor: Colors.primary,
    marginLeft: Spacing.lg,
    marginBottom: Spacing.md,
  },
  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    flexGrow: 1,
  },
  // Empty state
  emptyState: {
    paddingTop: Spacing.xxl,
  },
  emptyTitle: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.md,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginBottom: Spacing.xl,
    lineHeight: 20,
  },
  chipRow: {
    gap: Spacing.sm,
  },
  suggestionChip: {
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 0,
    alignSelf: 'flex-start',
  },
  suggestionChipText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.5,
    color: Colors.text,
  },
  // Message blocks
  messageBlock: {
    marginBottom: Spacing.lg,
  },
  messageLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 2.2,
    color: Colors.textMuted,
    marginBottom: Spacing.xs,
  },
  noaLabel: {
    color: Colors.primary,
  },
  userContent: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
  },
  noaContent: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    color: Colors.text,
    lineHeight: 23,
  },
  rule: {
    width: 60,
    height: 1,
    backgroundColor: Colors.primary,
    marginBottom: Spacing.sm,
  },
  messageDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginTop: Spacing.lg,
  },
  // Typing indicator
  typingRow: {
    marginBottom: Spacing.lg,
  },
  typingDots: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  textInput: {
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 0,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    maxHeight: 120,
    minHeight: 44,
  },
  sendButton: {
    width: 44,
    height: 44,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 0,
  },
  sendButtonDisabled: {
    backgroundColor: Colors.textMuted,
  },
  remainingText: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.background,
  },
});
