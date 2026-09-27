import {NextFunction, Request, Response} from 'express';
import {boardService} from '../services/board.service';
import {actorFromRequest} from '../utils/actor';
import {ApiError} from '../utils/error';
import {ErrorCodes} from '../constants/errorCodes';
import {BoardVisibility} from '../constants/product';

/** Shape produced by `validateRequest({query: boardListQuerySchema})`. */
type BoardListQuery = {
  scope: 'accessible' | 'discoverable';
  search?: string;
  visibility?: BoardVisibility;
};

function requireBoard(req: Request) {
  if (!req.board || !req.boardAccess) {
    // The access middleware always populates both before a handler runs.
    throw new ApiError(404, ErrorCodes.BOARD_NOT_FOUND, 'Board not found');
  }
  return {board: req.board, level: req.boardAccess};
}

export const boardController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const actor = actorFromRequest(req);
      res.status(201).json({board: await boardService.create(actor, req.body)});
    } catch (error) {
      next(error);
    }
  },

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const actor = actorFromRequest(req);
      const query = req.query as unknown as BoardListQuery;
      const boards = await boardService.list(actor, query.scope, {
        visibility: query.visibility,
        search: query.search
      });
      res.status(200).json({boards});
    } catch (error) {
      next(error);
    }
  },

  async get(_req: Request, res: Response, next: NextFunction) {
    try {
      const {board, level} = requireBoard(_req);
      res.status(200).json({board: await boardService.get(board, level)});
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const {board, level} = requireBoard(req);
      res.status(200).json({board: await boardService.update(board, req.body, level)});
    } catch (error) {
      next(error);
    }
  },

  /** Owner-only via `requireBoardAccess('owner')`. */
  async setVisibility(req: Request, res: Response, next: NextFunction) {
    try {
      const {board} = requireBoard(req);
      res.status(200).json({
        board: await boardService.setVisibility(board, req.body.visibility)
      });
    } catch (error) {
      next(error);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const {board} = requireBoard(req);
      res.status(200).json(await boardService.remove(board));
    } catch (error) {
      next(error);
    }
  },

  async getPublic(req: Request, res: Response, next: NextFunction) {
    try {
      const actor = actorFromRequest(req);
      res.status(200).json({
        board: await boardService.getPublicBySlug(actor, req.params.boardPublicSlug)
      });
    } catch (error) {
      next(error);
    }
  }
};
