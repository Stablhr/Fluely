import {NextFunction, Request, Response} from 'express';
import {cleanupDoneCards} from '../services/cleanup.service';
import {env} from '../config/env';
import {ApiError} from '../utils/error';
import {ErrorCodes} from '../constants/errorCodes';
import {constantTimeEqual} from '../utils/crypto';

export const cronController = {
  async cleanupDoneCards(req: Request, res: Response, next: NextFunction) {
    try {
      // Vercel cron sends `Authorization: Bearer <CRON_SECRET>`. Without a
      // secret the endpoint is open only in local development.
      const allowed = env.CRON_SECRET
        ? constantTimeEqual(req.headers.authorization ?? '', `Bearer ${env.CRON_SECRET}`)
        : env.NODE_ENV !== 'production';
      if (!allowed) {
        throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Invalid cron secret');
      }
      const result = await cleanupDoneCards();
      res.status(200).json({success: true, ...result});
    } catch (error) {
      next(error);
    }
  }
};