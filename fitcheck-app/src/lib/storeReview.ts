import * as SecureStore from 'expo-secure-store';
import { track } from './analytics';

let StoreReview: any = null;
try { StoreReview = require('expo-store-review'); } catch {}

const REVIEW_KEY = 'orthis_store_review_last_prompted';
const COOLDOWN_DAYS = 90;  // Apple allows 3/year — 90 days between our attempts
const MIN_OUTFITS = 2;     // By 2nd check they understand the value

export async function maybeRequestReview(opts: {
  trigger: 'helpful_positive' | 'score_shared' | 'outfit_completed' | 'profile_manual';
  score?: number;
  totalOutfits: number;
}): Promise<void> {
  try {
    if (!StoreReview) return;
    if (!(await StoreReview.isAvailableAsync())) return;

    // Profile manual bypasses outfit threshold and cooldown
    if (opts.trigger !== 'profile_manual') {
      if (opts.totalOutfits < MIN_OUTFITS) return;

      const last = await SecureStore.getItemAsync(REVIEW_KEY);
      if (last) {
        const days = (Date.now() - parseInt(last, 10)) / (1000 * 60 * 60 * 24);
        if (days < COOLDOWN_DAYS) return;
      }
    }

    // Record + track + fire
    await SecureStore.setItemAsync(REVIEW_KEY, String(Date.now()));
    track('store_review_prompted', {
      trigger: opts.trigger,
      score: opts.score,
      total_outfits: opts.totalOutfits,
    });

    setTimeout(() => {
      try { StoreReview.requestReview(); } catch {}
    }, 500);
  } catch {
    // Never crash the app over a review prompt
  }
}
