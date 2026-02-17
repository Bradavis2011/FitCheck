export const TIER_LIMITS = {
  free: {
    dailyChecks: 3,
    followUpsPerCheck: 3,
    historyDays: 7,
    expertReviewsPerMonth: 0,
    hasAds: true,
    hasPriorityProcessing: false,
  },
  plus: {
    dailyChecks: Infinity,
    followUpsPerCheck: 5,
    historyDays: Infinity,
    expertReviewsPerMonth: 0, // a la carte only
    hasAds: false,
    hasPriorityProcessing: true,
  },
  pro: {
    dailyChecks: Infinity,
    followUpsPerCheck: 10,
    historyDays: Infinity,
    expertReviewsPerMonth: 5,
    hasAds: false,
    hasPriorityProcessing: true,
  },
} as const;

export type TierName = keyof typeof TIER_LIMITS;

export function getTierLimits(tier: string) {
  return TIER_LIMITS[tier as TierName] || TIER_LIMITS.free;
}

// Map RevenueCat entitlements to our tier names
export function entitlementToTier(entitlementIds: string[]): TierName {
  if (entitlementIds.includes('pro')) return 'pro';
  if (entitlementIds.includes('plus')) return 'plus';
  return 'free';
}
