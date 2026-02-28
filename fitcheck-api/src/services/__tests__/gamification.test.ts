import { describe, it, expect } from 'vitest';
import { getLevelFromPoints } from '../gamification.service.js';

describe('getLevelFromPoints', () => {
  it('0 points → level 1 "Style Newbie", xpToNext = 100', () => {
    const result = getLevelFromPoints(0);
    expect(result.level).toBe(1);
    expect(result.name).toBe('Style Newbie');
    expect(result.xpToNext).toBe(100);
  });

  it('99 points → still level 1, xpToNext = 1', () => {
    const result = getLevelFromPoints(99);
    expect(result.level).toBe(1);
    expect(result.xpToNext).toBe(1);
  });

  it('100 points → level 2 "Fashion Friend", xpToNext = 150', () => {
    const result = getLevelFromPoints(100);
    expect(result.level).toBe(2);
    expect(result.name).toBe('Fashion Friend');
    expect(result.xpToNext).toBe(150); // next threshold is 250
  });

  it('250 points → level 3 "Style Advisor", xpToNext = 250', () => {
    const result = getLevelFromPoints(250);
    expect(result.level).toBe(3);
    expect(result.name).toBe('Style Advisor');
    expect(result.xpToNext).toBe(250); // next threshold is 500
  });

  it('500 points → level 4 "Outfit Expert"', () => {
    const result = getLevelFromPoints(500);
    expect(result.level).toBe(4);
    expect(result.name).toBe('Outfit Expert');
  });

  it('1000 points → level 5 "Trusted Reviewer"', () => {
    const result = getLevelFromPoints(1000);
    expect(result.level).toBe(5);
    expect(result.name).toBe('Trusted Reviewer');
  });

  it('10000 points → level 8 "Legend", xpToNext = 0', () => {
    const result = getLevelFromPoints(10000);
    expect(result.level).toBe(8);
    expect(result.name).toBe('Legend');
    expect(result.xpToNext).toBe(0);
  });

  it('points beyond max level → still level 8, xpToNext = 0', () => {
    const result = getLevelFromPoints(99999);
    expect(result.level).toBe(8);
    expect(result.xpToNext).toBe(0);
  });

  it('exact boundary at level 7 (5000 pts)', () => {
    const result = getLevelFromPoints(5000);
    expect(result.level).toBe(7);
    expect(result.name).toBe('Fashion Icon');
    expect(result.xpToNext).toBe(5000); // next threshold is 10000
  });
});
