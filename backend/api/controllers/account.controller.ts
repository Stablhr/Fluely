import {NextFunction, Request, Response} from 'express';
import {accountService} from '../services/account.service';
import {actorFromRequest} from '../utils/actor';
import {ApiError} from '../utils/error';
import {ErrorCodes} from '../constants/errorCodes';
import {Types} from 'mongoose';

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
  },

  async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const actor = actorFromRequest(req);
      res.status(200).json(await accountService.getProfile(actor.actorId));
    } catch (error) {
      next(error);
    }
  },

  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const actor = actorFromRequest(req);
      res.status(200).json(await accountService.updateProfile(actor.actorId, req.body));
    } catch (error) {
      next(error);
    }
  },

  async checkUsernameAvailable(req: Request, res: Response, next: NextFunction) {
    try {
      const actor = actorFromRequest(req);
      const username = String(req.query.u ?? '');
      const available = await accountService.isUsernameAvailable(username, actor.actorId);
      res.status(200).json({available});
    } catch (error) {
      next(error);
    }
  },

  async getPublicProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const actor = actorFromRequest(req);
      const targetId = new Types.ObjectId(req.params.userId);
      const boardId = typeof req.query.boardId === 'string' ? req.query.boardId : undefined;
      res.status(200).json(await accountService.getPublicProfile(actor.actorId, targetId, boardId));
    } catch (error) {
      next(error);
    }
  }
};