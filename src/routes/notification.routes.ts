import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../controllers/notification.controller.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

router.get('/', asyncHandler(getNotifications));
router.put('/:id/read', asyncHandler(markNotificationRead));
router.put('/read-all', asyncHandler(markAllNotificationsRead));

export default router;
