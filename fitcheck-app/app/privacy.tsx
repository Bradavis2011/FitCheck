import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius, Fonts } from '../src/constants/theme';

export default function PrivacyScreen() {
  const router = useRouter();

  const handleDeleteData = () => {
    Alert.alert(
      'Delete My Data',
      'To request deletion of your data, please email support@orthis.app. We will process your request within 30 days.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Email Support',
          onPress: () => {
            Linking.openURL('mailto:support@orthis.app?subject=Data Deletion Request');
          },
        },
      ]
    );
  };

  const handleExportData = () => {
    Alert.alert(
      'Export My Data',
      'To request an export of your data, please email support@orthis.app. We will send you a complete archive within 30 days.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Email Support',
          onPress: () => {
            Linking.openURL('mailto:support@orthis.app?subject=Data Export Request');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy & Data</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Your Data Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Data</Text>
          <Text style={styles.sectionText}>
            Or This? stores the following information to provide you with personalized outfit feedback:
          </Text>
          <View style={styles.list}>
            <Text style={styles.listItem}>• Outfit photos and context you provide</Text>
            <Text style={styles.listItem}>• AI-generated feedback and scores</Text>
            <Text style={styles.listItem}>• Style preferences and settings</Text>
            <Text style={styles.listItem}>• Usage statistics and streaks</Text>
            <Text style={styles.listItem}>• Account information (email, name)</Text>
          </View>
          <Text style={styles.sectionText}>
            Your photos are stored securely and are never shared with third parties without your explicit consent. We use industry-standard encryption to protect your data.
          </Text>
        </View>

        {/* Data Management Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Management</Text>

          <TouchableOpacity style={styles.actionButton} onPress={handleExportData}>
            <View style={styles.actionButtonLeft}>
              <Ionicons name="download-outline" size={24} color={Colors.primary} />
              <View style={styles.actionButtonText}>
                <Text style={styles.actionButtonTitle}>Export My Data</Text>
                <Text style={styles.actionButtonSubtitle}>Download all your Or This? data</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleDeleteData}>
            <View style={styles.actionButtonLeft}>
              <Ionicons name="trash-outline" size={24} color={Colors.error} />
              <View style={styles.actionButtonText}>
                <Text style={[styles.actionButtonTitle, { color: Colors.error }]}>Delete My Data</Text>
                <Text style={styles.actionButtonSubtitle}>Permanently remove all your data</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Privacy Policy Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy Policy</Text>
          <Text style={styles.sectionText}>
            For full details on how we collect, use, and protect your information, please review our Privacy Policy.
          </Text>
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => Linking.openURL('https://orthis.app/privacy')}
          >
            <Text style={styles.linkButtonText}>View Privacy Policy</Text>
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
  list: {
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  listItem: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sharp,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  actionButtonText: {
    flex: 1,
  },
  actionButtonTitle: {
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.md,
    color: Colors.text,
    marginBottom: 2,
  },
  actionButtonSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
  },
  linkButtonText: {
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.sm,
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
