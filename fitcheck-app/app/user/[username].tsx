import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, Fonts, getScoreColor } from '../../src/constants/theme';
import { usePublicUserProfile, useFollowUser, useUnfollowUser, useFollowers, useFollowing } from '../../src/hooks/useApi';
import { useAuthStore } from '../../src/stores/authStore';
import { socialService } from '../../src/services/api.service';
import ReportModal from '../../src/components/ReportModal';
import UserAvatar from '../../src/components/UserAvatar';

type SortOption = 'recent' | 'top-rated';

export default function PublicUserProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const username = params.username as string;
  const currentUser = useAuthStore((s) => s.user);

  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [isBlocked, setIsBlocked] = useState(false);
  const [isInCircle, setIsInCircle] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const { data: profile, isLoading, error } = usePublicUserProfile(username);
  const { data: followersData } = useFollowers(username);
  const { data: followingData } = useFollowing(username);
  const followUser = useFollowUser();
  const unfollowUser = useUnfollowUser();

  const isOwnProfile = profile?.id === currentUser?.id;

  const isFollowing = followersData?.followers?.some(
    (f) => f.id === currentUser?.id
  ) || false;

  const followerCount = followersData?.followers?.length || 0;
  const followingCount = followingData?.following?.length || 0;

  const handleBlockUser = async () => {
    if (!profile?.username) return;

    Alert.alert(
      'Block User',
      `Are you sure you want to block @${profile.username}? They won't be able to see or interact with your content.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await socialService.blockUser(profile.username!);
              setIsBlocked(true);
              setShowMenu(false);
              Alert.alert('User Blocked', `You've blocked @${profile.username}`);
            } catch (error: any) {
              Alert.alert('Error', error?.response?.data?.error || 'Failed to block user');
            }
          },
        },
      ]
    );
  };

  const handleUnblockUser = async () => {
    if (!profile?.username) return;

    try {
      await socialService.unblockUser(profile.username);
      setIsBlocked(false);
      Alert.alert('User Unblocked', `You've unblocked @${profile.username}`);
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.error || 'Failed to unblock user');
    }
  };

  useEffect(() => {
    if (profile?.username && !isOwnProfile) {
      socialService.getInnerCircleStatus(profile.username)
        .then((data) => setIsInCircle(data.isInCircle))
        .catch(() => {});
    }
  }, [profile?.username, isOwnProfile]);

  const handleInnerCircleToggle = async () => {
    if (!profile?.username) return;
    try {
      if (isInCircle) {
        await socialService.removeFromInnerCircle(profile.username);
        setIsInCircle(false);
        setShowMenu(false);
        Alert.alert('Removed', `@${profile.username} removed from your inner circle`);
      } else {
        await socialService.addToInnerCircle(profile.username);
        setIsInCircle(true);
        setShowMenu(false);
        Alert.alert('Added to Inner Circle', `@${profile.username} will now see your inner circle outfits`);
      }
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.error || 'Failed to update inner circle');
    }
  };

  const handleReport = async (reason: string, details: string) => {
    if (!profile?.id) return;
    await socialService.reportContent('user', profile.id, reason as any, details);
  };

  const handleFollowToggle = async () => {
    if (!profile?.username) return;

    try {
      if (isFollowing) {
        await unfollowUser.mutateAsync(profile.username);
      } else {
        await followUser.mutateAsync(profile.username);
      }
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.error || 'Failed to update follow status');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>User not found or profile is private</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const outfits = profile.outfitChecks || [];
  const sortedOutfits =
    sortBy === 'top-rated'
      ? [...outfits].sort((a, b) => (b.aiScore || 0) - (a.aiScore || 0))
      : outfits;

  const joinDate = new Date(profile.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>@{profile.username}</Text>
          {!isOwnProfile && (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setShowMenu(!showMenu)}
            >
              <Ionicons name="ellipsis-horizontal" size={24} color={Colors.text} />
            </TouchableOpacity>
          )}
          {isOwnProfile && <View style={{ width: 40 }} />}
        </View>

        {/* Menu dropdown */}
        {showMenu && !isOwnProfile && (
          <View style={styles.menuDropdown}>
            <TouchableOpacity style={styles.menuItem} onPress={handleInnerCircleToggle}>
              <Ionicons
                name={isInCircle ? 'people' : 'people-outline'}
                size={20}
                color={isInCircle ? Colors.primary : Colors.text}
              />
              <Text style={[styles.menuText, isInCircle && { color: Colors.primary }]}>
                {isInCircle ? 'Remove from Inner Circle' : 'Add to Inner Circle'}
              </Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowMenu(false);
                setShowReportModal(true);
              }}
            >
              <Ionicons name="flag-outline" size={20} color={Colors.text} />
              <Text style={styles.menuText}>Report User</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            {!isBlocked ? (
              <TouchableOpacity style={styles.menuItem} onPress={handleBlockUser}>
                <Ionicons name="ban-outline" size={20} color={Colors.error} />
                <Text style={[styles.menuText, { color: Colors.error }]}>Block User</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.menuItem} onPress={handleUnblockUser}>
                <Ionicons name="checkmark-circle-outline" size={20} color={Colors.success} />
                <Text style={[styles.menuText, { color: Colors.success }]}>Unblock User</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Profile Header — horizontal row */}
          <View style={styles.profileHeader}>
            <UserAvatar
              imageUri={(profile as any).profileImageUrl}
              initials={profile.username?.charAt(0).toUpperCase() || 'U'}
              size={72}
            />
            <View style={styles.profileInfo}>
              <Text style={styles.displayName}>{profile.username}</Text>
              <Text style={styles.usernameText}>@{profile.username}</Text>
              <Text style={styles.joinDate}>Joined {joinDate}</Text>
              {!isOwnProfile && !isBlocked && (
                <TouchableOpacity
                  style={[styles.followButton, isFollowing && styles.followingButton]}
                  onPress={handleFollowToggle}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
                    {isFollowing ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Bio */}
          {profile.bio && (
            <Text style={styles.bio}>{profile.bio}</Text>
          )}

          {/* Editorial rule */}
          <View style={styles.headerDivider} />

          {/* Stats — editorial inline */}
          <View style={styles.statsSection}>
            <Text style={styles.sectionLabel}>Stats</Text>
            <View style={styles.rule} />
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{outfits.length}</Text>
                <Text style={styles.statLabel}>Outfits</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{followerCount}</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{followingCount}</Text>
                <Text style={styles.statLabel}>Following</Text>
              </View>
            </View>
          </View>

          {/* Sort Filter */}
          {outfits.length > 0 && (
            <>
              <View style={styles.filterSection}>
                <TouchableOpacity
                  style={[styles.filterButton, sortBy === 'recent' && styles.filterButtonActive]}
                  onPress={() => setSortBy('recent')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterText, sortBy === 'recent' && styles.filterTextActive]}>
                    Recent
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterButton, sortBy === 'top-rated' && styles.filterButtonActive]}
                  onPress={() => setSortBy('top-rated')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterText, sortBy === 'top-rated' && styles.filterTextActive]}>
                    Top Rated
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.filterDivider} />
            </>
          )}

          {/* Outfits */}
          {outfits.length > 0 ? (
            <View style={styles.outfitsSection}>
              <Text style={styles.sectionLabel}>Outfits</Text>
              <View style={styles.rule} />
              <View style={styles.outfitsGrid}>
                {sortedOutfits.map((outfit) => {
                  const imageUri = outfit.thumbnailData
                    ? `data:image/jpeg;base64,${outfit.thumbnailData}`
                    : outfit.imageUrl;
                  const score = outfit.aiScore || 0;
                  const scoreColor = getScoreColor(score);

                  return (
                    <TouchableOpacity
                      key={outfit.id}
                      style={styles.gridItem}
                      onPress={() => router.push(`/outfit/${outfit.id}` as any)}
                      activeOpacity={0.9}
                    >
                      {imageUri ? (
                        <Image
                          source={{ uri: imageUri }}
                          style={styles.gridImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.gridImage, styles.gridPlaceholder]}>
                          <Ionicons name="shirt-outline" size={32} color={Colors.textMuted} />
                        </View>
                      )}
                      <View style={[styles.gridScoreBadge, { backgroundColor: scoreColor }]}>
                        <Text style={styles.gridScoreText}>{score.toFixed(1)}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="shirt-outline" size={40} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No public outfits yet</Text>
              {isOwnProfile && (
                <Text style={styles.emptyText}>
                  Share your outfits with the community to build your profile
                </Text>
              )}
            </View>
          )}

          <View style={{ height: 60 }} />
        </ScrollView>
      </SafeAreaView>

      {/* Report Modal */}
      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        targetType="user"
        targetId={profile?.id || ''}
        targetName={profile?.username || 'unknown'}
        onSubmit={handleReport}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    gap: Spacing.md,
  },
  errorText: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },
  backButton: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: 0,
  },
  backButtonText: {
    fontSize: 12,
    fontFamily: Fonts.sansMedium,
    textTransform: 'uppercase',
    letterSpacing: 1.65,
    color: Colors.white,
  },
  // Header — flat, no bg on icon buttons
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.sansBold,
    color: Colors.text,
  },
  scrollView: {
    flex: 1,
  },
  // Profile header — horizontal row
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
  profileInfo: {
    flex: 1,
  },
  displayName: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    color: Colors.text,
    lineHeight: 30,
  },
  usernameText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.primary,
    marginTop: 2,
  },
  joinDate: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: Colors.textMuted,
    marginTop: 4,
  },
  bio: {
    fontSize: FontSize.md,
    fontFamily: Fonts.sans,
    color: Colors.textSecondary,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  // Follow button — sharp, uppercase
  followButton: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    backgroundColor: Colors.primary,
    borderRadius: 0,
    alignSelf: 'flex-start',
  },
  followingButton: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  followButtonText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.65,
    color: Colors.white,
  },
  followingButtonText: {
    color: Colors.text,
  },
  // Editorial divider after profile row
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
  // Stats — flat inline row with dividers
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
  // Filter chips — sharp corners, uppercase
  filterSection: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    marginBottom: 0,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
  },
  filterButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.0,
    color: Colors.textMuted,
  },
  filterTextActive: {
    color: Colors.white,
  },
  filterDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  // Outfits section
  outfitsSection: {
    paddingHorizontal: Spacing.lg,
  },
  outfitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  gridItem: {
    width: '31.5%',
    aspectRatio: 3 / 4,
    borderRadius: 0,
    overflow: 'hidden',
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  gridPlaceholder: {
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridScoreBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  gridScoreText: {
    fontSize: 11,
    fontFamily: Fonts.sansBold,
    color: Colors.white,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl * 2,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 17,
    color: Colors.text,
    marginTop: Spacing.md,
  },
  emptyText: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  menuDropdown: {
    position: 'absolute',
    top: 60,
    right: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: Colors.border,
    zIndex: 1000,
    minWidth: 160,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  menuText: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  menuDivider: {
    height: 1,
    backgroundColor: Colors.border,
  },
});
