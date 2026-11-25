import {Request, Response, NextFunction} from 'express';
import mongoose from 'mongoose';
import {ApiError} from '../utils/error';
import {logger} from '../logging/logger';
import {ErrorCodes} from '../constants/errorCodes';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      code: err.code,
      message: err.message,
      details: err.details
    });
  }

  // Two requests saved the same document at once; the later one loses.
  if (err instanceof mongoose.Error.VersionError) {
    return res.status(409).json({
      success: false,
      code: ErrorCodes.REVISION_CONFLICT,
      message: 'This was changed by another request at the same time. Try again.'
    });
  }

  logger.error({err}, 'Unhandled error');
  res.status(500).json({
    success: false,
      code: ErrorCodes.INTERNAL_ERROR,
    message: 'Unexpected error occurred',
    details: 'An unexpected error occurred'
  });
}