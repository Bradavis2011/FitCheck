import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@clerk/clerk-expo';
import { useQueryClient } from '@tanstack/react-query';
import { Colors, Spacing, FontSize, BorderRadius, Fonts } from '../src/constants/theme';
import { logOutPurchases } from '../src/services/purchases.service';
import { useUpdateProfile, useUser } from '../src/hooks/useApi';
import { userService } from '../src/services/api.service';
import { useAuthStore } from '../src/stores/authStore';
import { useSubscriptionStore } from '../src/stores/subscriptionStore';

type VisibilityOption = 'all' | 'followers' | 'trusted';
type AutoDeleteOption = 'never' | '24h' | '7d' | '30d';

interface PrivacySettings {
  blurFaceDefault: boolean;
  visibility: VisibilityOption;
  autoDelete: AutoDeleteOption;
}

export default function PrivacySettingsScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const { data: user, isLoading } = useUser();
  const updateProfileMutation = useUpdateProfile();

  const currentSettings: PrivacySettings = user?.privacySettings || {
    blurFaceDefault: true,
    visibility: 'all',
    autoDelete: 'never',
  };

  const [settings, setSettings] = useState<PrivacySettings>(currentSettings);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      await updateProfileMutation.mutateAsync({
        privacySettings: settings,
      });

      Alert.alert('Settings Saved', 'Your privacy settings have been updated.');
      router.back();
    } catch (error) {
      console.error('Failed to save privacy settings:', error);
      Alert.alert('Error', 'Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearHistory = () => {
    Alert.alert(
      'Clear Outfit History',
      'Are you sure you want to delete all your outfit checks? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await userService.clearHistory();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Done', `Cleared ${result.deletedCount} outfit ${result.deletedCount === 1 ? 'check' : 'checks'}.`);
            } catch (error) {
              Alert.alert('Error', 'Failed to clear history. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your account? All your data will be lost forever.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Final Confirmation',
              'This action is permanent and cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete Forever',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await userService.deleteAccount();
                      await signOut();
                      await logOutPurchases();
                      await clearAuth();
                      queryClient.clear();
                      useSubscriptionStore.setState({ tier: 'free', isLoaded: false, offerings: null, customerInfo: null, limits: null });
                      router.replace('/login' as any);
                    } catch (error) {
                      Alert.alert('Error', 'Failed to delete account. Please try again.');
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Privacy Settings</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Face Blur */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Face Visibility</Text>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Blur Face by Default</Text>
                <Text style={styles.settingDescription}>
                  Automatically blur your face in outfit photos shared to community
                </Text>
              </View>
              <Switch
                value={settings.blurFaceDefault}
                onValueChange={(value) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSettings({ ...settings, blurFaceDefault: value });
                }}
                trackColor={{ false: Colors.surfaceLight, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>
          </View>

          {/* Who Can See */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Who Can See Your Outfits</Text>
            <Text style={styles.sectionDescription}>
              Choose who can view your public outfits in the community feed
            </Text>

            <TouchableOpacity
              style={[
                styles.optionButton,
                settings.visibility === 'all' && styles.optionButtonActive,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSettings({ ...settings, visibility: 'all' });
              }}
            >
              <View style={styles.optionContent}>
                <Ionicons
                  name="globe-outline"
                  size={24}
                  color={settings.visibility === 'all' ? Colors.primary : Colors.textMuted}
                />
                <View style={styles.optionText}>
                  <Text
                    style={[
                      styles.optionLabel,
                      settings.visibility === 'all' && styles.optionLabelActive,
                    ]}
                  >
                    Everyone
                  </Text>
                  <Text style={styles.optionDescription}>
                    Anyone in the community can see and give feedback
                  </Text>
                </View>
              </View>
              {settings.visibility === 'all' && (
                <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.optionButton,
                settings.visibility === 'followers' && styles.optionButtonActive,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSettings({ ...settings, visibility: 'followers' });
              }}
            >
              <View style={styles.optionContent}>
                <Ionicons
                  name="people-outline"
                  size={24}
                  color={settings.visibility === 'followers' ? Colors.primary : Colors.textMuted}
                />
                <View style={styles.optionText}>
                  <Text
                    style={[
                      styles.optionLabel,
                      settings.visibility === 'followers' && styles.optionLabelActive,
                    ]}
                  >
                    Followers Only
                  </Text>
                  <Text style={styles.optionDescription}>
                    Only people who follow you can see and give feedback
                  </Text>
                </View>
              </View>
              {settings.visibility === 'followers' && (
                <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.optionButton,
                settings.visibility === 'trusted' && styles.optionButtonActive,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSettings({ ...settings, visibility: 'trusted' });
              }}
            >
              <View style={styles.optionContent}>
                <Ionicons
                  name="star-outline"
                  size={24}
                  color={settings.visibility === 'trusted' ? Colors.primary : Colors.textMuted}
                />
                <View style={styles.optionText}>
                  <Text
                    style={[
                      styles.optionLabel,
                      settings.visibility === 'trusted' && styles.optionLabelActive,
                    ]}
                  >
                    Trusted Reviewers
                  </Text>
                  <Text style={styles.optionDescription}>
                    Only high-quality reviewers with good ratings
                  </Text>
                </View>
              </View>
              {settings.visibility === 'trusted' && (
                <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
              )}
            </TouchableOpacity>
          </View>

          {/* Auto-Delete */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Auto-Delete Outfits</Text>
            <Text style={styles.sectionDescription}>
              Automatically delete outfit photos after a set time
            </Text>

            {([
              { value: 'never', label: 'Never', icon: 'infinite-outline', desc: 'Keep forever' },
              { value: '24h', label: '24 Hours', icon: 'time-outline', desc: 'Delete after 1 day' },
              { value: '7d', label: '7 Days', icon: 'calendar-outline', desc: 'Delete after 1 week' },
              { value: '30d', label: '30 Days', icon: 'calendar-outline', desc: 'Delete after 1 month' },
            ] as const).map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionButton,
                  settings.autoDelete === option.value && styles.optionButtonActive,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSettings({ ...settings, autoDelete: option.value });
                }}
              >
                <View style={styles.optionContent}>
                  <Ionicons
                    name={option.icon}
                    size={24}
                    color={
                      settings.autoDelete === option.value ? Colors.primary : Colors.textMuted
                    }
                  />
                  <View style={styles.optionText}>
                    <Text
                      style={[
                        styles.optionLabel,
                        settings.autoDelete === option.value && styles.optionLabelActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                    <Text style={styles.optionDescription}>{option.desc}</Text>
                  </View>
                </View>
                {settings.autoDelete === option.value && (
                  <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Data Management */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Data Management</Text>

            <TouchableOpacity style={styles.dangerButton} onPress={handleClearHistory}>
              <Ionicons name="trash-outline" size={20} color={Colors.error} />
              <Text style={styles.dangerButtonText}>Clear Outfit History</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.dangerButton} onPress={handleDeleteAccount}>
              <Ionicons name="warning-outline" size={20} color={Colors.error} />
              <Text style={styles.dangerButtonText}>Delete Account</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Save Button */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={24} color={Colors.white} />
                <Text style={styles.saveButtonText}>Save Settings</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  safeArea: {
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
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.sansBold,
    color: Colors.text,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.sansBold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  sectionDescription: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  settingInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  settingLabel: {
    fontSize: FontSize.md,
    fontFamily: Fonts.sansSemiBold,
    color: Colors.text,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  optionButtonActive: {
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}10`,
  },
  optionContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    fontSize: FontSize.md,
    fontFamily: Fonts.sansSemiBold,
    color: Colors.text,
    marginBottom: 2,
  },
  optionLabelActive: {
    color: Colors.primary,
  },
  optionDescription: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.error,
    marginBottom: Spacing.sm,
  },
  dangerButtonText: {
    fontSize: FontSize.md,
    fontFamily: Fonts.sansSemiBold,
    color: Colors.error,
  },
  bottomBar: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 16,
    backgroundColor: Colors.primary,
    borderRadius: 0,
  },
  saveButtonDisabled: {
    backgroundColor: Colors.surfaceLight,
  },
  saveButtonText: {
    fontSize: FontSize.md,
    fontFamily: Fonts.sansBold,
    color: Colors.white,
  },
});
