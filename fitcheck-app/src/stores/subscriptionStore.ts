import { create } from 'zustand';
import { CustomerInfo, PurchasesOfferings, PurchasesPackage } from 'react-native-purchases';
import * as purchasesService from '../services/purchases.service';
import { subscriptionService } from '../services/api.service';

interface SubscriptionState {
  tier: 'free' | 'plus' | 'pro';
  isLoaded: boolean;
  offerings: PurchasesOfferings | null;
  customerInfo: CustomerInfo | null;

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
        set({ isLoaded: true });
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
    const { customerInfo } = get();
    if (!customerInfo) return;

    try {
      const syncData = purchasesService.getSyncData(customerInfo);
      const result = await subscriptionService.syncSubscription(syncData);

      // Also fetch limits from backend
      const status = await subscriptionService.getSubscriptionStatus();
      set({
        tier: result.tier as 'free' | 'plus' | 'pro',
        limits: status.limits,
      });
    } catch (error) {
      console.error('[SubscriptionStore] Backend sync failed:', error);
      // Non-fatal: RevenueCat state is still authoritative on client
    }
  },
}));
