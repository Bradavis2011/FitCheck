import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../types/index.js';

const mockNotificationFindMany = vi.hoisted(() => vi.fn());
const mockNotificationCount = vi.hoisted(() => vi.fn());
const mockNotificationFindFirst = vi.hoisted(() => vi.fn());
const mockNotificationUpdate = vi.hoisted(() => vi.fn());
const mockNotificationUpdateMany = vi.hoisted(() => vi.fn());
const mockNotificationCreate = vi.hoisted(() => vi.fn());
const mockSendPushNotification = vi.hoisted(() => vi.fn());

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    notification: {
      findMany: mockNotificationFindMany,
      count: mockNotificationCount,
      findFirst: mockNotificationFindFirst,
      update: mockNotificationUpdate,
      updateMany: mockNotificationUpdateMany,
      create: mockNotificationCreate,
    },
  },
}));

vi.mock('../../services/push.service.js', () => ({
  pushService: { sendPushNotification: mockSendPushNotification },
}));

import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  createNotification,
} from '../notification.controller.js';

function makeReq(overrides: Partial<AuthenticatedRequest> = {}): AuthenticatedRequest {
  return { userId: 'user-1', body: {}, params: {}, query: {}, ...overrides } as unknown as AuthenticatedRequest;
}

function makeRes() {
  const json = vi.fn();
  return { res: { json } as unknown as Response, json };
}

beforeEach(() => {
  mockNotificationFindMany.mockReset();
  mockNotificationCount.mockReset();
  mockNotificationFindFirst.mockReset();
  mockNotificationUpdate.mockReset();
  mockNotificationUpdateMany.mockReset();
  mockNotificationCreate.mockReset();
  mockSendPushNotification.mockReset();
});

// ─── getNotifications ─────────────────────────────────────────────────────────

describe('getNotifications', () => {
  it('returns notifications and unread count', async () => {
    const fakeNotifications = [{ id: 'n-1', type: 'follow', isRead: false }];
    mockNotificationFindMany.mockResolvedValue(fakeNotifications);
    mockNotificationCount.mockResolvedValue(2);

    const req = makeReq({ query: { limit: 20, offset: 0, unreadOnly: 'false' } as any });
    const { res, json } = makeRes();

    await getNotifications(req, res);

    expect(json).toHaveBeenCalledWith({ notifications: fakeNotifications, unreadCount: 2 });
  });

  it('adds isRead: false filter when unreadOnly is true', async () => {
    mockNotificationFindMany.mockResolvedValue([]);
    mockNotificationCount.mockResolvedValue(0);

    const req = makeReq({ query: { limit: 10, offset: 0, unreadOnly: 'true' } as any });
    const { res } = makeRes();

    await getNotifications(req, res);

    expect(mockNotificationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isRead: false }) }),
    );
  });

  it('does not add isRead filter when unreadOnly is false', async () => {
    mockNotificationFindMany.mockResolvedValue([]);
    mockNotificationCount.mockResolvedValue(0);

    const req = makeReq({ query: { limit: 10, offset: 0, unreadOnly: 'false' } as any });
    const { res } = makeRes();

    await getNotifications(req, res);

    const where = mockNotificationFindMany.mock.calls[0][0].where;
    expect(where).not.toHaveProperty('isRead');
  });
});

// ─── markNotificationRead ─────────────────────────────────────────────────────

describe('markNotificationRead', () => {
  it('throws AppError(404) when notification does not belong to user', async () => {
    mockNotificationFindFirst.mockResolvedValue(null);
    const req = makeReq({ params: { id: 'n-999' } });
    const { res } = makeRes();
    await expect(markNotificationRead(req, res)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Notification not found',
    });
    expect(mockNotificationUpdate).not.toHaveBeenCalled();
  });

  it('marks notification as read and returns success', async () => {
    mockNotificationFindFirst.mockResolvedValue({ id: 'n-1', userId: 'user-1' });
    mockNotificationUpdate.mockResolvedValue({});

    const req = makeReq({ params: { id: 'n-1' } });
    const { res, json } = makeRes();

    await markNotificationRead(req, res);

    expect(mockNotificationUpdate).toHaveBeenCalledWith({
      where: { id: 'n-1' },
      data: { isRead: true },
    });
    expect(json).toHaveBeenCalledWith({ success: true });
  });
});

// ─── markAllNotificationsRead ─────────────────────────────────────────────────

describe('markAllNotificationsRead', () => {
  it('bulk-marks all unread notifications and returns success', async () => {
    mockNotificationUpdateMany.mockResolvedValue({ count: 5 });
    const req = makeReq();
    const { res, json } = makeRes();

    await markAllNotificationsRead(req, res);

    expect(mockNotificationUpdateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', isRead: false },
      data: { isRead: true },
    });
    expect(json).toHaveBeenCalledWith({ success: true });
  });
});

// ─── createNotification ───────────────────────────────────────────────────────

describe('createNotification', () => {
  it('creates a DB record and sends a push notification', async () => {
    mockNotificationCreate.mockResolvedValue({});
    mockSendPushNotification.mockResolvedValue({});

    await createNotification({
      userId: 'user-1',
      type: 'feedback',
      title: 'New Feedback',
      body: 'Someone gave you feedback',
      linkType: 'outfit',
      linkId: 'outfit-42',
    });

    expect(mockNotificationCreate).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        type: 'feedback',
        title: 'New Feedback',
        body: 'Someone gave you feedback',
        linkType: 'outfit',
        linkId: 'outfit-42',
      },
    });
    expect(mockSendPushNotification).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ title: 'New Feedback', body: 'Someone gave you feedback' }),
    );
  });

  it('swallows errors silently (non-fatal)', async () => {
    mockNotificationCreate.mockRejectedValue(new Error('DB down'));
    // Should not throw
    await expect(createNotification({ userId: 'u', type: 't', title: 'T', body: 'B' })).resolves.toBeUndefined();
  });
});
