import { Request, Response, NextFunction } from 'express';

export const logger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl || req.url;
  const ip = req.ip || req.socket.remoteAddress || 'Unknown';

  // Listen for the response to finish to capture duration and final status code
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;

    // Status indicator logic for quick visual parsing
    let statusEmoji = '🟢';
    if (statusCode >= 500) {
      statusEmoji = '🔴'; // Server Error
    } else if (statusCode >= 400) {
      statusEmoji = '🟡'; // Client/Validation Error
    } else if (statusCode >= 300) {
      statusEmoji = '🔵'; // Redirection
    }

    console.log(
      `[${timestamp}] ${statusEmoji} ${method} ${url} | Status: ${statusCode} | Duration: ${duration}ms | IP: ${ip}`
    );
  });

  next();
};