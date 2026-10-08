import {NextFunction, Request, Response} from 'express';
import {activityService} from '../services/activity.service';
import {ApiError} from '../utils/error';
import {ErrorCodes} from '../constants/errorCodes';
import {Types} from 'mongoose';

/** Shape produced by `validateRequest({query: activityQuerySchema})`. */
type ActivityQuery = {
  page: number;
  limit: number;
  type?: string;
};

export const activityController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.board) {
        throw new ApiError(404, ErrorCodes.BOARD_NOT_FOUND, 'Board not found');
      }
      const query = req.query as unknown as ActivityQuery;
      const activity = await activityService.list(req.board._id as Types.ObjectId, {
        page: query.page,
        limit: query.limit,
        actionType: query.type
      });
      res.status(200).json({activity, page: query.page, limit: query.limit});
    } catch (error) {
      next(error);
    }
  }
};
