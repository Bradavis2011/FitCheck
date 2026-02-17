import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as SecureStore from 'expo-secure-store';
import { Colors, Spacing, FontSize, BorderRadius } from '../../src/constants/theme';
import { useAuthStore } from '../../src/stores/authStore';
import { useSubscriptionStore } from '../../src/stores/subscriptionStore';
import { useUserStats, useUser, useUpdateProfile } from '../../src/hooks/useApi';
import PillButton from '../../src/components/PillButton';
import { styles as styleOptions } from '../../src/lib/mockData';

export default function ProfileScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const { tier } = useSubscriptionStore();
  const { data: stats } = useUserStats();
  const { data: userProfile } = useUser();
  // const { data: badgesData } = useBadges(); // Disabled - endpoint not implemented
  // const { data: dailyGoals } = useDailyGoals(); // Disabled - endpoint not implemented
  const updateProfile = useUpdateProfile();

  // Style preferences accordion
  const [showStyles, setShowStyles] = useState(false);
  const selectedStyles = (userProfile?.stylePreferences?.styles as string[]) || [];

  // App settings accordion
  const [showSettings, setShowSettings] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [faceBlur, setFaceBlur] = useState(false);

  // Edit Profile modal
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editIsPublic, setEditIsPublic] = useState(false);

  // Load settings from SecureStore on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const notificationsValue = await SecureStore.getItemAsync('notifications');
        const faceBlurValue = await SecureStore.getItemAsync('faceBlur');

        if (notificationsValue !== null) {
          setNotifications(notificationsValue === 'true');
        }
        if (faceBlurValue !== null) {
          setFaceBlur(faceBlurValue === 'true');
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };

    loadSettings();
  }, []);

  const toggleStyle = (style: string) => {
    const newStyles = selectedStyles.includes(style)
      ? selectedStyles.filter((s) => s !== style)
      : [...selectedStyles, style];

    console.log('[Profile] Updating style preferences:', newStyles);
    updateProfile.mutate(
      { stylePreferences: { styles: newStyles } },
      {
        onSuccess: () => console.log('[Profile] Style preferences updated successfully'),
        onError: (error) => console.error('[Profile] Failed to update style preferences:', error),
      }
    );
  };

  const toggleNotifications = async () => {
    const newValue = !notifications;
    setNotifications(newValue);
    try {
      await SecureStore.setItemAsync('notifications', String(newValue));
    } catch (error) {
      console.error('Failed to save notifications setting:', error);
    }
  };

  const toggleFaceBlur = async () => {
    const newValue = !faceBlur;
    setFaceBlur(newValue);
    try {
      await SecureStore.setItemAsync('faceBlur', String(newValue));
    } catch (error) {
      console.error('Failed to save face blur setting:', error);
    }
  };

  const handleResetOnboarding = async () => {
    await SecureStore.deleteItemAsync('orthis_onboarding_completed');
    Alert.alert('Onboarding Reset', 'Restart the app to see onboarding again.');
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => {
        try {
          // Clear all app state
          await clearAuth(); // Clear auth store
          queryClient.clear(); // Clear React Query cache (history, stats, etc.)
          useSubscriptionStore.setState({
            tier: 'free',
            isLoaded: false,
            offerings: null,
            customerInfo: null,
            limits: null
          }); // Reset subscription store
          await signOut(); // Sign out from Clerk
          router.replace('/login' as any);
        } catch (error) {
          console.error('Sign out failed:', error);
          Alert.alert('Error', 'Failed to sign out. Please try again.');
        }
      }},
    ]);
  };

  const handleOpenEditProfile = () => {
    setEditUsername(userProfile?.username || '');
    setEditBio(userProfile?.bio || '');
    setEditIsPublic(userProfile?.isPublic || false);
    setShowEditProfile(true);
  };

  const handleSaveProfile = async () => {
    // Validate username (alphanumeric + underscore, 3-20 chars)
    if (editUsername && !/^[a-zA-Z0-9_]{3,20}$/.test(editUsername)) {
      Alert.alert(
        'Invalid Username',
        'Username must be 3-20 characters and contain only letters, numbers, and underscores.'
      );
      return;
    }

    // Validate bio length
    if (editBio && editBio.length > 150) {
      Alert.alert('Bio Too Long', 'Bio must be 150 characters or less.');
      return;
    }

    try {
      await updateProfile.mutateAsync({
        username: editUsername || undefined,
        bio: editBio || undefined,
        isPublic: editIsPublic,
      } as any);

      setShowEditProfile(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error: any) {
      console.error('[Profile] Failed to update profile:', error);
      Alert.alert(
        'Error',
        error?.response?.data?.error || 'Failed to update profile. Please try again.'
      );
    }
  };

  // Helper to get user initials
  const getInitials = () => {
    const name = user?.name || user?.email?.split('@')[0] || 'User';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return parts[0][0] + parts[1][0];
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        {/* Profile Info */}
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials()}</Text>
          </View>
          <Text style={styles.name}>
            {user?.name || user?.email?.split('@')[0] || 'User'}
          </Text>
          {userProfile?.username && (
            <Text style={styles.username}>@{userProfile.username}</Text>
          )}
          <Text style={styles.email}>
            {user?.email || ''}
          </Text>
          <View style={[
            styles.tierBadge,
            tier === 'plus' && { backgroundColor: Colors.primaryAlpha10 },
            tier === 'pro' && { backgroundColor: 'rgba(236, 72, 153, 0.1)' },
          ]}>
            <Text style={[
              styles.tierText,
              tier !== 'free' && { color: tier === 'plus' ? Colors.primary : Colors.secondary },
            ]}>
              {tier.charAt(0).toUpperCase() + tier.slice(1)}
            </Text>
          </View>
        </View>

        {/* Gamification Card */}
        <View style={styles.gamificationCard}>
          {/* Level & XP Section */}
          <LinearGradient
            colors={[Colors.primary, Colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.levelSection}
          >
            <View style={styles.levelHeader}>
              <View>
                <Text style={styles.levelBadge}>Level {stats?.level || 1}</Text>
                <Text style={styles.levelName}>
                  {stats?.level === 1 ? 'Style Newbie' :
                   stats?.level === 2 ? 'Fashion Friend' :
                   stats?.level === 3 ? 'Style Advisor' :
                   stats?.level === 4 ? 'Outfit Expert' :
                   stats?.level === 5 ? 'Trusted Reviewer' :
                   stats?.level === 6 ? 'Style Guru' :
                   stats?.level === 7 ? 'Fashion Icon' :
                   stats?.level === 8 ? 'Legend' : 'Style Enthusiast'}
                </Text>
              </View>
              <Text style={styles.pointsTotal}>{(stats?.points || 0).toLocaleString()} pts</Text>
            </View>

            {/* XP Progress Bar */}
            <View style={styles.xpSection}>
              <View style={styles.xpBar}>
                <View
                  style={[
                    styles.xpFill,
                    {
                      width: `${stats?.xpToNextLevel
                        ? Math.min(100, ((stats?.points || 0) % (stats?.xpToNextLevel || 100)) / (stats?.xpToNextLevel || 100) * 100)
                        : 100}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.xpText}>
                {stats?.xpToNextLevel && stats.xpToNextLevel > 0
                  ? `${stats.xpToNextLevel} XP to Level ${(stats.level || 1) + 1}`
                  : 'Max Level!'}
              </Text>
            </View>
          </LinearGradient>

          {/* Daily Goals and Badges removed - endpoints not yet implemented */}

          {/* Leaderboard Link */}
          <TouchableOpacity
            style={styles.leaderboardLink}
            onPress={() => router.push('/leaderboard' as any)}
            activeOpacity={0.7}
          >
            <Ionicons name="trophy" size={20} color={Colors.warning} />
            <Text style={styles.leaderboardLinkText}>View Leaderboard</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Edit Profile */}
        <View style={styles.editProfileCard}>
          <TouchableOpacity
            style={styles.editProfileButton}
            onPress={handleOpenEditProfile}
            activeOpacity={0.7}
          >
            <View style={styles.editProfileIcon}>
              <Ionicons name="person-outline" size={20} color={Colors.primary} />
            </View>
            <View style={styles.editProfileText}>
              <Text style={styles.editProfileTitle}>Edit Public Profile</Text>
              <Text style={styles.editProfileDesc}>
                {userProfile?.username ? 'Update your username and bio' : 'Set up to share outfits'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
          {userProfile?.username && userProfile?.isPublic && (
            <>
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.editProfileButton}
                onPress={() => router.push(`/user/${userProfile.username}` as any)}
                activeOpacity={0.7}
              >
                <View style={styles.editProfileIcon}>
                  <Ionicons name="eye-outline" size={20} color={Colors.primary} />
                </View>
                <View style={styles.editProfileText}>
                  <Text style={styles.editProfileTitle}>View Public Profile</Text>
                  <Text style={styles.editProfileDesc}>
                    See your profile as others see it
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Style Preferences */}
        <View style={styles.editProfileCard}>
          <TouchableOpacity
            style={styles.editProfileButton}
            onPress={() => router.push('/style-preferences' as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.editProfileIcon, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
              <Ionicons name="color-palette-outline" size={20} color="#8B5CF6" />
            </View>
            <View style={styles.editProfileText}>
              <Text style={styles.editProfileTitle}>Style Preferences</Text>
              <Text style={styles.editProfileDesc}>
                {selectedStyles.length > 0
                  ? `${selectedStyles.slice(0, 2).join(', ')}${selectedStyles.length > 2 ? '...' : ''}`
                  : 'Personalize your AI feedback'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Style Profile - Analytics */}
        {stats?.totalOutfits && stats.totalOutfits >= 3 && (
          <View style={styles.editProfileCard}>
            <TouchableOpacity
              style={styles.editProfileButton}
              onPress={() => router.push('/style-profile' as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.editProfileIcon, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
                <Ionicons name="sparkles" size={20} color="#8B5CF6" />
              </View>
              <View style={styles.editProfileText}>
                <Text style={styles.editProfileTitle}>Your Style DNA</Text>
                <Text style={styles.editProfileDesc}>
                  View your personalized style insights
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {/* Wardrobe */}
        <View style={styles.editProfileCard}>
          <TouchableOpacity
            style={styles.editProfileButton}
            onPress={() => router.push('/wardrobe' as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.editProfileIcon, { backgroundColor: 'rgba(236, 72, 153, 0.1)' }]}>
              <Ionicons name="shirt" size={20} color="#EC4899" />
            </View>
            <View style={styles.editProfileText}>
              <Text style={styles.editProfileTitle}>My Wardrobe</Text>
              <Text style={styles.editProfileDesc}>
                Build outfits from your closet
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsCard}>
          <Text style={styles.statsHeader}>Your Stats</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{stats?.totalOutfits || 0}</Text>
              <Text style={styles.statLabel}>Checks</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{stats?.points || 0}</Text>
              <Text style={styles.statLabel}>Points</Text>
            </View>
            <View style={styles.stat}>
              <View style={styles.streakRow}>
                <Text style={styles.statNumber}>{stats?.currentStreak || 0}</Text>
                <Ionicons name="flame" size={16} color={Colors.warning} />
              </View>
              <Text style={styles.statLabel}>Streak</Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{stats?.totalFavorites || 0}</Text>
              <Text style={styles.statLabel}>Favorites</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>Lv {stats?.level || 1}</Text>
              <Text style={styles.statLabel}>Level</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{stats?.longestStreak || 0}</Text>
              <Text style={styles.statLabel}>Best Streak</Text>
            </View>
          </View>
        </View>

        {/* Upgrade (only for free tier) */}
        {tier === 'free' && (
          <TouchableOpacity onPress={() => router.push('/upgrade' as any)}>
            <LinearGradient
              colors={[Colors.primary, Colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.upgradeCard}
            >
              <Text style={styles.upgradeTitle}>Upgrade to Plus</Text>
              <Text style={styles.upgradeDesc}>Unlimited checks, full history, and more</Text>
              <View style={styles.upgradeButton}>
                <Text style={styles.upgradeButtonText}>See Plans</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Style Preferences Card */}
        <View style={styles.settingsCard}>
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => setShowStyles(!showStyles)}
            activeOpacity={0.7}
          >
            <View style={styles.accordionHeaderLeft}>
              <Text style={styles.accordionTitle}>Style Preferences</Text>
              {selectedStyles.length > 0 && (
                <Text style={styles.accordionSubtitle}>{selectedStyles.length} selected</Text>
              )}
            </View>
            <Ionicons
              name={showStyles ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={Colors.textMuted}
            />
          </TouchableOpacity>
          {showStyles && (
            <View style={styles.accordionContent}>
              <View style={styles.pillsContainer}>
                {styleOptions.map((style) => (
                  <PillButton
                    key={style}
                    label={style}
                    selected={selectedStyles.includes(style)}
                    onPress={() => toggleStyle(style)}
                    small
                  />
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Privacy & Settings */}
        <View style={styles.settingsCard}>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push('/privacy-settings' as any)}
            activeOpacity={0.7}
          >
            <View style={styles.settingIconContainer}>
              <Ionicons name="shield-checkmark" size={22} color={Colors.primary} />
            </View>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>Privacy & Security</Text>
              <Text style={styles.settingDescription}>Face blur, visibility, auto-delete</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* App Settings Card */}
        <View style={styles.settingsCard}>
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => setShowSettings(!showSettings)}
            activeOpacity={0.7}
          >
            <Text style={styles.accordionTitle}>App Settings</Text>
            <Ionicons
              name={showSettings ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={Colors.textMuted}
            />
          </TouchableOpacity>
          {showSettings && (
            <View style={styles.accordionContent}>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Notifications</Text>
                <TouchableOpacity
                  style={[styles.customToggle, notifications && styles.customToggleActive]}
                  onPress={toggleNotifications}
                  activeOpacity={0.8}
                >
                  <View style={[styles.customToggleThumb, notifications && styles.customToggleThumbActive]} />
                </TouchableOpacity>
              </View>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Face blur default</Text>
                <TouchableOpacity
                  style={[styles.customToggle, faceBlur && styles.customToggleActive]}
                  onPress={toggleFaceBlur}
                  activeOpacity={0.8}
                >
                  <View style={[styles.customToggleThumb, faceBlur && styles.customToggleThumbActive]} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Account Links Card */}
        <View style={styles.settingsCard}>
          <TouchableOpacity style={styles.settingsRow} onPress={() => router.push('/privacy' as any)}>
            <Text style={styles.settingsText}>Privacy & Data</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.settingsRow} onPress={() => router.push('/help' as any)}>
            <Text style={styles.settingsText}>Help & Support</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.settingsRow} onPress={handleResetOnboarding}>
            <Text style={[styles.settingsText, { color: Colors.warning }]}>🧪 Reset Onboarding (Test)</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.settingsRow} onPress={handleSignOut}>
            <Text style={[styles.settingsText, { color: Colors.error }]}>Log Out</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>Or This? v1.0.0</Text>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditProfile}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditProfile(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowEditProfile(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TouchableOpacity onPress={handleSaveProfile}>
              <Text style={styles.modalSave}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>Username</Text>
              <TextInput
                style={styles.modalInput}
                value={editUsername}
                onChangeText={setEditUsername}
                placeholder="your_username"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
              />
              <Text style={styles.modalHint}>
                3-20 characters, letters, numbers, and underscores only
              </Text>
            </View>

            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>Bio</Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                value={editBio}
                onChangeText={setEditBio}
                placeholder="Tell others about your style..."
                placeholderTextColor={Colors.textMuted}
                multiline
                maxLength={150}
                numberOfLines={4}
              />
              <Text style={styles.modalHint}>
                {editBio.length}/150 characters
              </Text>
            </View>

            <View style={styles.modalSection}>
              <View style={styles.modalToggleRow}>
                <View>
                  <Text style={styles.modalLabel}>Public Profile</Text>
                  <Text style={styles.modalHint}>
                    Allow others to view your profile and outfits
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.modalToggle, editIsPublic && styles.modalToggleActive]}
                  onPress={() => setEditIsPublic(!editIsPublic)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.modalToggleThumb, editIsPublic && styles.modalToggleThumbActive]} />
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    paddingBottom: Spacing.xxl,
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryAlpha10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  avatarText: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.primary,
  },
  name: {
    fontSize: FontSize.xl,
    fontWeight: '600',
    color: Colors.text,
  },
  username: {
    fontSize: FontSize.md,
    color: Colors.primary,
    marginTop: 4,
  },
  email: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: 2,
  },
  tierBadge: {
    marginTop: Spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
  },
  tierText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  statsCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
  },
  statsHeader: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.text,
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  upgradeCard: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  upgradeTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.white,
  },
  upgradeDesc: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.8)',
    marginTop: Spacing.xs,
  },
  upgradeButton: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.full,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: 'flex-start',
    marginTop: Spacing.md,
  },
  upgradeButtonText: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: FontSize.sm,
  },
  settingsCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
  },
  settingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: `${Colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingLabel: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  accordionHeaderLeft: {
    flex: 1,
  },
  accordionTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  accordionSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: 2,
  },
  accordionContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  pillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  toggleLabel: {
    fontSize: FontSize.md,
    color: Colors.text,
  },
  customToggle: {
    width: 48,
    height: 28,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  customToggleActive: {
    backgroundColor: Colors.primary,
  },
  customToggleThumb: {
    width: 20,
    height: 20,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.white,
    alignSelf: 'flex-start',
  },
  customToggleThumbActive: {
    alignSelf: 'flex-end',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  settingsText: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  version: {
    textAlign: 'center',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: Spacing.lg,
  },
  // Edit Profile
  editProfileCard: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
  },
  editProfileIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primaryAlpha10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  editProfileText: {
    flex: 1,
  },
  editProfileTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  editProfileDesc: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: 2,
  },
  // Edit Profile Modal
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalCancel: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  modalSave: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.primary,
  },
  modalContent: {
    flex: 1,
    padding: Spacing.md,
  },
  modalSection: {
    marginBottom: Spacing.lg,
  },
  modalLabel: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  modalInput: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalTextArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  modalHint: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  modalToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalToggle: {
    width: 48,
    height: 28,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  modalToggleActive: {
    backgroundColor: Colors.primary,
  },
  modalToggleThumb: {
    width: 20,
    height: 20,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.white,
    alignSelf: 'flex-start',
  },
  modalToggleThumbActive: {
    alignSelf: 'flex-end',
  },
  // Gamification Card
  gamificationCard: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  levelSection: {
    padding: Spacing.lg,
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  levelBadge: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 4,
  },
  levelName: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.white,
  },
  pointsTotal: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.white,
  },
  xpSection: {
    marginTop: Spacing.xs,
  },
  xpBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },
  xpFill: {
    height: '100%',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.full,
  },
  xpText: {
    fontSize: FontSize.sm,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
  },
  dailyGoalsPreview: {
    padding: Spacing.md,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  dailyGoalsTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  goalsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  goalItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.md,
  },
  goalText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  badgesSection: {
    padding: Spacing.md,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  badgesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  badgesTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  badgesCount: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.primary,
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  badgeItem: {
    width: '30%',
    aspectRatio: 1,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xs,
  },
  badgeIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  badgeName: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  badgeMore: {
    backgroundColor: Colors.primaryAlpha10,
  },
  badgeMoreText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.primary,
  },
  leaderboardLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  leaderboardLinkText: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
});
