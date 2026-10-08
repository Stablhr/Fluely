import {NextFunction, Request, Response} from 'express';
import {listService} from '../services/list.service';
import {actorFromRequest} from '../utils/actor';
import {ApiError} from '../utils/error';
import {ErrorCodes} from '../constants/errorCodes';

/**
 * The access middleware populates both before a handler runs; treating a missing
 * board as "not found" keeps a mis-ordered route from silently skipping the
 * permission check.
 */
function requireBoard(req: Request) {
  if (!req.board) {
    throw new ApiError(404, ErrorCodes.BOARD_NOT_FOUND, 'Board not found');
  }
  return req.board;
}

export const listController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(200).json({lists: await listService.list(requireBoard(req))});
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      res
        .status(201)
        .json(
          await listService.create(actorFromRequest(req), requireBoard(req), req.body)
        );
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(200).json(
        await listService.update(
          actorFromRequest(req),
          requireBoard(req),
          req.params.listId,
          req.body
        )
      );
    } catch (error) {
      next(error);
    }
  },

  async reorder(req: Request, res: Response, next: NextFunction) {
    try {
      const {listOrder, expectedRevision} = req.body;
      res
        .status(200)
        .json(
          await listService.reorder(
            actorFromRequest(req),
            requireBoard(req),
            listOrder,
            expectedRevision
          )
        );
    } catch (error) {
      next(error);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const {expectedRevision} = req.query as {expectedRevision?: string};
      res
        .status(200)
        .json(
          await listService.remove(
            actorFromRequest(req),
            requireBoard(req),
            req.params.listId,
            expectedRevision ? Number(expectedRevision) : undefined
          )
        );
    } catch (error) {
      next(error);
    }
  }
};
