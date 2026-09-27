import {Request, Response} from 'express';
import {ErrorCodes} from '../constants/errorCodes';

/**
 * Terminal handler for requests that matched no route. Mounted after all
 * routers and before `errorHandler` so every miss still returns the standard
 * JSON error envelope instead of Express's default HTML response.
 */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    code: ErrorCodes.NOT_FOUND,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
}
