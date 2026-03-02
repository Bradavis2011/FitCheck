import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Linking, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Application from 'expo-application';
import { Colors, Spacing, FontSize, BorderRadius, Fonts } from '../src/constants/theme';
import { useAskSupport } from '../src/hooks/useApi';

export default function HelpScreen() {
  const router = useRouter();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [question, setQuestion] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [wasEscalated, setWasEscalated] = useState(false);
  const askSupport = useAskSupport();

  const faqs = [
    {
      question: 'How do outfit checks work?',
      answer:
        'Take a photo of your outfit, add context (occasion, weather, etc.), and our AI analyzes your look in seconds. You\'ll get a score, detailed feedback, and personalized suggestions.',
    },
    {
      question: 'How many outfit checks do I get?',
      answer:
        'Free users get 3 outfit checks per day. Each check also includes up to 3 follow-up questions. Upgrade to Plus for unlimited checks and follow-ups.',
    },
    {
      question: 'What happens to my photos?',
      answer:
        'Your photos are stored securely and encrypted. They\'re only used to provide you with feedback and are never shared publicly or with third parties without your permission.',
    },
    {
      question: 'How do I build a streak?',
      answer:
        'Check an outfit every day to build your streak! The longer your streak, the more bonus points you earn. Points unlock achievements and help you level up.',
    },
  ];

  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  const handleAskSupport = async () => {
    if (!question.trim() || askSupport.isPending) return;
    try {
      const result = await askSupport.mutateAsync(question.trim());
      setAiResponse(result.response);
      setWasEscalated(result.escalated);
      setQuestion('');
    } catch {
      setAiResponse("Sorry, something went wrong. Please try emailing us at support@orthis.app.");
      setWasEscalated(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* FAQ Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>

          {faqs.map((faq, index) => (
            <View key={index} style={styles.faqCard}>
              <TouchableOpacity
                style={styles.faqHeader}
                onPress={() => toggleFaq(index)}
                activeOpacity={0.7}
              >
                <Text style={styles.faqQuestion}>{faq.question}</Text>
                <Ionicons
                  name={expandedFaq === index ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={Colors.textMuted}
                />
              </TouchableOpacity>
              {expandedFaq === index && (
                <View style={styles.faqAnswer}>
                  <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Support Bot Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ask Support</Text>
          <Text style={styles.sectionText}>
            Ask a question and get an instant answer.
          </Text>

          {aiResponse && (
            <View style={[styles.responseCard, wasEscalated && styles.responseCardEscalated]}>
              <Text style={styles.responseText}>{aiResponse}</Text>
              {wasEscalated && (
                <Text style={styles.escalatedNote}>Your question has been flagged for human review — we'll follow up by email.</Text>
              )}
              <TouchableOpacity onPress={() => { setAiResponse(null); setWasEscalated(false); }}>
                <Text style={styles.clearResponse}>Ask another question</Text>
              </TouchableOpacity>
            </View>
          )}

          {!aiResponse && (
            <View style={styles.chatInputRow}>
              <TextInput
                style={styles.chatInput}
                value={question}
                onChangeText={setQuestion}
                placeholder="What do you need help with?"
                placeholderTextColor={Colors.textMuted}
                multiline
                maxLength={1000}
                returnKeyType="send"
                onSubmitEditing={handleAskSupport}
              />
              <TouchableOpacity
                style={[styles.chatSendButton, (!question.trim() || askSupport.isPending) && styles.chatSendButtonDisabled]}
                onPress={handleAskSupport}
                activeOpacity={0.7}
                disabled={!question.trim() || askSupport.isPending}
              >
                {askSupport.isPending
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <Ionicons name="arrow-up" size={20} color={Colors.white} />
                }
              </TouchableOpacity>
            </View>
          )}

          {/* Email fallback */}
          <TouchableOpacity
            style={styles.contactButton}
            onPress={() => Linking.openURL('mailto:support@orthis.app?subject=Or This? Support Request')}
          >
            <View style={styles.contactButtonLeft}>
              <Ionicons name="mail-outline" size={24} color={Colors.primary} />
              <View>
                <Text style={styles.contactButtonTitle}>Email Support</Text>
                <Text style={styles.contactButtonSubtitle}>support@orthis.app</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* App Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Version</Text>
              <Text style={styles.infoValue}>{Application.nativeApplicationVersion || '1.0.0'}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Build</Text>
              <Text style={styles.infoValue}>{Application.nativeBuildVersion || '1'}</Text>
            </View>
          </View>
        </View>

        {/* Resources Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>More Resources</Text>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => Linking.openURL('https://orthis.app/terms')}
          >
            <Text style={styles.linkButtonText}>Terms of Service</Text>
            <Ionicons name="open-outline" size={16} color={Colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => Linking.openURL('https://orthis.app/privacy')}
          >
            <Text style={styles.linkButtonText}>Privacy Policy</Text>
            <Ionicons name="open-outline" size={16} color={Colors.primary} />
          </TouchableOpacity>
        </View>
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
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: Fonts.serif,
    fontSize: FontSize.lg,
    color: Colors.text,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 2.2,
    marginBottom: Spacing.md,
  },
  sectionText: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  faqCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sharp,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  faqQuestion: {
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.md,
    color: Colors.text,
    flex: 1,
    marginRight: Spacing.sm,
  },
  faqAnswer: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
  },
  faqAnswerText: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  chatInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sharp,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontFamily: Fonts.sans,
    fontSize: FontSize.md,
    color: Colors.text,
    maxHeight: 100,
  },
  chatSendButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sharp,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatSendButtonDisabled: {
    backgroundColor: Colors.textMuted,
  },
  responseCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sharp,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  responseCardEscalated: {
    borderColor: Colors.warning,
  },
  responseText: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.md,
    color: Colors.text,
    lineHeight: 22,
    marginBottom: Spacing.sm,
  },
  escalatedNote: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.sm,
    color: Colors.warning,
    marginBottom: Spacing.sm,
    lineHeight: 18,
  },
  clearResponse: {
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.sm,
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sharp,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  contactButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  contactButtonTitle: {
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.md,
    color: Colors.text,
    marginBottom: 2,
  },
  contactButtonSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sharp,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  infoLabel: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  infoValue: {
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.xs,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: 1,
  },
  linkButtonText: {
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.sm,
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    flex: 1,
  },
});
