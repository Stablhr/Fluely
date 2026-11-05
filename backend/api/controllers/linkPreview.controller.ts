import {Request, Response, NextFunction} from 'express';
import {linkPreviewService} from '../services/linkPreview.service';
import type {LinkPreviewQuery} from '../dtos/product.dto';

export const linkPreviewController = {
  async resolve(req: Request, res: Response, next: NextFunction) {
    try {
      const {url} = req.query as unknown as LinkPreviewQuery;
      res.status(200).json(await linkPreviewService.resolve(url));
    } catch (error) {
      next(error);
    }
  }
};
