import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Share,
  ActivityIndicator,
} from 'react-native';
let Clipboard: typeof import('expo-clipboard') | null = null;
try { Clipboard = require('expo-clipboard'); } catch { /* native module unavailable in this build */ }
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Fonts } from '../constants/theme';
import { useReferralStats } from '../hooks/useApi';

export default function ReferralCard() {
  const { data: stats, isLoading } = useReferralStats();
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    if (!stats?.link) return;
    if (Clipboard) {
      await Clipboard.setStringAsync(stats.link);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } else {
      await Share.share({ message: stats.link });
    }
  };

  const handleShare = async () => {
    if (!stats?.link) return;
    try {
      await Share.share({
        message: `Try Or This? — AI outfit feedback in 30 seconds. Use my link: ${stats.link}`,
        title: 'Or This? — AI Outfit Feedback',
      });
    } catch (error: any) {
      if (!error.message?.includes('cancelled')) {
        Alert.alert('Error', 'Failed to share. Please try again.');
      }
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }

  if (!stats) return null;

  const bonusChecks = stats.bonusDailyChecks ?? 0;
  const referralCount = stats.referralCount ?? 0;
  const maxBonus = stats.maxBonusChecks ?? 3;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Invite & Earn</Text>
      <View style={styles.rule} />

      <Text style={styles.description}>
        Share your link — every friend who joins and checks their first outfit gives you +1 bonus daily check (up to {maxBonus}).
      </Text>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{referralCount}</Text>
          <Text style={styles.statLabel}>{'Total\nInvited'}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, bonusChecks > 0 && styles.statNumberActive]}>
            +{bonusChecks}
          </Text>
          <Text style={styles.statLabel}>{'Bonus\nChecks'}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{maxBonus - bonusChecks}</Text>
          <Text style={styles.statLabel}>{'Still\nAvailable'}</Text>
        </View>
      </View>

      {/* Link display */}
      <View style={styles.linkRow}>
        <Text style={styles.linkText} numberOfLines={1} ellipsizeMode="middle">
          {stats.link}
        </Text>
        <TouchableOpacity style={styles.copyButton} onPress={handleCopy}>
          <Ionicons
            name={isCopied ? 'checkmark' : 'copy-outline'}
            size={16}
            color={isCopied ? Colors.success : Colors.primary}
          />
        </TouchableOpacity>
      </View>

      {/* Share button */}
      <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
        <Ionicons name="share-social" size={16} color={Colors.white} />
        <Text style={styles.shareButtonText}>Share Your Link</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    borderRadius: 8,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
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
    backgroundColor: Colors.primary,
    marginBottom: Spacing.md,
  },
  description: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  statNumber: {
    fontFamily: Fonts.sansBold,
    fontSize: 22,
    color: Colors.text,
  },
  statNumberActive: {
    color: Colors.primary,
  },
  statLabel: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  linkText: {
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.textMuted,
  },
  copyButton: {
    padding: 4,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 0,
    paddingVertical: 12,
  },
  shareButtonText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.65,
    color: Colors.white,
  },
});
