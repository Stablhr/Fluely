import {NextFunction, Request, Response} from 'express';
import {accountService} from '../services/account.service';
import {actorFromRequest} from '../utils/actor';
import {ApiError} from '../utils/error';
import {ErrorCodes} from '../constants/errorCodes';

export const accountController = {
  async uploadAvatar(req: Request, res: Response, next: NextFunction) {
    try {
      const actor = actorFromRequest(req);
      const file = req.file;
      if (!file) {
        throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, 'No file was uploaded');
      }
      res.status(200).json(await accountService.uploadAvatar(actor.actorId, file));
    } catch (error) {
      next(error);
    }
  },

  async removeAvatar(_req: Request, res: Response, next: NextFunction) {
    try {
      const actor = actorFromRequest(_req);
      res.status(200).json(await accountService.removeAvatar(actor.actorId));
    } catch (error) {
      next(error);
    }
  }
};