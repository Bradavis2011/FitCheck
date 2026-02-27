import { createHash, timingSafeEqual } from 'crypto';

/**
 * Timing-safe string comparison.
 * Hashes both inputs first to normalize lengths, preventing oracle attacks.
 */
export function safeTokenEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}
