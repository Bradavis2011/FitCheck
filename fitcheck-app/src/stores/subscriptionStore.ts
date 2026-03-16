import { create } from 'zustand';
import type { CustomerInfo, PurchasesOfferings, PurchasesPackage } from 'react-native-purchases';
import * as purchasesService from '../services/purchases.service';
import { subscriptionService } from '../services/api.service';

interface SubscriptionState {
  tier: 'free' | 'plus' | 'pro';
  isLoaded: boolean;
  offerings: PurchasesOfferings | null;
  customerInfo: CustomerInfo | null;

  // Micro-monetization
  sessionExpiresAt: Date | null;  // active session pass expiry
  creditsRemaining: number;       // consumable check credits

  // Derived
  isSessionActive: boolean;       // sessionExpiresAt > now

  // Derived limits (from backend)
  limits: {
    dailyChecks: number;
    followUpsPerCheck: number;
    historyDays: number;
    hasAds: boolean;
  } | null;

  // Actions
  initialize: (userId: string) => Promise<void>;
  refreshCustomerInfo: () => Promise<void>;
  loadOfferings: () => Promise<void>;
  purchase: (pkg: PurchasesPackage) => Promise<boolean>;
  restore: () => Promise<boolean>;
  syncWithBackend: () => Promise<void>;
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  tier: 'free',
  isLoaded: false,
  offerings: null,
  customerInfo: null,
  sessionExpiresAt: null,
  creditsRemaining: 0,
  isSessionActive: false,
  limits: null,

  initialize: async (userId: string) => {
    try {
      await purchasesService.initializePurchases(userId);
      const customerInfo = await purchasesService.getCustomerInfo();

      if (customerInfo) {
        const tier = purchasesService.getTierFromCustomerInfo(customerInfo);
        set({ tier, customerInfo, isLoaded: true });

        // Sync with backend
        await get().syncWithBackend();
      } else {
        // RevenueCat unavailable (Expo Go) or no subscription found —
        // fall back to backend as source of truth
        try {
          const status = await subscriptionService.getSubscriptionStatus();
          const sessionExpiresAt = status.sessionExpiresAt ? new Date(status.sessionExpiresAt) : null;
          set({
            tier: (status.tier as 'free' | 'plus' | 'pro') || 'free',
            limits: status.limits,
            sessionExpiresAt,
            creditsRemaining: status.creditsRemaining ?? 0,
            isSessionActive: sessionExpiresAt != null && sessionExpiresAt > new Date(),
            isLoaded: true,
          });
        } catch {
          set({ isLoaded: true });
        }
      }
    } catch (error) {
      console.error('[SubscriptionStore] Init failed:', error);
      set({ isLoaded: true }); // still mark as loaded so app doesn't hang
    }
  },

  refreshCustomerInfo: async () => {
    const customerInfo = await purchasesService.getCustomerInfo();
    if (customerInfo) {
      const tier = purchasesService.getTierFromCustomerInfo(customerInfo);
      set({ tier, customerInfo });
    }
  },

  loadOfferings: async () => {
    const offerings = await purchasesService.getOfferings();
    set({ offerings });
  },

  purchase: async (pkg: PurchasesPackage) => {
    const customerInfo = await purchasesService.purchasePackage(pkg);
    if (customerInfo) {
      const tier = purchasesService.getTierFromCustomerInfo(customerInfo);
      set({ tier, customerInfo });
      await get().syncWithBackend();
      return true;
    }
    return false;
  },

  restore: async () => {
    const customerInfo = await purchasesService.restorePurchases();
    if (customerInfo) {
      const tier = purchasesService.getTierFromCustomerInfo(customerInfo);
      set({ tier, customerInfo });
      await get().syncWithBackend();
      return true;
    }
    return false;
  },

  syncWithBackend: async () => {
    try {
      const { customerInfo } = get();
      if (customerInfo) {
        const syncData = purchasesService.getSyncData(customerInfo);
        const result = await subscriptionService.syncSubscription(syncData);
        // RC customerInfo is the freshest source of truth for tier.
        // Only adopt the backend result if it's a promotion (not a demotion),
        // to guard against entitlement name mismatches causing false downgrades.
        const tierRank = { free: 0, plus: 1, pro: 2 };
        const currentTier = get().tier;
        const backendTier = result.tier as 'free' | 'plus' | 'pro';
        if (tierRank[backendTier] > tierRank[currentTier]) {
          set({ tier: backendTier });
        } else if (tierRank[backendTier] < tierRank[currentTier]) {
          console.warn(
            `[SubscriptionStore] Backend returned lower tier (${backendTier}) than RC (${currentTier}) — keeping RC value. Check entitlement names in RevenueCat dashboard.`,
          );
        }
      }
      // Always fetch limits from backend regardless of RC state
      const status = await subscriptionService.getSubscriptionStatus();
      const sessionExpiresAt = status.sessionExpiresAt ? new Date(status.sessionExpiresAt) : null;
      const isSessionActive = sessionExpiresAt != null && sessionExpiresAt > new Date();
      set({
        limits: status.limits,
        sessionExpiresAt,
        creditsRemaining: status.creditsRemaining ?? 0,
        isSessionActive,
      });
    } catch (error) {
      console.error('[SubscriptionStore] Backend sync failed:', error);
    }
  },
}));
