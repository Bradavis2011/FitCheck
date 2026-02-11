import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  createSession,
  startSession,
  endSession,
  getActiveSessions,
  getSession,
  getSessionToken,
  getSessionMessages,
  analyzeSession,
} from '../controllers/live.controller.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Session management
router.post('/sessions', asyncHandler(createSession));
router.get('/sessions/active', asyncHandler(getActiveSessions));
router.get('/sessions/:id', asyncHandler(getSession));
router.post('/sessions/:id/start', asyncHandler(startSession));
router.post('/sessions/:id/end', asyncHandler(endSession));

// LiveKit token
router.get('/sessions/:id/token', asyncHandler(getSessionToken));

// Chat
router.get('/sessions/:id/messages', asyncHandler(getSessionMessages));

// AI analysis
router.post('/sessions/:id/analyze', asyncHandler(analyzeSession));

export default router;
