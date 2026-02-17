// Session-based outfit check counter for interstitial ad frequency.
// Counter resets on app restart (no persistence — desired behavior).

let outfitCheckCount = 0;

/**
 * Call when a new outfit analysis completes for a free-tier user.
 * Returns true if an interstitial ad should be shown (every 2nd new check).
 */
export function recordOutfitCheck(): boolean {
  outfitCheckCount += 1;
  return outfitCheckCount % 2 === 0;
}
