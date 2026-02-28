import { describe, it, expect, afterEach } from 'vitest';
import { getAdminUserIds, isAdmin, requireAdmin } from '../admin.js';
import { AppError } from '../../middleware/errorHandler.js';
import type { AuthenticatedRequest } from '../../types/index.js';

const originalEnv = process.env.ADMIN_USER_IDS;

afterEach(() => {
  if (originalEnv === undefined) {
    delete process.env.ADMIN_USER_IDS;
  } else {
    process.env.ADMIN_USER_IDS = originalEnv;
  }
});

describe('getAdminUserIds', () => {
  it('returns multiple IDs when comma-separated', () => {
    process.env.ADMIN_USER_IDS = 'user1,user2,user3';
    expect(getAdminUserIds()).toEqual(['user1', 'user2', 'user3']);
  });

  it('returns a single ID', () => {
    process.env.ADMIN_USER_IDS = 'user1';
    expect(getAdminUserIds()).toEqual(['user1']);
  });

  it('returns empty array when env var is empty string', () => {
    process.env.ADMIN_USER_IDS = '';
    expect(getAdminUserIds()).toEqual([]);
  });

  it('returns empty array when env var is undefined', () => {
    delete process.env.ADMIN_USER_IDS;
    expect(getAdminUserIds()).toEqual([]);
  });

  it('filters out empty segments from trailing commas', () => {
    process.env.ADMIN_USER_IDS = 'user1,,user2,';
    expect(getAdminUserIds()).toEqual(['user1', 'user2']);
  });
});

describe('isAdmin', () => {
  it('returns true for a listed admin user', () => {
    process.env.ADMIN_USER_IDS = 'user1,user2';
    expect(isAdmin('user1')).toBe(true);
    expect(isAdmin('user2')).toBe(true);
  });

  it('returns false for a user not in the list', () => {
    process.env.ADMIN_USER_IDS = 'user1,user2';
    expect(isAdmin('user3')).toBe(false);
  });

  it('returns false when no admin IDs are configured', () => {
    process.env.ADMIN_USER_IDS = '';
    expect(isAdmin('user1')).toBe(false);
  });
});

describe('requireAdmin', () => {
  it('throws AppError(403) for a non-admin userId', () => {
    process.env.ADMIN_USER_IDS = 'admin1';
    const req = { userId: 'regular-user' } as unknown as AuthenticatedRequest;
    expect(() => requireAdmin(req)).toThrow(AppError);
    expect(() => requireAdmin(req)).toThrow('Admin access required');
  });

  it('throws AppError(403) when userId is missing from request', () => {
    process.env.ADMIN_USER_IDS = 'admin1';
    const req = {} as unknown as AuthenticatedRequest;
    let thrown: unknown;
    try { requireAdmin(req); } catch (e) { thrown = e; }
    expect(thrown).toBeInstanceOf(AppError);
    expect((thrown as AppError).statusCode).toBe(403);
  });

  it('does not throw for a valid admin userId', () => {
    process.env.ADMIN_USER_IDS = 'admin1,admin2';
    const req = { userId: 'admin1' } as unknown as AuthenticatedRequest;
    expect(() => requireAdmin(req)).not.toThrow();
  });
});
