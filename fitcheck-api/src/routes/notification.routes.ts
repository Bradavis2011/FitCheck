import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../controllers/notification.controller.js';
import { GetNotificationsQuerySchema } from '../schemas/index.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

router.get('/', validateRequest({ query: GetNotificationsQuerySchema }), asyncHandler(getNotifications));
router.put('/:id/read', asyncHandler(markNotificationRead));
router.put('/read-all', asyncHandler(markAllNotificationsRead));

export default router;
