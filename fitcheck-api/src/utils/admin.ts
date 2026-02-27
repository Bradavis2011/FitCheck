import { AuthenticatedRequest } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';

export function getAdminUserIds(): string[] {
  return (process.env.ADMIN_USER_IDS || '').split(',').filter(Boolean);
}

export function isAdmin(userId: string): boolean {
  return getAdminUserIds().includes(userId);
}

export function requireAdmin(req: AuthenticatedRequest): void {
  const userId = req.userId;
  if (!userId || !isAdmin(userId)) {
    throw new AppError(403, 'Admin access required');
  }
}
