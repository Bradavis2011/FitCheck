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
import { Colors, Spacing, FontSize, BorderRadius, Fonts, getScoreColor } from '../../src/constants/theme';
import { usePublicUserProfile, useFollowUser, useUnfollowUser, useFollowers, useFollowing } from '../../src/hooks/useApi';
import { useAuthStore } from '../../src/stores/authStore';
import { socialService } from '../../src/services/api.service';
import ReportModal from '../../src/components/ReportModal';

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

  // For now, we'll need to fetch by username - may need to update the backend
  const { data: profile, isLoading, error } = usePublicUserProfile(username);
  const { data: followersData } = useFollowers(username);
  const { data: followingData } = useFollowing(username);
  const followUser = useFollowUser();
  const unfollowUser = useUnfollowUser();

  // Fixed: Compare user IDs instead of email prefixes
  const isOwnProfile = profile?.id === currentUser?.id;

  // Fixed: Check if current user is in the followers list by ID
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

  // Load inner circle status when profile loads
  useEffect(() => {
    if (profile?.username && !isOwnProfile) {
      socialService.getInnerCircleStatus(profile.username)
        .then((data) => setIsInCircle(data.isInCircle))
        .catch(() => {}); // non-fatal
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

  const avgScore =
    outfits.length > 0
      ? outfits.reduce((sum, outfit) => sum + (outfit.aiScore || 0), 0) / outfits.length
      : 0;

  const joinDate = new Date(profile.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBackButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>@{profile.username}</Text>
          {!isOwnProfile && (
            <TouchableOpacity
              style={styles.headerBackButton}
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
          {/* Profile Header */}
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {profile.username?.charAt(0).toUpperCase() || 'U'}
              </Text>
            </View>
            <Text style={styles.username}>@{profile.username}</Text>
            {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
            <Text style={styles.joinDate}>Joined {joinDate}</Text>

            {/* Follow Button */}
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

          {/* Stats */}
          <View style={styles.statsSection}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{outfits.length}</Text>
              <Text style={styles.statLabel}>Outfits</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{followerCount}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{followingCount}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
          </View>

          {/* Sort Filter */}
          {outfits.length > 0 && (
            <View style={styles.filterSection}>
              <TouchableOpacity
                style={[styles.filterButton, sortBy === 'recent' && styles.filterButtonActive]}
                onPress={() => setSortBy('recent')}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.filterText, sortBy === 'recent' && styles.filterTextActive]}
                >
                  Recent
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterButton,
                  sortBy === 'top-rated' && styles.filterButtonActive,
                ]}
                onPress={() => setSortBy('top-rated')}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.filterText, sortBy === 'top-rated' && styles.filterTextActive]}
                >
                  Top Rated
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Outfits Grid */}
          {outfits.length > 0 ? (
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
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="shirt-outline" size={64} color={Colors.textMuted} />
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
    borderRadius: BorderRadius.full,
  },
  backButtonText: {
    fontSize: FontSize.md,
    fontFamily: Fonts.sansSemiBold,
    color: Colors.white,
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
  headerBackButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 9999,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.sansBold,
    color: Colors.text,
  },
  scrollView: {
    flex: 1,
  },
  profileHeader: {
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
    fontFamily: Fonts.sansBold,
    color: Colors.primary,
  },
  username: {
    fontSize: FontSize.xl,
    fontFamily: Fonts.sansSemiBold,
    color: Colors.text,
  },
  bio: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
    marginHorizontal: Spacing.lg,
  },
  joinDate: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  followButton: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
  },
  followingButton: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  followButtonText: {
    fontSize: FontSize.md,
    fontFamily: Fonts.sansSemiBold,
    color: Colors.white,
  },
  followingButtonText: {
    color: Colors.text,
  },
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: FontSize.xxl,
    fontFamily: Fonts.sansBold,
    color: Colors.text,
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 4,
  },
  filterSection: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  filterButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: Colors.primary,
  },
  filterText: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.sansSemiBold,
    color: Colors.text,
  },
  filterTextActive: {
    color: Colors.white,
  },
  outfitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  gridItem: {
    width: '31.5%',
    aspectRatio: 3 / 4,
    borderRadius: BorderRadius.md,
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
    borderRadius: BorderRadius.full,
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
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.sansSemiBold,
    color: Colors.text,
    marginTop: Spacing.md,
  },
  emptyText: {
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
    fontSize: FontSize.md,
    color: Colors.text,
  },
  menuDivider: {
    height: 1,
    backgroundColor: Colors.border,
  },
});
