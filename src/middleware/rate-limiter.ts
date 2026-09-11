import rateLimit from 'express-rate-limit';

/**
 * General API Rate Limiter
 * Limits each IP to 100 requests per 15-minute window across general API routes.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    success: false,
    message: "Too many requests from this device or network, please try again after 15 minutes.",
  },
});

/**
 * Strict Auth Rate Limiter
 * Prevents brute-force attacks on sensitive endpoints like login and registration.
 * Limits each IP to 10 requests per 15-minute window.
 */
export const authLimiter = rateLimit({
  windowMs: 0 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login or authentication attempts. For security reasons, please wait 15 minutes before trying again.",
  },
});

/**
 * Heavy Write / Action Rate Limiter
 * Limits resource-heavy operations (like mass notifications, report generation, or submissions)
 * to 30 requests per 15 minutes per IP.
 */
export const writeActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "You are performing this action too frequently. Please slow down and try again shortly.",
  },
});