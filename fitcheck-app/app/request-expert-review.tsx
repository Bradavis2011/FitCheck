import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../src/constants/theme';
import { useRequestExpertReview, useStylists } from '../src/hooks/useApi';
import { useSubscriptionStore } from '../src/stores/subscriptionStore';
import { StylistProfile } from '../src/services/api.service';

export default function RequestExpertReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const outfitId = params.outfitId as string;
  const thumbnailUrl = params.thumbnailUrl as string | undefined;

  const { tier } = useSubscriptionStore();
  const [selectedStylistId, setSelectedStylistId] = useState<string | undefined>(undefined);

  const { data: stylistsData, isLoading: isLoadingStylists } = useStylists();
  const requestMutation = useRequestExpertReview();

  const stylists = stylistsData?.stylists || [];

  // Gate: Pro only
  if (tier !== 'pro') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Expert Review</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.gateContainer}>
          <Ionicons name="ribbon-outline" size={56} color={Colors.textMuted} />
          <Text style={styles.gateTitle}>Pro Feature</Text>
          <Text style={styles.gateText}>
            Expert reviews from verified stylists are available on the Pro plan. Upgrade to get up
            to 5 professional reviews per month.
          </Text>
          <TouchableOpacity
            style={styles.upgradeButton}
            onPress={() => router.push('/upgrade' as any)}
            activeOpacity={0.8}
          >
            <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handleRequest = () => {
    Alert.alert(
      'Request Expert Review',
      selectedStylistId
        ? 'Send this outfit to your selected stylist for a professional review?'
        : 'Send this outfit to an available stylist for a professional review?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request',
          onPress: () => {
            requestMutation.mutate(
              { outfitCheckId: outfitId, stylistId: selectedStylistId },
              {
                onSuccess: () => {
                  Alert.alert(
                    'Review Requested!',
                    "Your outfit has been sent to a stylist. You'll receive a notification when your review is ready (typically 24-48 hours).",
                    [{ text: 'OK', onPress: () => router.back() }]
                  );
                },
                onError: (err: any) => {
                  const msg =
                    err?.response?.data?.error || err?.message || 'Something went wrong.';
                  Alert.alert('Error', msg);
                },
              }
            );
          },
        },
      ]
    );
  };

  const renderStylist = (stylist: StylistProfile) => {
    const isSelected = selectedStylistId === stylist.id;
    const avatarLetter = (stylist.user.username || stylist.user.name || 'S').charAt(0).toUpperCase();

    return (
      <TouchableOpacity
        key={stylist.id}
        style={[styles.stylistCard, isSelected && styles.stylistCardSelected]}
        onPress={() => setSelectedStylistId(isSelected ? undefined : stylist.id)}
        activeOpacity={0.8}
      >
        <View style={styles.stylistAvatar}>
          <Text style={styles.stylistAvatarText}>{avatarLetter}</Text>
        </View>
        <View style={styles.stylistInfo}>
          <Text style={styles.stylistName}>
            {stylist.user.username || stylist.user.name || 'Stylist'}
          </Text>
          <View style={styles.stylistRating}>
            <Ionicons name="star" size={12} color="#F59E0B" />
            <Text style={styles.stylistRatingText}>
              {stylist.rating.toFixed(1)} · {stylist.reviewCount} reviews
            </Text>
          </View>
          <View style={styles.specialtiesRow}>
            {stylist.specialties.slice(0, 3).map((s) => (
              <View key={s} style={styles.specialtyTag}>
                <Text style={styles.specialtyTagText}>{s}</Text>
              </View>
            ))}
          </View>
        </View>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Expert Review</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Outfit preview */}
        <View style={styles.outfitPreview}>
          {thumbnailUrl ? (
            <Image source={{ uri: thumbnailUrl }} style={styles.outfitImage} resizeMode="cover" />
          ) : (
            <View style={[styles.outfitImage, styles.outfitImagePlaceholder]}>
              <Ionicons name="shirt-outline" size={32} color={Colors.textMuted} />
            </View>
          )}
          <View style={styles.outfitBadge}>
            <Ionicons name="ribbon" size={14} color={Colors.white} />
            <Text style={styles.outfitBadgeText}>Expert Review</Text>
          </View>
        </View>

        {/* What you get */}
        <View style={styles.benefitsCard}>
          <Text style={styles.benefitsTitle}>What you'll receive</Text>
          <View style={styles.benefitRow}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
            <Text style={styles.benefitText}>Professional score (1–10) from a verified stylist</Text>
          </View>
          <View style={styles.benefitRow}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
            <Text style={styles.benefitText}>Detailed written feedback on your outfit</Text>
          </View>
          <View style={styles.benefitRow}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
            <Text style={styles.benefitText}>Typically delivered within 24–48 hours</Text>
          </View>
        </View>

        {/* Stylist selection */}
        <Text style={styles.sectionTitle}>Choose a stylist</Text>
        <Text style={styles.sectionSubtitle}>
          Select a stylist or leave blank to be auto-assigned
        </Text>

        {isLoadingStylists ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.lg }} />
        ) : stylists.length === 0 ? (
          <View style={styles.noStylists}>
            <Text style={styles.noStylistsText}>
              No stylists are available right now. Your review will be auto-assigned when one
              becomes available.
            </Text>
          </View>
        ) : (
          <View style={styles.stylistsList}>{stylists.map(renderStylist)}</View>
        )}
      </ScrollView>

      {/* Footer CTA */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.requestButton, requestMutation.isPending && styles.requestButtonDisabled]}
          onPress={handleRequest}
          disabled={requestMutation.isPending}
          activeOpacity={0.8}
        >
          {requestMutation.isPending ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <Ionicons name="ribbon-outline" size={20} color={Colors.white} />
              <Text style={styles.requestButtonText}>Request Expert Review</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
  headerTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: 100,
  },
  gateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  gateTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  gateText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  upgradeButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.sm,
  },
  upgradeButtonText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.white,
  },
  outfitPreview: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  outfitImage: {
    width: 120,
    height: 160,
    borderRadius: BorderRadius.lg,
  },
  outfitImagePlaceholder: {
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  outfitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm,
  },
  outfitBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.white,
  },
  benefitsCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  benefitsTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  benefitText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    flex: 1,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginBottom: Spacing.md,
  },
  noStylists: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  noStylistsText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  stylistsList: {
    gap: Spacing.sm,
  },
  stylistCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: Spacing.sm,
  },
  stylistCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  stylistAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stylistAvatarText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.primary,
  },
  stylistInfo: {
    flex: 1,
    gap: 2,
  },
  stylistName: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  stylistRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  stylistRatingText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  specialtiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  specialtyTag: {
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  specialtyTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.primary,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.md,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  requestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.md,
  },
  requestButtonDisabled: {
    opacity: 0.6,
  },
  requestButtonText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.white,
  },
});
