import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ApiError } from './errorHandler.js';

/**
 * Validate request data against a Zod schema
 * @param schema - Zod schema to validate against
 * @param target - Which part of the request to validate ('body', 'query', 'params')
 */
export function validate(
  schema: ZodSchema,
  target: 'body' | 'query' | 'params' = 'body'
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Validate and parse the target data
      const validated = schema.parse(req[target]);

      // Replace the target with validated data
      req[target] = validated;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Format Zod errors for response
        const details = error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));

        res.status(400).json({
          success: false,
          error: {
            message: 'Validation error',
            statusCode: 400,
            timestamp: new Date().toISOString(),
            path: req.path,
            details,
          },
        });
        return;
      }
      next(error);
    }
  };
}

/**
 * Validate UUID parameter
 * @param paramName - Name of the parameter to validate
 */
export function validateUuid(paramName: string) {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  return (req: Request, _res: Response, next: NextFunction): void => {
    const paramValue = req.params[paramName] as string;

    if (!paramValue || !uuidRegex.test(paramValue)) {
      throw new ApiError(400, `Invalid UUID format for parameter: ${paramName}`);
    }

    next();
  };
}
