import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, FontSize, BorderRadius } from '../src/constants/theme';
import { useSubscriptionStore } from '../src/stores/subscriptionStore';
import { PurchasesPackage } from 'react-native-purchases';

export default function UpgradeScreen() {
  const router = useRouter();
  const { tier, offerings, loadOfferings, purchase, restore } = useSubscriptionStore();
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isAnnual, setIsAnnual] = useState(true);

  useEffect(() => {
    loadOfferings();
  }, []);

  const handlePurchase = async (pkg: PurchasesPackage) => {
    setIsPurchasing(true);
    try {
      const success = await purchase(pkg);
      if (success) {
        Alert.alert(
          'Welcome to ' + (pkg.product.identifier.includes('plus') ? 'Plus' : 'Pro') + '!',
          'Your subscription is now active.',
          [{ text: 'Great!', onPress: () => router.back() }]
        );
      }
    } catch (error: any) {
      Alert.alert('Purchase Failed', error.message || 'Something went wrong. Please try again.');
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      const customerInfo = await restore();
      if (customerInfo) {
        Alert.alert('Purchases Restored', 'Your subscription has been restored!');
      } else {
        Alert.alert('No Purchases Found', 'No active subscriptions to restore.');
      }
    } catch (error: any) {
      Alert.alert('Restore Failed', error.message || 'Could not restore purchases.');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleManageSubscription = () => {
    const url = Platform.OS === 'ios'
      ? 'https://apps.apple.com/account/subscriptions'
      : 'https://play.google.com/store/account/subscriptions';
    Linking.openURL(url);
  };

  // Extract packages from offerings
  const currentOffering = offerings?.current;
  const plusMonthly = currentOffering?.availablePackages.find(
    (p) => p.product.identifier === 'fitcheck_plus_monthly'
  );
  const plusAnnual = currentOffering?.availablePackages.find(
    (p) => p.product.identifier === 'fitcheck_plus_annual'
  );
  const proMonthly = currentOffering?.availablePackages.find(
    (p) => p.product.identifier === 'fitcheck_pro_monthly'
  );
  const proAnnual = currentOffering?.availablePackages.find(
    (p) => p.product.identifier === 'fitcheck_pro_annual'
  );

  // Fallback prices if offerings haven't loaded
  const plusPrice = isAnnual
    ? plusAnnual?.product.priceString || '$49.99/yr'
    : plusMonthly?.product.priceString || '$5.99/mo';
  const proPrice = isAnnual
    ? proAnnual?.product.priceString || '$119.99/yr'
    : proMonthly?.product.priceString || '$14.99/mo';

  const plusPackage = isAnnual ? plusAnnual : plusMonthly;
  const proPackage = isAnnual ? proAnnual : proMonthly;

  // If already subscribed, show current plan
  if (tier !== 'free') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Your Plan</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.currentPlanCard}>
            <Ionicons
              name="checkmark-circle"
              size={64}
              color={Colors.primary}
              style={{ marginBottom: Spacing.md }}
            />
            <Text style={styles.currentPlanTitle}>
              You're on {tier.charAt(0).toUpperCase() + tier.slice(1)}
            </Text>
            <Text style={styles.currentPlanSubtitle}>
              {tier === 'plus'
                ? 'Unlimited checks and full history'
                : 'Unlimited checks, 10 follow-ups, full history'}
            </Text>

            <TouchableOpacity onPress={handleManageSubscription} style={styles.manageButton}>
              <Text style={styles.manageButtonText}>Manage Subscription</Text>
              <Ionicons name="open-outline" size={16} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={28} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Choose Your Plan</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Monthly/Annual Toggle */}
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleButton, !isAnnual && styles.toggleButtonActive]}
            onPress={() => setIsAnnual(false)}
          >
            <Text style={[styles.toggleText, !isAnnual && styles.toggleTextActive]}>
              Monthly
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, isAnnual && styles.toggleButtonActive]}
            onPress={() => setIsAnnual(true)}
          >
            <Text style={[styles.toggleText, isAnnual && styles.toggleTextActive]}>
              Annual
            </Text>
            <View style={styles.saveBadge}>
              <Text style={styles.saveBadgeText}>Save 30%</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Free Tier (for comparison) */}
        <View style={styles.planCard}>
          <Text style={styles.planName}>Free</Text>
          <Text style={styles.planPrice}>$0</Text>
          <Text style={styles.planPeriod}>Always free</Text>

          <View style={styles.featureList}>
            <Feature icon="checkmark" text="3 AI checks per day" />
            <Feature icon="checkmark" text="3 follow-up questions per check" />
            <Feature icon="checkmark" text="7-day history" />
          </View>

          <View style={styles.planButton}>
            <Text style={styles.currentPlanText}>Current Plan</Text>
          </View>
        </View>

        {/* Plus Tier */}
        <View style={[styles.planCard, styles.planCardHighlighted]}>
          <View style={styles.popularBadge}>
            <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
          </View>
          <Text style={styles.planName}>Plus</Text>
          <Text style={styles.planPrice}>{plusPrice}</Text>
          <Text style={styles.planPeriod}>
            {isAnnual ? '$49.99 billed annually' : 'Billed monthly'}
          </Text>

          <View style={styles.featureList}>
            <Feature icon="checkmark" text="Unlimited AI checks" primary />
            <Feature icon="checkmark" text="5 follow-ups per check" primary />
            <Feature icon="checkmark" text="Unlimited history" primary />
          </View>

          {isPurchasing ? (
            <View style={styles.loadingButton}>
              <ActivityIndicator color={Colors.white} />
            </View>
          ) : (
            <TouchableOpacity
              style={styles.purchaseButton}
              onPress={() => plusPackage && handlePurchase(plusPackage)}
              disabled={!plusPackage}
            >
              <Text style={styles.purchaseButtonText}>Start Free Trial</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.trialNote}>7 days free, then {plusPrice}</Text>
        </View>

        {/* Pro Tier */}
        <View style={styles.planCard}>
          <View style={styles.proBadge}>
            <Text style={styles.proBadgeText}>BEST VALUE</Text>
          </View>
          <Text style={styles.planName}>Pro</Text>
          <Text style={styles.planPrice}>{proPrice}</Text>
          <Text style={styles.planPeriod}>
            {isAnnual ? '$119.99 billed annually' : 'Billed monthly'}
          </Text>

          <View style={styles.featureList}>
            <Feature icon="checkmark" text="Everything in Plus" />
            <Feature icon="checkmark" text="10 follow-ups per check" />
          </View>

          {isPurchasing ? (
            <View style={styles.loadingButton}>
              <ActivityIndicator color={Colors.white} />
            </View>
          ) : (
            <TouchableOpacity
              style={styles.purchaseButton}
              onPress={() => proPackage && handlePurchase(proPackage)}
              disabled={!proPackage}
            >
              <Text style={styles.purchaseButtonText}>Start Free Trial</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.trialNote}>7 days free, then {proPrice}</Text>
        </View>

        {/* Restore Purchases */}
        <TouchableOpacity onPress={handleRestore} disabled={isRestoring} style={styles.restoreLink}>
          {isRestoring ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Text style={styles.restoreLinkText}>Restore Purchases</Text>
          )}
        </TouchableOpacity>

        {/* Footer Links */}
        <View style={styles.footer}>
          <TouchableOpacity onPress={() => Linking.openURL('https://orthis.app/terms')}>
            <Text style={styles.footerLink}>Terms of Service</Text>
          </TouchableOpacity>
          <Text style={styles.footerDivider}>•</Text>
          <TouchableOpacity onPress={() => Linking.openURL('https://orthis.app/privacy')}>
            <Text style={styles.footerLink}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Feature({
  icon,
  text,
  primary,
  muted,
}: {
  icon: string;
  text: string;
  primary?: boolean;
  muted?: boolean;
}) {
  const iconName = icon === 'checkmark' ? 'checkmark-circle' : 'close-circle';
  const iconColor = muted ? Colors.textMuted : primary ? Colors.primary : Colors.success;

  return (
    <View style={styles.feature}>
      <Ionicons name={iconName as any} size={20} color={iconColor} />
      <Text style={[styles.featureText, muted && styles.featureTextMuted]}>{text}</Text>
    </View>
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
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xs / 2,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  toggleButtonActive: {
    backgroundColor: Colors.primary,
  },
  toggleText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  toggleTextActive: {
    color: Colors.white,
  },
  saveBadge: {
    position: 'absolute',
    top: -8,
    right: 8,
    backgroundColor: Colors.success,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  saveBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.white,
  },
  planCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  planCardHighlighted: {
    borderColor: Colors.primary,
  },
  popularBadge: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs / 2,
    borderRadius: BorderRadius.sm,
  },
  popularBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: 0.5,
  },
  proBadge: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    backgroundColor: Colors.secondary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs / 2,
    borderRadius: BorderRadius.sm,
  },
  proBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: 0.5,
  },
  planName: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  planPrice: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.xs / 2,
  },
  planPeriod: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginBottom: Spacing.lg,
  },
  featureList: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  featureText: {
    fontSize: FontSize.sm,
    color: Colors.text,
    flex: 1,
  },
  featureTextMuted: {
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },
  planButton: {
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  currentPlanText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  purchaseButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  purchaseButtonText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.white,
  },
  loadingButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  trialNote: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  restoreLink: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  restoreLinkText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  footerLink: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  footerDivider: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  currentPlanCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  currentPlanTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  currentPlanSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  manageButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.primary,
  },
});
