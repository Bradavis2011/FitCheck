import { Platform } from 'react-native';
import Purchases, {
  CustomerInfo,
  PurchasesOfferings,
  PurchasesPackage,
  LOG_LEVEL,
} from 'react-native-purchases';

const RC_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || '';
const RC_ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || '';

let isConfigured = false;

/**
 * Initialize RevenueCat SDK. Call once at app startup after auth.
 * @param userId - Clerk user ID, used as RevenueCat app_user_id
 */
export async function initializePurchases(userId: string): Promise<void> {
  if (isConfigured) {
    console.log('[Purchases] Already configured, skipping...');
    return;
  }

  const apiKey = Platform.OS === 'ios' ? RC_IOS_KEY : RC_ANDROID_KEY;

  if (!apiKey || apiKey === '') {
    console.warn('[Purchases] No RevenueCat API key configured for', Platform.OS);
    console.warn('[Purchases] Subscription features will be disabled');
    return;
  }

  try {
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }

    Purchases.configure({ apiKey, appUserID: userId });
    isConfigured = true;
    console.log('[Purchases] Successfully configured for user:', userId);
  } catch (error) {
    console.error('[Purchases] Configuration failed:', error);
    throw error;
  }
}

/**
 * Get current customer info (entitlements, active subscriptions).
 */
export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!isConfigured) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch (error) {
    console.error('[Purchases] Failed to get customer info:', error);
    return null;
  }
}

/**
 * Get available offerings (products to display on paywall).
 */
export async function getOfferings(): Promise<PurchasesOfferings | null> {
  if (!isConfigured) return null;
  try {
    return await Purchases.getOfferings();
  } catch (error) {
    console.error('[Purchases] Failed to get offerings:', error);
    return null;
  }
}

/**
 * Purchase a specific package.
 */
export async function purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo | null> {
  if (!isConfigured) {
    console.warn('[Purchases] Cannot purchase — SDK not configured for', Platform.OS);
    return null;
  }
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo;
  } catch (error: any) {
    if (error.userCancelled) {
      console.log('[Purchases] User cancelled purchase');
      return null;
    }
    console.error('[Purchases] Purchase failed:', error);
    throw error;
  }
}

/**
 * Restore purchases (e.g., after reinstall).
 */
export async function restorePurchases(): Promise<CustomerInfo | null> {
  if (!isConfigured) {
    console.warn('[Purchases] Cannot restore — SDK not configured for', Platform.OS);
    return null;
  }
  try {
    return await Purchases.restorePurchases();
  } catch (error) {
    console.error('[Purchases] Restore failed:', error);
    throw error;
  }
}

/**
 * Check if user has a specific entitlement active.
 */
export function hasEntitlement(customerInfo: CustomerInfo, entitlement: string): boolean {
  return typeof customerInfo.entitlements.active[entitlement] !== 'undefined';
}

/**
 * Determine tier from customer info.
 */
export function getTierFromCustomerInfo(customerInfo: CustomerInfo): 'free' | 'plus' | 'pro' {
  if (hasEntitlement(customerInfo, 'pro')) return 'pro';
  if (hasEntitlement(customerInfo, 'plus')) return 'plus';
  return 'free';
}

/**
 * Extract sync data from customer info for backend sync.
 */
export function getSyncData(customerInfo: CustomerInfo) {
  const activeEntitlements = Object.keys(customerInfo.entitlements.active);
  const activeSubscriptions = Object.keys(customerInfo.activeSubscriptions || {});
  const productId = activeSubscriptions[0] || null;

  // Get expiration from first active entitlement
  let expiresAt: number | null = null;
  for (const entitlement of Object.values(customerInfo.entitlements.active)) {
    if (entitlement.expirationDate) {
      expiresAt = new Date(entitlement.expirationDate).getTime();
      break;
    }
  }

  return {
    entitlementIds: activeEntitlements,
    productId,
    expiresAt,
  };
}
