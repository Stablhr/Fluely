import {NextFunction, Request, Response} from 'express';
import {cardService} from '../services/card.service';
import {ApiError} from '../utils/error';
import {ErrorCodes} from '../constants/errorCodes';

function requireBoard(req: Request) {
  if (!req.board) {
    throw new ApiError(404, ErrorCodes.BOARD_NOT_FOUND, 'Board not found');
  }
  return req.board;
}

export const cardController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(200).json({cards: await cardService.list(requireBoard(req))});
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json({card: await cardService.create(requireBoard(req), req.body)});
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(200).json({
        card: await cardService.update(requireBoard(req), req.params.cardId, req.body)
      });
    } catch (error) {
      next(error);
    }
  },

  async move(req: Request, res: Response, next: NextFunction) {
    try {
      res
        .status(200)
        .json(await cardService.move(requireBoard(req), req.params.cardId, req.body));
    } catch (error) {
      next(error);
    }
  },

  async reorder(req: Request, res: Response, next: NextFunction) {
    try {
      const {cardOrder, expectedRevision} = req.body;
      const order = await cardService.reorder(
        requireBoard(req),
        req.params.listId,
        cardOrder,
        expectedRevision
      );
      res.status(200).json({cardOrder: order});
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
          await cardService.remove(
            requireBoard(req),
            req.params.cardId,
            expectedRevision ? Number(expectedRevision) : undefined
          )
        );
    } catch (error) {
      next(error);
    }
  }
};
