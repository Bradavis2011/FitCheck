import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../controllers/notification.controller.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

router.get('/', getNotifications);
router.put('/:id/read', markNotificationRead);
router.put('/read-all', markAllNotificationsRead);

export default router;
