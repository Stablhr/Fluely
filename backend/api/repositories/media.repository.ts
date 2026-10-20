import {Types} from 'mongoose';
import {ProductSession} from '../utils/transaction';
import {
  MediaAttachmentDocument,
  MediaAttachmentModel
} from '../models/MediaAttachment.model';
import {MediaKind} from '../constants/product';
import {CloudinaryResourceType} from '../services/cloudinary.service';

export type CreateMediaInput = Pick<
  MediaAttachmentDocument,
  | 'ownerId'
  | 'kind'
  | 'resourceType'
  | 'originalName'
  | 'url'
  | 'publicId'
  | 'mimeType'
  | 'sizeBytes'
> & {boardId?: Types.ObjectId | null; cardId?: Types.ObjectId | null};

export const mediaRepository = {
  create: (data: CreateMediaInput) => MediaAttachmentModel.create(data),

  findById: (id: string) => MediaAttachmentModel.findById(id).exec(),

  findByIds: (ids: string[]) =>
    ids.length === 0
      ? Promise.resolve([])
      : MediaAttachmentModel.find({_id: {$in: ids}}).exec(),

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

  deleteForBoard: (boardId: Types.ObjectId, session?: ProductSession) =>
    MediaAttachmentModel.deleteMany({boardId}, {session}).exec()
};
