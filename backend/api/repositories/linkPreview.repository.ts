import type {LinkPreviewResult} from '../constants/linkPreview';
import {
  LinkPreviewModel,
  type LinkPreviewDocument
} from '../models/LinkPreview.model';

export type LinkPreviewCacheInput = LinkPreviewResult & {
  urlHash: string;
  url: string;
  fetchedAt: Date;
  expiresAt: Date;
};

export const linkPreviewRepository = {
  /** Only returns a row that has not reached its refresh date. */
  findUsable: (urlHash: string): Promise<LinkPreviewDocument | null> =>
    LinkPreviewModel.findOne({urlHash, expiresAt: {$gt: new Date()}}).exec(),

  /**
   * Writes the latest unfurl over any existing row for the same address, so a
   * refreshed preview never collides with the unique index.
   */
  upsert: async (data: LinkPreviewCacheInput): Promise<LinkPreviewDocument> => {
    const document = await LinkPreviewModel.findOneAndUpdate(
      {urlHash: data.urlHash},
      {$set: data},
      {upsert: true, new: true, setDefaultsOnInsert: true}
    ).exec();

    if (!document) throw new Error('Link preview cache write returned no document');
    return document;
  }
};
