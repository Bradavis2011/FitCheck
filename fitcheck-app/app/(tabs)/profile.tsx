import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, TextInput, Modal, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { Colors, Spacing, Fonts } from '../../src/constants/theme';
import { useAuthStore } from '../../src/stores/authStore';
import { useSubscriptionStore } from '../../src/stores/subscriptionStore';
import { logOutPurchases } from '../../src/services/purchases.service';
import { useUserStats, useUser, useUpdateProfile, useBadges, useDailyGoals, useClaimReferral } from '../../src/hooks/useApi';
import PillButton from '../../src/components/PillButton';
import WardrobeProgressCard from '../../src/components/WardrobeProgressCard';
import ReferralCard from '../../src/components/ReferralCard';
import UserAvatar from '../../src/components/UserAvatar';
import { styles as styleOptions } from '../../src/lib/mockData';

const PENDING_REFERRAL_KEY = 'orthis_pending_referral_code';

export default function ProfileScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const { tier } = useSubscriptionStore();
  const { data: stats } = useUserStats();
  const { data: userProfile } = useUser();
  const { data: badgesData } = useBadges();
  const { data: dailyGoals } = useDailyGoals();
  const updateProfile = useUpdateProfile();

  const claimReferral = useClaimReferral();

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [showStyles, setShowStyles] = useState(false);
  const selectedStyles = (userProfile?.stylePreferences?.styles as string[]) || [];
  const [showSettings, setShowSettings] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editIsPublic, setEditIsPublic] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const notificationsValue = await SecureStore.getItemAsync('notifications');
        if (notificationsValue !== null) setNotifications(notificationsValue === 'true');
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };
    loadSettings();
  }, []);

  // Claim any pending referral code stored during deep link / invite flow
  useEffect(() => {
    const claimPendingReferral = async () => {
      try {
        const code = await SecureStore.getItemAsync(PENDING_REFERRAL_KEY);
        if (code) {
          await claimReferral.mutateAsync(code);
          await SecureStore.deleteItemAsync(PENDING_REFERRAL_KEY);
        }
      } catch {
        // Non-fatal — silently ignore if claim fails (invalid code, already claimed, etc.)
      }
    };
    claimPendingReferral();
  }, []);

  const toggleStyle = (style: string) => {
    const newStyles = selectedStyles.includes(style)
      ? selectedStyles.filter((s) => s !== style)
      : [...selectedStyles, style];
    updateProfile.mutate({ stylePreferences: { styles: newStyles } });
  };

  const toggleNotifications = async () => {
    const newValue = !notifications;
    setNotifications(newValue);
    try { await SecureStore.setItemAsync('notifications', String(newValue)); } catch { /* ignore */ }
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
          await logOutPurchases();
          await clearAuth();
          queryClient.clear();
          useSubscriptionStore.setState({ tier: 'free', isLoaded: false, offerings: null, customerInfo: null, limits: null });
          await signOut();
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
    if (editUsername && !/^[a-zA-Z0-9_]{3,20}$/.test(editUsername)) {
      Alert.alert('Invalid Username', 'Username must be 3-20 characters and contain only letters, numbers, and underscores.');
      return;
    }
    if (editBio && editBio.length > 150) {
      Alert.alert('Bio Too Long', 'Bio must be 150 characters or less.');
      return;
    }
    try {
      await updateProfile.mutateAsync({ username: editUsername || undefined, bio: editBio || undefined, isPublic: editIsPublic } as any);
      setShowEditProfile(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.error || 'Failed to update profile. Please try again.');
    }
  };

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to set a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    try {
      setIsUploadingAvatar(true);
      // Compress to 256×256 avatar
      const compressed = await manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 256, height: 256 } }],
        { compress: 0.8, format: SaveFormat.JPEG, base64: true }
      );
      const dataUri = `data:image/jpeg;base64,${compressed.base64}`;
      await updateProfile.mutateAsync({ profileImageUrl: dataUri } as any);
    } catch {
      Alert.alert('Error', 'Failed to update profile picture. Please try again.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const getInitials = () => {
    const name = user?.name || user?.email?.split('@')[0] || 'User';
    const parts = name.split(' ');
    if (parts.length >= 2) return parts[0][0] + parts[1][0];
    return name.slice(0, 2).toUpperCase();
  };

  const displayName = user?.name || user?.email?.split('@')[0] || 'User';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Editorial profile header */}
        <View style={styles.profileHeader}>
          <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.8}>
            <UserAvatar
              imageUri={userProfile?.profileImageUrl}
              initials={getInitials()}
              size={72}
            />
            <View style={styles.avatarEditBadge}>
              {isUploadingAvatar
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <Ionicons name="camera" size={12} color={Colors.white} />}
            </View>
          </TouchableOpacity>
          <View style={styles.profileInfo}>
            <Text style={styles.name}>{displayName}</Text>
            {userProfile?.username && (
              <Text style={styles.username}>@{userProfile.username}</Text>
            )}
            <View style={styles.tierRow}>
              <Text style={styles.tierText}>{tier.charAt(0).toUpperCase() + tier.slice(1)}</Text>
              {tier !== 'free' && (
                <View style={styles.tierDot} />
              )}
            </View>
          </View>
          <TouchableOpacity style={styles.editButton} onPress={handleOpenEditProfile}>
            <Ionicons name="pencil-outline" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Editorial rule */}
        <View style={styles.headerDivider} />

        {/* Stats — editorial inline layout */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionLabel}>Stats</Text>
          <View style={styles.rule} />
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats?.totalOutfits || 0}</Text>
              <Text style={styles.statLabel}>Checks</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats?.currentStreak || 0}</Text>
              <Text style={styles.statLabel}>Streak</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats?.totalFavorites || 0}</Text>
              <Text style={styles.statLabel}>Saved</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>Lv {stats?.level || 1}</Text>
              <Text style={styles.statLabel}>Level</Text>
            </View>
          </View>
        </View>

        {/* Referral */}
        <ReferralCard />

        {/* Gamification — editorial, no gradient */}
        {(dailyGoals || (badgesData && badgesData.totalBadges > 0)) && (
          <View style={styles.card}>
            {/* XP / Level */}
            <View style={styles.levelRow}>
              <View>
                <Text style={styles.sectionLabel}>Progress</Text>
                <View style={styles.rule} />
                <Text style={styles.levelName}>
                  {stats?.level === 1 ? 'Style Newbie' :
                   stats?.level === 2 ? 'Fashion Friend' :
                   stats?.level === 3 ? 'Style Advisor' :
                   stats?.level === 4 ? 'Outfit Expert' :
                   stats?.level === 5 ? 'Trusted Reviewer' :
                   stats?.level === 6 ? 'Style Guru' :
                   stats?.level === 7 ? 'Fashion Icon' :
                   'Legend'}
                </Text>
                {stats?.xpToNextLevel && stats.xpToNextLevel > 0 && (
                  <Text style={styles.xpText}>{stats.xpToNextLevel} XP to next level</Text>
                )}
              </View>
              <Text style={styles.pointsTotal}>{(stats?.points || 0).toLocaleString()}</Text>
            </View>

            {/* XP bar */}
            <View style={styles.xpBarBg}>
              <View style={[styles.xpBarFill, {
                width: `${stats?.xpToNextLevel
                  ? Math.min(100, ((stats?.points || 0) % (stats?.xpToNextLevel || 100)) / (stats?.xpToNextLevel || 100) * 100)
                  : 100}%`,
              }]} />
            </View>

            {/* Daily goals */}
            {dailyGoals && (dailyGoals.feedbacksGiven > 0 || dailyGoals.currentStreak > 0) && (
              <View style={styles.goalsRow}>
                {dailyGoals.currentStreak > 0 && (
                  <View style={styles.goalChip}>
                    <Ionicons name="flame" size={13} color={Colors.warning} />
                    <Text style={styles.goalChipText}>{dailyGoals.currentStreak}d streak</Text>
                  </View>
                )}
                {dailyGoals.feedbacksGiven > 0 && (
                  <View style={styles.goalChip}>
                    <Ionicons name="chatbubble" size={13} color={Colors.primary} />
                    <Text style={styles.goalChipText}>
                      {dailyGoals.feedbacksGiven}/{dailyGoals.feedbacksGoal} feedbacks
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Badges */}
            {badgesData && badgesData.totalBadges > 0 && (
              <View style={styles.badgesSection}>
                <View style={styles.sectionLabelRow}>
                  <Text style={styles.sectionLabel}>Badges</Text>
                  <Text style={styles.badgesCount}>{badgesData.totalBadges}</Text>
                </View>
                <View style={styles.rule} />
                <View style={styles.badgesRow}>
                  {badgesData.badges.slice(0, 6).map((badge) => (
                    <View key={badge.id} style={styles.badgeItem}>
                      <Text style={styles.badgeIcon}>{badge.icon}</Text>
                      <Text style={styles.badgeName}>{badge.name}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* View public profile */}
        {userProfile?.username && userProfile?.isPublic && (
          <TouchableOpacity
            style={styles.listRow}
            onPress={() => router.push(`/user/${userProfile.username}` as any)}
          >
            <Text style={styles.listRowText}>View Public Profile</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        )}

        {/* Style Preferences */}
        <TouchableOpacity
          style={styles.listRow}
          onPress={() => router.push('/style-preferences' as any)}
        >
          <Text style={styles.listRowText}>Style Preferences</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        </TouchableOpacity>

        {/* Wardrobe */}
        <View style={styles.wardrobeSection}>
          <WardrobeProgressCard />
        </View>

        {/* Upgrade — editorial style */}
        {tier === 'free' && (
          <View style={styles.upgradeBlock}>
            <Text style={styles.sectionLabel}>Plus</Text>
            <View style={styles.rule} />
            <Text style={styles.upgradeTitle}>Unlimited. Ad-free. Yours.</Text>
            <TouchableOpacity
              style={styles.upgradeButton}
              onPress={() => router.push('/upgrade' as any)}
            >
              <Text style={styles.upgradeButtonText}>See Plans</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* App Settings */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>App Settings</Text>
          <View style={styles.rule} />

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Notifications</Text>
            <TouchableOpacity
              style={[styles.toggle, notifications && styles.toggleActive]}
              onPress={toggleNotifications}
              activeOpacity={0.8}
            >
              <View style={[styles.toggleThumb, notifications && styles.toggleThumbActive]} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Account links */}
        <View style={styles.card}>
          <TouchableOpacity style={styles.listRow} onPress={() => router.push('/privacy-settings' as any)}>
            <Text style={styles.listRowText}>Privacy & Security</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.rowDivider} />
          <TouchableOpacity style={styles.listRow} onPress={() => router.push('/privacy' as any)}>
            <Text style={styles.listRowText}>Privacy & Data</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.rowDivider} />
          <TouchableOpacity style={styles.listRow} onPress={() => router.push('/help' as any)}>
            <Text style={styles.listRowText}>Help & Support</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.rowDivider} />
          {__DEV__ && (
            <TouchableOpacity style={styles.listRow} onPress={handleResetOnboarding}>
              <Text style={[styles.listRowText, { color: Colors.warning }]}>Reset Onboarding (Test)</Text>
            </TouchableOpacity>
          )}
          <View style={styles.rowDivider} />
          <TouchableOpacity style={styles.listRow} onPress={handleSignOut}>
            <Text style={[styles.listRowText, { color: Colors.error }]}>Log Out</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>Or This? v1.1.0</Text>
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
              <Text style={styles.modalHint}>3-20 characters, letters, numbers, and underscores only</Text>
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
              <Text style={styles.modalHint}>{editBio.length}/150 characters</Text>
            </View>

            <View style={styles.modalSection}>
              <View style={styles.modalToggleRow}>
                <View>
                  <Text style={styles.modalLabel}>Public Profile</Text>
                  <Text style={styles.modalHint}>Allow others to view your profile and outfits</Text>
                </View>
                <TouchableOpacity
                  style={[styles.toggle, editIsPublic && styles.toggleActive]}
                  onPress={() => setEditIsPublic(!editIsPublic)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.toggleThumb, editIsPublic && styles.toggleThumbActive]} />
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
  // Editorial profile header
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  profileInfo: {
    flex: 1,
  },
  name: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    color: Colors.text,
    lineHeight: 30,
  },
  username: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.primary,
    marginTop: 2,
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  tierText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: Colors.textMuted,
  },
  tierDot: {
    width: 5,
    height: 5,
    borderRadius: 9999,
    backgroundColor: Colors.primary,
  },
  editButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  // Editorial section label + rule
  sectionLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 2.2,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  rule: {
    width: 60,
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.12)',
    marginBottom: Spacing.md,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  badgesCount: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    color: Colors.primary,
  },
  // Stats editorial grid
  statsSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontFamily: Fonts.sansBold,
    fontSize: 26,
    color: Colors.text,
  },
  statLabel: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  // Card
  card: {
    backgroundColor: Colors.white,
    borderRadius: 8,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  // Gamification (editorial, no gradient)
  levelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  levelName: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 16,
    color: Colors.text,
    marginBottom: 2,
  },
  xpText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.textMuted,
  },
  pointsTotal: {
    fontFamily: Fonts.sansBold,
    fontSize: 28,
    color: Colors.primary,
  },
  xpBarBg: {
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  xpBarFill: {
    height: 3,
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  goalsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  goalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: 0, // sharp
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  goalChipText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  badgesSection: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  badgeItem: {
    alignItems: 'center',
    minWidth: 52,
  },
  badgeIcon: {
    fontSize: 24,
    marginBottom: 2,
  },
  badgeName: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  // Upgrade block — editorial, no gradient
  upgradeBlock: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: Colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  upgradeTitle: {
    fontFamily: Fonts.serif,
    fontSize: 22,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  upgradeButton: {
    borderRadius: 0,
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    alignSelf: 'flex-start',
  },
  upgradeButtonText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.65,
    color: Colors.primary,
  },
  // List rows
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  listRowText: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    color: Colors.text,
  },
  rowDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginHorizontal: Spacing.lg,
  },
  // Toggle (standard pill — exception per spec)
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  toggleLabel: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    color: Colors.text,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 9999,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  toggleActive: {
    backgroundColor: Colors.primary,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 9999,
    backgroundColor: Colors.white,
    alignSelf: 'flex-start',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  // Wardrobe section
  wardrobeSection: {
    marginBottom: Spacing.sm,
  },
  version: {
    fontFamily: Fonts.sans,
    textAlign: 'center',
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: Spacing.lg,
  },
  // Modal
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
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  modalCancel: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    color: Colors.textMuted,
  },
  modalTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 16,
    color: Colors.text,
  },
  modalSave: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 15,
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
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  modalInput: {
    backgroundColor: Colors.white,
    borderRadius: 0, // sharp
    padding: Spacing.md,
    fontFamily: Fonts.sans,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  modalTextArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  modalHint: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  modalToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
