import { describe, it, expect } from 'vitest';
import { getTierLimits, entitlementToTier, TIER_LIMITS } from '../tiers.js';

describe('getTierLimits', () => {
  it('returns free tier limits for "free"', () => {
    const limits = getTierLimits('free');
    expect(limits).toEqual(TIER_LIMITS.free);
    expect(limits.dailyChecks).toBe(3);
    expect(limits.hasAds).toBe(true);
  });

  it('returns plus tier limits for "plus"', () => {
    const limits = getTierLimits('plus');
    expect(limits).toEqual(TIER_LIMITS.plus);
    expect(limits.dailyChecks).toBe(Infinity);
    expect(limits.hasAds).toBe(false);
    expect(limits.hasPriorityProcessing).toBe(true);
  });

  it('returns pro tier limits for "pro"', () => {
    const limits = getTierLimits('pro');
    expect(limits).toEqual(TIER_LIMITS.pro);
    expect(limits.expertReviewsPerMonth).toBe(5);
    expect(limits.followUpsPerCheck).toBe(10);
  });

  it('falls back to free limits for an unknown tier', () => {
    expect(getTierLimits('enterprise')).toEqual(TIER_LIMITS.free);
    expect(getTierLimits('')).toEqual(TIER_LIMITS.free);
    expect(getTierLimits('PLUS')).toEqual(TIER_LIMITS.free); // case-sensitive
  });
});

describe('entitlementToTier', () => {
  it('returns "pro" for ["pro"]', () => {
    expect(entitlementToTier(['pro'])).toBe('pro');
  });

  it('returns "plus" for ["plus"]', () => {
    expect(entitlementToTier(['plus'])).toBe('plus');
  });

  it('returns "free" for an unrecognised entitlement', () => {
    expect(entitlementToTier(['unknown'])).toBe('free');
  });

  it('returns "free" for an empty array', () => {
    expect(entitlementToTier([])).toBe('free');
  });

  it('"pro" wins when both "pro" and "plus" are present', () => {
    expect(entitlementToTier(['pro', 'plus'])).toBe('pro');
    expect(entitlementToTier(['plus', 'pro'])).toBe('pro');
  });

  it('returns "plus" when only "plus" is active alongside an unknown entitlement', () => {
    expect(entitlementToTier(['plus', 'unknown'])).toBe('plus');
  });
});
