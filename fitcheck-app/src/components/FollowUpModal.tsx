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
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Markdown from 'react-native-markdown-display';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, FontSize, BorderRadius } from '../constants/theme';
import { useSubmitFollowUp } from '../hooks/useApi';
import { OutfitFeedback } from '../services/api.service';

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

// Unsplash images for each category (400x300, fit=crop)
const CATEGORY_IMAGES: Record<QuestionCategory, string> = {
  shoes: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&h=300&fit=crop',
  accessories: 'https://images.unsplash.com/photo-1492707892479-7bc8d5a4ee93?w=400&h=300&fit=crop',
  color: 'https://images.unsplash.com/photo-1558769132-cb1aea17c9f8?w=400&h=300&fit=crop',
  fit: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400&h=300&fit=crop',
  occasion: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=400&h=300&fit=crop',
  layering: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&h=300&fit=crop',
  casual: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=400&h=300&fit=crop',
  formal: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=400&h=300&fit=crop',
  styling: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=400&h=300&fit=crop',
  general: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=400&h=300&fit=crop',
};

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

// Semi-transparent gradients (0.65 opacity to see image through)
const CATEGORY_GRADIENTS: Record<QuestionCategory, readonly [string, string]> = {
  shoes: ['rgba(139, 92, 246, 0.65)', 'rgba(99, 102, 241, 0.65)'] as const,
  accessories: ['rgba(245, 158, 11, 0.65)', 'rgba(249, 115, 22, 0.65)'] as const,
  color: ['rgba(236, 72, 153, 0.65)', 'rgba(244, 63, 94, 0.65)'] as const,
  fit: ['rgba(59, 130, 246, 0.65)', 'rgba(139, 92, 246, 0.65)'] as const,
  occasion: ['rgba(168, 85, 247, 0.65)', 'rgba(192, 132, 252, 0.65)'] as const,
  layering: ['rgba(20, 184, 166, 0.65)', 'rgba(6, 182, 212, 0.65)'] as const,
  casual: ['rgba(251, 146, 60, 0.65)', 'rgba(251, 191, 36, 0.65)'] as const,
  formal: ['rgba(79, 70, 229, 0.65)', 'rgba(99, 102, 241, 0.65)'] as const,
  styling: ['rgba(236, 72, 153, 0.65)', 'rgba(168, 85, 247, 0.65)'] as const,
  general: ['rgba(100, 116, 139, 0.65)', 'rgba(148, 163, 184, 0.65)'] as const,
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

// Generate suggested questions from feedback data
function generateSuggestedQuestions(
  feedback?: OutfitFeedback,
  occasions?: string[],
  specificConcerns?: string,
): SuggestedQuestion[] {
  if (!feedback) {
    return FALLBACK_QUESTIONS;
  }

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

  // Priority 1: Consider items (most actionable)
  if (feedback.consider && feedback.consider.length > 0) {
    feedback.consider.slice(0, 2).forEach(item => {
      addQuestion(`How can I improve my ${item.point.toLowerCase()}?`);
    });
  }

  // Priority 2: Quick fixes (specific tips)
  if (feedback.quickFixes && feedback.quickFixes.length > 0 && questions.length < 4) {
    feedback.quickFixes.slice(0, 2).forEach(fix => {
      addQuestion(`Tell me more about: ${fix.suggestion}`);
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

  // Priority 5: What's working (filler if < 3 questions)
  if (feedback.whatsWorking && feedback.whatsWorking.length > 0 && questions.length < 3) {
    feedback.whatsWorking.slice(0, 1).forEach(item => {
      addQuestion(`How can I build on my ${item.point.toLowerCase()}?`);
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
            <View style={styles.headerLeft}>
              <Ionicons name="chatbubbles" size={24} color={Colors.primary} />
              <Text style={styles.headerTitle}>Follow-up Questions</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {/* Context */}
          <View style={styles.contextSection}>
            <Text style={styles.contextLabel}>Original feedback:</Text>
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
                <Ionicons name="help-circle-outline" size={48} color={Colors.primary} />
                <Text style={styles.emptyTitle}>Ask me anything!</Text>
                <Text style={styles.emptySubtitle}>
                  I can help with styling tips, accessory suggestions, or outfit adjustments.
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
                <ImageBackground
                  key={index}
                  source={{ uri: CATEGORY_IMAGES[suggested.category] }}
                  style={styles.suggestionChipContainer}
                  imageStyle={styles.suggestionChipImage}
                >
                  <TouchableOpacity
                    style={styles.suggestionChip}
                    onPress={() => handleSuggestedQuestion(suggested.text)}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={CATEGORY_GRADIENTS[suggested.category]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.suggestionChipOverlay}
                    >
                      <View style={styles.suggestionIcon}>
                        <Ionicons
                          name={CATEGORY_ICONS[suggested.category]}
                          size={20}
                          color={Colors.white}
                        />
                      </View>
                      <Text style={styles.suggestionText}>
                        {suggested.text}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </ImageBackground>
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
                      <Ionicons name="send" size={20} color={Colors.white} />
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    marginLeft: Spacing.sm,
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
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  contextText: {
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
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    fontSize: FontSize.md,
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
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  userText: {
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
    width: 32,
    height: 32,
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
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  aiText: {
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
    borderRadius: BorderRadius.lg,
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
    paddingVertical: Spacing.md,
  },
  suggestionChipContainer: {
    marginRight: Spacing.md,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  suggestionChipImage: {
    borderRadius: 28,
  },
  suggestionChip: {
    width: 280,
  },
  suggestionChipOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 16,
    paddingVertical: 12,
    minHeight: 64,
  },
  suggestionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    flexShrink: 0,
  },
  suggestionText: {
    fontSize: FontSize.md,
    color: Colors.white,
    fontWeight: '700',
    flex: 1,
    flexShrink: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
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
    borderRadius: BorderRadius.lg,
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
    borderRadius: BorderRadius.full,
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
