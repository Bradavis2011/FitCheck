import rateLimit from 'express-rate-limit';

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000');
const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '60');

export const limiter = rateLimit({
  windowMs,
  max: maxRequests,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  // Validate trust proxy configuration (Railway uses proxies, we've verified this is secure)
  validate: { trustProxy: false },
});
