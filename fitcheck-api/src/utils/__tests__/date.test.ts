import { describe, it, expect } from 'vitest';
import { getWeekNumber } from '../date.js';

// getWeekNumber now uses UTC getters throughout, so ISO date strings
// (which parse as UTC midnight) give correct, timezone-independent results.

describe('getWeekNumber', () => {
  it('2026-01-01 (Thursday) is ISO week 1', () => {
    expect(getWeekNumber(new Date('2026-01-01'))).toBe(1);
  });

  it('2025-12-29 (Monday) is ISO week 1 — belongs to ISO year 2026', () => {
    // The first ISO week of 2026 starts on Mon Dec 29, 2025
    expect(getWeekNumber(new Date('2025-12-29'))).toBe(1);
  });

  it('2026-01-05 (Monday) is ISO week 2', () => {
    expect(getWeekNumber(new Date('2026-01-05'))).toBe(2);
  });

  it('2026-07-01 (Wednesday) is ISO week 27', () => {
    expect(getWeekNumber(new Date('2026-07-01'))).toBe(27);
  });

  it('2026-12-31 (Thursday) is ISO week 53 — 2026 is a long year starting on Thursday', () => {
    expect(getWeekNumber(new Date('2026-12-31'))).toBe(53);
  });

  it('2024-01-01 (Monday) is ISO week 1', () => {
    expect(getWeekNumber(new Date('2024-01-01'))).toBe(1);
  });

  it('2024-12-28 (Saturday) is ISO week 52', () => {
    expect(getWeekNumber(new Date('2024-12-28'))).toBe(52);
  });
});
