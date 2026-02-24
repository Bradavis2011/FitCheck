import { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Markdown from 'react-native-markdown-display';
import { Colors, Spacing, FontSize, BorderRadius, Fonts } from '../constants/theme';
import { useSubmitFollowUp } from '../hooks/useApi';
import { OutfitFeedback } from '../services/api.service';
import { normalizeFeedback } from '../utils/feedbackAdapter';

interface FollowUp {
  question: string;
  answer: string;
}

interface FollowUpModalProps {
  visible: boolean;
  onClose: () => void;
  feedbackSummary: string;
  outfitId: string;
  maxFollowUps?: number;
  // NEW: Structured feedback data for dynamic question generation
  feedback?: OutfitFeedback;
  occasions?: string[];
  specificConcerns?: string;
  // Existing follow-ups from server
  existingFollowUps?: Array<{ userQuestion: string; aiResponse?: string }>;
}

// Category type for question classification
type QuestionCategory =
  | 'shoes' | 'accessories' | 'color' | 'fit' | 'occasion'
  | 'layering' | 'casual' | 'formal' | 'styling' | 'general';

// Ionicons for each category
const CATEGORY_ICONS: Record<QuestionCategory, keyof typeof Ionicons.glyphMap> = {
  shoes: 'footsteps',
  accessories: 'bag-handle',
  color: 'color-palette',
  fit: 'body',
  occasion: 'calendar',
  layering: 'layers',
  casual: 'sunny',
  formal: 'sparkles',
  styling: 'shirt',
  general: 'help-circle',
};

// Fallback questions when no feedback data is available
const FALLBACK_QUESTIONS: SuggestedQuestion[] = [
  {
    text: "What shoes would work better?",
    category: 'shoes',
  },
  {
    text: "How can I dress this up?",
    category: 'formal',
  },
  {
    text: "What accessories should I add?",
    category: 'accessories',
  },
  {
    text: "Does this work for my occasion?",
    category: 'occasion',
  },
];

interface SuggestedQuestion {
  text: string;
  category: QuestionCategory;
}

// Detect category from text using keyword patterns
function detectCategory(text: string): QuestionCategory {
  const lower = text.toLowerCase();

  if (/shoe|boot|sneaker|heel|sandal|footwear/.test(lower)) return 'shoes';
  if (/accessor|jewelry|watch|bag|belt|hat|scarf|necklace/.test(lower)) return 'accessories';
  if (/color|palette|tone|shade|contrast|pattern|print/.test(lower)) return 'color';
  if (/fit|silhouette|tailor|tight|loose|proportion|length/.test(lower)) return 'fit';
  if (/layer|jacket|coat|sweater|blazer|outerwear/.test(lower)) return 'layering';
  if (/formal|dress.up|elegant|evening|polished/.test(lower)) return 'formal';
  if (/casual|relax|comfort|everyday/.test(lower)) return 'casual';
  if (/occasion|event|interview|work|date|wedding/.test(lower)) return 'occasion';
  if (/style|tuck|roll|cuff|pair|match|coordinate/.test(lower)) return 'styling';

  return 'general';
}

// Generate suggested questions from feedback data (supports v1/v2 and v3.0 formats)
function generateSuggestedQuestions(
  feedback?: OutfitFeedback,
  occasions?: string[],
  specificConcerns?: string,
): SuggestedQuestion[] {
  if (!feedback) {
    return FALLBACK_QUESTIONS;
  }

  // Normalize to unified format so this works with both v1/v2 and v3.0 responses
  const normalized = normalizeFeedback(feedback);

  const questions: SuggestedQuestion[] = [];
  const usedCategories = new Set<QuestionCategory>();

  // Helper to add question with category deduplication
  const addQuestion = (text: string) => {
    if (questions.length >= 4) return;
    const category = detectCategory(text);
    if (!usedCategories.has(category)) {
      questions.push({ text, category });
      usedCategories.add(category);
    }
  };

  // Priority 1: couldImprove items (most actionable — maps from consider+quickFixes in v1/v2,
  //             or couldImprove directly in v3.0)
  if (normalized.couldImprove.length > 0) {
    normalized.couldImprove.slice(0, 2).forEach(item => {
      // Extract a short label from the bullet string for a natural-sounding question
      const label = item.split(' — ')[0].toLowerCase();
      addQuestion(`How can I improve my ${label}?`);
    });
  }

  // Priority 2: takeItFurther items (v3.0 only — filler for styling questions)
  if (normalized.takeItFurther.length > 0 && questions.length < 4) {
    normalized.takeItFurther.slice(0, 2).forEach(item => {
      addQuestion(`Tell me more: ${item}`);
    });
  }

  // Priority 3: Occasions (if not already covered)
  if (occasions && occasions.length > 0 && questions.length < 4) {
    const occasion = occasions[0];
    addQuestion(`How can I better suit this for ${occasion}?`);
  }

  // Priority 4: Specific concerns (user's original worry)
  if (specificConcerns && questions.length < 4) {
    addQuestion(`More about my concern: ${specificConcerns}`);
  }

  // Priority 5: whatsRight items (filler if < 3 questions)
  if (normalized.whatsRight.length > 0 && questions.length < 3) {
    normalized.whatsRight.slice(0, 1).forEach(item => {
      const label = item.split(' — ')[0].toLowerCase();
      addQuestion(`How can I build on my ${label}?`);
    });
  }

  // Fallback: If still < 2 questions, add from fallback list
  if (questions.length < 2) {
    FALLBACK_QUESTIONS.forEach(q => {
      if (questions.length < 4 && !usedCategories.has(q.category)) {
        questions.push(q);
        usedCategories.add(q.category);
      }
    });
  }

  return questions;
}

export default function FollowUpModal({
  visible,
  onClose,
  feedbackSummary,
  outfitId,
  maxFollowUps = 3,
  feedback,
  occasions,
  specificConcerns,
  existingFollowUps,
}: FollowUpModalProps) {
  const router = useRouter();
  const [question, setQuestion] = useState('');
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);

  // Generate suggested questions based on feedback data
  const suggestedQuestions = useMemo(
    () => generateSuggestedQuestions(feedback, occasions, specificConcerns),
    [feedback, occasions, specificConcerns]
  );

  // Use real API if outfitId is provided
  const followUpMutation = useSubmitFollowUp(outfitId || '');
  const isLoading = followUpMutation.isPending;

  const remainingFollowUps = maxFollowUps - followUps.length;
  const canAskMore = remainingFollowUps > 0;

  useEffect(() => {
    if (visible) {
      // Reset question input
      setQuestion('');

      // Initialize from existing follow-ups if available
      if (existingFollowUps && existingFollowUps.length > 0) {
        const previousFollowUps = existingFollowUps
          .filter(f => f.aiResponse) // Only include completed follow-ups
          .map(f => ({
            question: f.userQuestion,
            answer: f.aiResponse!,
          }));
        setFollowUps(previousFollowUps);
      } else {
        setFollowUps([]);
      }
    }
  }, [visible, existingFollowUps]);

  const handleSubmit = async () => {
    if (!question.trim() || isLoading || !canAskMore) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const userQuestion = question.trim();
    setQuestion('');

    try {
      const response = await followUpMutation.mutateAsync(userQuestion);
      const answer = response.answer;

      setFollowUps(prev => [...prev, { question: userQuestion, answer }]);

      // Scroll to bottom
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Follow-up failed:', error);
      Alert.alert('Error', 'Failed to get response. Please try again.');
      // Re-add the question so user can retry
      setQuestion(userQuestion);
    }
  };

  const handleSuggestedQuestion = (suggested: string) => {
    setQuestion(suggested);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Follow Up</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {/* Context */}
          <View style={styles.contextSection}>
            <Text style={styles.contextLabel}>Original feedback</Text>
            <Text style={styles.contextText} numberOfLines={2}>
              {feedbackSummary}
            </Text>
          </View>

          {/* Conversation */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.conversationSection}
            contentContainerStyle={styles.conversationContent}
            showsVerticalScrollIndicator={false}
          >
            {followUps.length === 0 && !isLoading && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Ask your stylist anything</Text>
                <Text style={styles.emptySubtitle}>
                  Styling tips, accessory suggestions, outfit adjustments — no question is too small.
                </Text>
              </View>
            )}

            {followUps.map((item, index) => (
              <View key={index} style={styles.conversationPair}>
                {/* User question */}
                <View style={styles.userBubble}>
                  <Text style={styles.userText}>{item.question}</Text>
                </View>

                {/* AI answer */}
                <View style={styles.aiBubble}>
                  <View style={styles.aiIcon}>
                    <Ionicons name="sparkles" size={16} color={Colors.primary} />
                  </View>
                  <View style={styles.aiContent}>
                    <Markdown style={markdownStyles}>{item.answer}</Markdown>
                  </View>
                </View>
              </View>
            ))}

            {isLoading && (
              <View style={styles.loadingBubble}>
                <View style={styles.aiIcon}>
                  <Ionicons name="sparkles" size={16} color={Colors.primary} />
                </View>
                <View style={styles.typingIndicator}>
                  <View style={styles.typingDot} />
                  <View style={[styles.typingDot, styles.typingDotDelay1]} />
                  <View style={[styles.typingDot, styles.typingDotDelay2]} />
                </View>
              </View>
            )}
          </ScrollView>

          {/* Suggested questions */}
          {followUps.length === 0 && !isLoading && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestions}
            >
              {suggestedQuestions.map((suggested, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.suggestionChip}
                  onPress={() => handleSuggestedQuestion(suggested.text)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={CATEGORY_ICONS[suggested.category]}
                    size={14}
                    color={Colors.primary}
                    style={styles.suggestionIcon}
                  />
                  <Text style={styles.suggestionText}>
                    {suggested.text}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Input area */}
          <View style={styles.inputSection}>
            {!canAskMore && (
              <TouchableOpacity
                style={styles.limitReached}
                onPress={() => {
                  onClose();
                  router.push('/upgrade' as any);
                }}
              >
                <Ionicons name="lock-closed" size={16} color={Colors.warning} style={{ marginRight: 8 }} />
                <Text style={styles.limitText}>
                  Follow-up limit reached. Tap to upgrade for more questions!
                </Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.warning} />
              </TouchableOpacity>
            )}

            {canAskMore && (
              <>
                <View style={styles.remainingCount}>
                  <Text style={styles.remainingText}>
                    {remainingFollowUps} question{remainingFollowUps !== 1 ? 's' : ''} remaining
                  </Text>
                </View>

                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Ask a follow-up question..."
                    placeholderTextColor={Colors.textMuted}
                    value={question}
                    onChangeText={setQuestion}
                    multiline
                    maxLength={200}
                    editable={!isLoading}
                    fontFamily={Fonts.sans}
                  />
                  <TouchableOpacity
                    style={[
                      styles.sendButton,
                      (!question.trim() || isLoading) && styles.sendButtonDisabled,
                    ]}
                    onPress={handleSubmit}
                    disabled={!question.trim() || isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color={Colors.white} />
                    ) : (
                      <Ionicons name="arrow-up" size={18} color={Colors.white} />
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardView: {
    flex: 1,
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
    fontFamily: Fonts.serif,
    fontSize: FontSize.lg,
    color: Colors.text,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contextSection: {
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  contextLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 2.2,
    color: Colors.textMuted,
    marginBottom: 6,
  },
  contextText: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.sm,
    color: Colors.text,
    lineHeight: 20,
  },
  conversationSection: {
    flex: 1,
  },
  conversationContent: {
    padding: Spacing.md,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    minHeight: 300,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  emptyTitle: {
    fontFamily: Fonts.serif,
    fontSize: FontSize.xl,
    color: Colors.text,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  conversationPair: {
    marginBottom: Spacing.lg,
  },
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '80%',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  userText: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.md,
    color: Colors.white,
    lineHeight: 20,
  },
  aiBubble: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    maxWidth: '85%',
    marginTop: Spacing.sm,
  },
  aiIcon: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryAlpha10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
    flexShrink: 0,
  },
  aiContent: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  aiText: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.md,
    color: Colors.text,
    lineHeight: 20,
  },
  loadingBubble: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    marginTop: Spacing.sm,
  },
  typingIndicator: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.textMuted,
    opacity: 0.4,
    marginRight: 6,
  },
  typingDotDelay1: {
    opacity: 0.6,
  },
  typingDotDelay2: {
    opacity: 0.8,
  },
  suggestions: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.sharp,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    maxWidth: 260,
  },
  suggestionIcon: {
    marginRight: 8,
  },
  suggestionText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: Colors.text,
    flexShrink: 1,
  },
  inputSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  limitReached: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.warningAlpha10,
  },
  limitText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.warning,
    fontWeight: '500',
  },
  remainingCount: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  remainingText: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: Spacing.md,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sharp,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.md,
    color: Colors.text,
    maxHeight: 100,
    marginRight: Spacing.sm,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sharp,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});

const markdownStyles = {
  body: {
    fontSize: FontSize.md,
    color: Colors.text,
    lineHeight: 20,
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 8,
  },
  strong: {
    fontWeight: '700' as const,
    color: Colors.text,
  },
  em: {
    fontStyle: 'italic' as const,
  },
  bullet_list: {
    marginBottom: 8,
  },
  bullet_list_icon: {
    color: Colors.text,
    fontSize: FontSize.md,
  },
  bullet_list_content: {
    color: Colors.text,
  },
  ordered_list: {
    marginBottom: 8,
  },
  code_inline: {
    backgroundColor: Colors.background,
    color: Colors.primary,
    borderRadius: 4,
    paddingHorizontal: 4,
    fontFamily: (Platform.OS === 'ios' ? 'Menlo' : 'monospace') as any,
  },
};
