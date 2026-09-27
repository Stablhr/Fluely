import {NextFunction, Request, Response} from 'express';
import {mediaService} from '../services/media.service';
import {actorFromRequest} from '../utils/actor';
import {MediaKind} from '../constants/product';

/** Shape produced by `validateRequest({query: mediaListQuerySchema})`. */
type MediaListQuery = {
  kind?: MediaKind;
  search?: string;
  page: number;
  limit: number;
};

export const mediaController = {
  async upload(req: Request, res: Response, next: NextFunction) {
    try {
      const actor = actorFromRequest(req);
      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      const body = (req.body ?? {}) as {boardId?: string; cardId?: string};
      const items = await mediaService.create(actor.actorId, files, {
        boardId: body.boardId,
        cardId: body.cardId
      });
      res.status(201).json({items});
    } catch (error) {
      next(error);
    }
  },

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const actor = actorFromRequest(req);
      res.status(200).json(
        await mediaService.list(actor.actorId, req.query as unknown as MediaListQuery)
      );
    } catch (error) {
      next(error);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const actor = actorFromRequest(req);
      await mediaService.remove(actor.actorId, req.params.mediaId);
      res.status(200).json({message: 'Attachment removed'});
    } catch (error) {
      next(error);
    }
  }
};
