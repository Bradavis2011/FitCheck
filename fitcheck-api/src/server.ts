import * as Sentry from '@sentry/node';
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import path from 'path';
import morgan from 'morgan';
import { limiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import outfitRoutes from './routes/outfit.routes.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import socialRoutes from './routes/social.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import pushRoutes from './routes/push.routes.js';
import subscriptionRoutes from './routes/subscription.routes.js';
import comparisonRoutes from './routes/comparison.routes.js';
// LAUNCH: hidden until user base grows
// import liveRoutes from './routes/live.routes.js';
// import stylistRoutes from './routes/stylist.routes.js';
// import expertReviewRoutes from './routes/expert-review.routes.js';
// import challengeRoutes from './routes/challenge.routes.js';
import wardrobeRoutes from './routes/wardrobe.routes.js';
import waitlistRoutes from './routes/waitlist.routes.js';
// import eventRoutes from './routes/event.routes.js';
import { handleWebhook } from './controllers/subscription.controller.js';
import { asyncHandler } from './middleware/asyncHandler.js';
import { isConfigured as isS3Configured } from './services/s3.service.js';
// LAUNCH: Socket.io disabled until live streaming is re-enabled
// import { initializeSocketService } from './services/socket.service.js';
import { initializeScheduler } from './services/scheduler.service.js';
import { shutdownPostHog } from './lib/posthog.js';
import adminRoutes from './routes/admin.routes.js';
import agentAdminRoutes from './routes/agent-admin.routes.js';

// Load environment variables
dotenv.config();

// Initialize Sentry before any middleware (only if DSN configured)
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
    beforeSend(event, hint) {
      const err = hint?.originalException;
      if (err && typeof err === 'object' && 'status' in err) {
        const status = (err as any).status;
        if (typeof status === 'number' && status < 500) return null;
      }
      return event;
    },
  });
  console.log('🔍 Sentry initialized');
}

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3000;

// Serve dashboard static files BEFORE helmet so CDN resources aren't blocked by CSP
// __dirname is the compiled dist/ directory, so ../public = fitcheck-api/public/
app.use(express.static(path.join(__dirname, '..', 'public')));

// Trust proxy - 1 hop (Railway's load balancer). Using true is too permissive for rate limiting.
app.set('trust proxy', 1);

// Security headers
app.use(helmet());

// Request logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// CORS - smart origin handling
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins.length > 0
    ? allowedOrigins
    : (process.env.NODE_ENV === 'production' ? false : '*'),
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// RevenueCat webhook (before rate limiter - RevenueCat may send bursts)
app.post('/api/webhooks/revenuecat', asyncHandler(handleWebhook));

// Rate limiting
app.use('/api', limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/outfits', outfitRoutes);
app.use('/api/user', userRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/comparisons', comparisonRoutes);
// LAUNCH: disabled routes — re-enable as user base grows
// app.use('/api/live', liveRoutes);
// app.use('/api/stylists', stylistRoutes);
// app.use('/api/expert-reviews', expertReviewRoutes);
// app.use('/api/challenges', challengeRoutes);
app.use('/api/wardrobe', wardrobeRoutes);
app.use('/api/waitlist', waitlistRoutes);
// app.use('/api/events', eventRoutes);
app.use('/api', subscriptionRoutes);
app.use('/api/admin/agents', agentAdminRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler (must be last)
app.use(errorHandler);

// LAUNCH: Socket.io disabled until live streaming is re-enabled
// initializeSocketService(httpServer);

// Initialize cron scheduler (gated by ENABLE_CRON=true)
initializeScheduler();

// Start server
httpServer.listen(PORT, () => {
  console.log(`🚀 Or This? API server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);

  // Image storage status
  if (isS3Configured()) {
    console.log(`☁️  S3 configured - images will be stored in: ${process.env.AWS_S3_BUCKET}`);
  } else {
    console.log(`⚠️  S3 not configured - using base64 fallback (not recommended for production)`);
    console.log(`   Set AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET to enable cloud storage`);
  }
});

// Graceful shutdown — flush PostHog before exit
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received — flushing analytics...');
  await shutdownPostHog();
  process.exit(0);
});

export default app;
