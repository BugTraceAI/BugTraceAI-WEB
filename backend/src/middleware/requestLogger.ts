import morgan from 'morgan';
import { Request } from 'express';

/**
 * Development logger with emoji and detailed info
 */
export const developmentLogger = morgan(
  ':method :url :status :response-time ms - :res[content-length] bytes',
  {
    skip: (req: Request) => req.path === '/health',
  }
);

/**
 * Production logger with Apache combined format
 */
export const productionLogger = morgan('combined', {
  skip: (req: Request) => req.path === '/health',
});
