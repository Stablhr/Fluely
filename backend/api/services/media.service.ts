import fs from 'fs/promises';
import path from 'path';
import {Types} from 'mongoose';
import {mediaRepository} from '../repositories/media.repository';
import {mediaConfig, kindForMimeType} from '../config/media';
import {ApiError} from '../utils/error';
import {ErrorCodes} from '../constants/errorCodes';
import {MediaKind} from '../constants/product';
import {paginationFrom, paginationMeta} from '../utils/pagination';
import {parseObjectId} from '../utils/actor';

type UploadedFile = Express.Multer.File;

function serialize(doc: {
  _id: Types.ObjectId;
  boardId: Types.ObjectId | null;
  cardId: Types.ObjectId | null;
  kind: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}) {
  return {
    id: doc._id.toString(),
    boardId: doc.boardId ? doc.boardId.toString() : null,
    cardId: doc.cardId ? doc.cardId.toString() : null,
    kind: doc.kind,
    name: doc.originalName,
    url: `${mediaConfig.publicPath}/${doc.storedName}`,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    createdAt: doc.createdAt
  };
}

export const mediaService = {
  async create(
    ownerId: Types.ObjectId,
    files: UploadedFile[],
    scope: {boardId?: string; cardId?: string}
  ) {
    if (files.length === 0) {
      throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, 'No files were uploaded');
    }

    const used = await mediaRepository.usedBytes(ownerId);
    const currentBytes = used[0]?.total ?? 0;
    const incomingBytes = files.reduce((sum, file) => sum + file.size, 0);

    if (currentBytes + incomingBytes > mediaConfig.quotaBytes) {
      throw new ApiError(
        413,
        ErrorCodes.QUOTA_EXCEEDED,
        `Upload would exceed the ${Math.round(mediaConfig.quotaBytes / 1024 / 1024)}MB storage quota`
      );
    }

    const boardId = scope.boardId ? parseObjectId(scope.boardId, 'boardId') : null;
    const cardId = scope.cardId ? parseObjectId(scope.cardId, 'cardId') : null;

    const created = await Promise.all(
      files.map((file) =>
        mediaRepository
          .create({
            ownerId,
            boardId,
            cardId,
            kind: kindForMimeType(file.mimetype) as MediaKind,
            originalName: path.basename(file.originalname),
            storedName: path.basename(file.filename),
            mimeType: file.mimetype,
            sizeBytes: file.size
          })
          .then(serialize)
      )
    );

    return created;
  },

  async list(
    ownerId: Types.ObjectId,
    query: {kind?: MediaKind; search?: string; page?: number; limit?: number}
  ) {
    const pagination = paginationFrom(query);
    const filter = {kind: query.kind, search: query.search};
    const [items, total] = await Promise.all([
      mediaRepository.listForOwner(ownerId, filter, pagination.limit, pagination.skip),
      mediaRepository.countForOwner(ownerId, filter)
    ]);
    return {items: items.map(serialize), pagination: paginationMeta(pagination, total)};
  },

  async remove(ownerId: Types.ObjectId, mediaId: string) {
    const id = parseObjectId(mediaId, 'mediaId');
    const existing = await mediaRepository.findByIdForOwner(id.toString(), ownerId);
    if (!existing) {
      throw new ApiError(404, ErrorCodes.MEDIA_NOT_FOUND, 'Attachment not found');
    }

    await mediaRepository.deleteByIdForOwner(id.toString(), ownerId);
    await fs.unlink(path.join(mediaConfig.uploadDirAbs, existing.storedName)).catch(() => undefined);
  }
};
