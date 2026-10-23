import {NextFunction, Request, Response} from 'express';
import {cleanupDoneCards} from '../services/cleanup.service';
import {env} from '../config/env';
import {ApiError} from '../utils/error';
import {ErrorCodes} from '../constants/errorCodes';

export const cronController = {
  async cleanupDoneCards(req: Request, res: Response, next: NextFunction) {
    try {
      // Vercel cron sends `Authorization: Bearer <CRON_SECRET>` when the env
      // var is set. Allow local dev (no secret) to call it too.
      if (env.CRON_SECRET) {
        const auth = req.headers.authorization ?? '';
        if (auth !== `Bearer ${env.CRON_SECRET}`) {
          throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Invalid cron secret');
        }
      }
      const result = await cleanupDoneCards();
      res.status(200).json({success: true, ...result});
    } catch (error) {
      next(error);
    }
  }
};