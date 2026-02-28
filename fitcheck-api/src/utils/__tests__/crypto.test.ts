import { describe, it, expect } from 'vitest';
import { safeTokenEqual } from '../crypto.js';

describe('safeTokenEqual', () => {
  it('returns true for equal strings', () => {
    expect(safeTokenEqual('abc123', 'abc123')).toBe(true);
  });

  it('returns false for different strings', () => {
    expect(safeTokenEqual('abc123', 'xyz789')).toBe(false);
  });

  it('returns true when both strings are empty', () => {
    expect(safeTokenEqual('', '')).toBe(true);
  });

  it('returns false when one string is empty and the other is not', () => {
    expect(safeTokenEqual('abc', '')).toBe(false);
    expect(safeTokenEqual('', 'abc')).toBe(false);
  });

  it('is case-sensitive', () => {
    expect(safeTokenEqual('ABC', 'abc')).toBe(false);
  });

  it('handles long tokens', () => {
    const token = 'x'.repeat(256);
    expect(safeTokenEqual(token, token)).toBe(true);
    expect(safeTokenEqual(token, token + 'y')).toBe(false);
  });
});
