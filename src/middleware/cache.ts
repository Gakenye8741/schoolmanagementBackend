import { Request, Response, NextFunction } from 'express';
import NodeCache from 'node-cache';

// Initialize cache with a default TTL of 5 minutes (300 seconds) and check period for expired items
export const appCache = new NodeCache({ stdTTL: 300, checkperiod: 600 });

/**
 * Express Caching Middleware for GET Requests
 * Automatically caches successful responses and serves them instantly on subsequent hits.
 * 
 * @param duration Time-to-live (TTL) for the cache in seconds
 */
export const cacheMiddleware = (duration: number = 300) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Only cache GET requests to prevent mutating sensitive state data
    if (req.method !== 'GET') {
      return next();
    }

    // Generate a unique cache key using the full request URL and query parameters
    const cacheKey = `cache_${req.originalUrl || req.url}`;
    const cachedData = appCache.get(cacheKey);

    if (cachedData) {
      res.status(200).json({
        ...(cachedData as object),
        source: 'cache',
      });
      return;
    }

    // Intercept res.json to capture and store the payload before sending to client
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      // Only cache successful status responses (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        appCache.set(cacheKey, body, duration);
      }
      return originalJson(body);
    };

    next();
  };
};

/**
 * Utility to clear specific cache entries or pattern groups (e.g., when records are updated or deleted).
 * @param keyPattern String fragment to match against cached keys (e.g., "/api/students")
 */
export const invalidateCache = (keyPattern: string): void => {
  const keys = appCache.keys();
  const matchedKeys = keys.filter((key) => key.includes(keyPattern));
  
  if (matchedKeys.length > 0) {
    appCache.del(matchedKeys);
  }
};

/**
 * Utility to completely flush all cached data across the application.
 */
export const clearAllCache = (): void => {
  appCache.flushAll();
};