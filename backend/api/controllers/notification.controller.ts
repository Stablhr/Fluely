import {NextFunction, Request, Response} from 'express';
import {notificationService} from '../services/notification.service';
import {actorFromRequest} from '../utils/actor';

export const notificationController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(200).json(await notificationService.list(actorFromRequest(req)));
    } catch (error) {
      next(error);
    }
  },

  async markRead(req: Request, res: Response, next: NextFunction) {
    try {
      res
        .status(200)
        .json(
          await notificationService.markRead(actorFromRequest(req), req.params.notificationId)
        );
    } catch (error) {
      next(error);
    }
  },

  async markAllRead(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(200).json(await notificationService.markAllRead(actorFromRequest(req)));
    } catch (error) {
      next(error);
    }
  }
};
