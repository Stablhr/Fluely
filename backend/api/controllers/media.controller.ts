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
  },

  async signature(req: Request, res: Response, next: NextFunction) {
    try {
      const actor = actorFromRequest(req);
      const body = (req.body ?? {}) as {boardId?: string; cardId?: string};
      const result = await mediaService.signature(actor.actorId, {
        boardId: body.boardId,
        cardId: body.cardId
      });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const actor = actorFromRequest(req);
      const body = (req.body ?? {}) as {
        boardId?: string;
        cardId?: string;
        name: string;
        url: string;
        publicId: string;
        mimeType: string;
        sizeBytes: number;
        resourceType: string;
      };
      const item = await mediaService.register(
        actor.actorId,
        {
          name: body.name,
          url: body.url,
          publicId: body.publicId,
          mimeType: body.mimeType,
          sizeBytes: body.sizeBytes,
          resourceType: body.resourceType
        },
        {boardId: body.boardId, cardId: body.cardId}
      );
      res.status(201).json({item});
    } catch (error) {
      next(error);
    }
  }
};
