import {Types} from 'mongoose';
import {
  MediaAttachmentDocument,
  MediaAttachmentModel
} from '../models/MediaAttachment.model';
import {MediaKind} from '../constants/product';

export type CreateMediaInput = Pick<
  MediaAttachmentDocument,
  'ownerId' | 'kind' | 'originalName' | 'storedName' | 'mimeType' | 'sizeBytes'
> & {boardId?: Types.ObjectId | null; cardId?: Types.ObjectId | null};

export const mediaRepository = {
  create: (data: CreateMediaInput) => MediaAttachmentModel.create(data),

  findById: (id: string) => MediaAttachmentModel.findById(id).exec(),

  findByIdForOwner: (id: string, ownerId: Types.ObjectId) =>
    MediaAttachmentModel.findOne({_id: id, ownerId}).exec(),

  listForOwner: (
    ownerId: Types.ObjectId,
    filter: {kind?: MediaKind; search?: string},
    limit: number,
    skip: number
  ) => {
    const query: Record<string, unknown> = {ownerId};
    if (filter.kind) query.kind = filter.kind;
    if (filter.search) {
      query.originalName = {$regex: filter.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i'};
    }
    return MediaAttachmentModel.find(query)
      .sort({createdAt: -1})
      .skip(skip)
      .limit(limit)
      .exec();
  },

  countForOwner: (
    ownerId: Types.ObjectId,
    filter: {kind?: MediaKind; search?: string}
  ) => {
    const query: Record<string, unknown> = {ownerId};
    if (filter.kind) query.kind = filter.kind;
    if (filter.search) {
      query.originalName = {$regex: filter.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i'};
    }
    return MediaAttachmentModel.countDocuments(query).exec();
  },

  usedBytes: (ownerId: Types.ObjectId) =>
    MediaAttachmentModel.aggregate<{total: number}>([
      {$match: {ownerId}},
      {$group: {_id: null, total: {$sum: '$sizeBytes'}}}
    ]).exec(),

  deleteByIdForOwner: (id: string, ownerId: Types.ObjectId) =>
    MediaAttachmentModel.deleteOne({_id: id, ownerId}).exec(),

  deleteForBoard: (boardId: Types.ObjectId) =>
    MediaAttachmentModel.deleteMany({boardId}).exec()
};
