import path from 'path';
import {Types} from 'mongoose';
import {mediaRepository} from '../repositories/media.repository';
import {mediaConfig, kindForMimeType} from '../config/media';
import {ApiError} from '../utils/error';
import {ErrorCodes} from '../constants/errorCodes';
import {MediaKind} from '../constants/product';
import {paginationFrom, paginationMeta} from '../utils/pagination';
import {parseObjectId} from '../utils/actor';
import {
  CloudinaryResourceType,
  deleteFromCloudinary,
  folderForMedia,
  uploadToCloudinary
} from './cloudinary.service';

type UploadedFile = Express.Multer.File;

function toResourceType(value: string): CloudinaryResourceType {
  return value === 'video' || value === 'raw' ? value : 'image';
}

function serialize(doc: {
  _id: Types.ObjectId;
  boardId: Types.ObjectId | null;
  cardId: Types.ObjectId | null;
  kind: string;
  originalName: string;
  url?: string | null;
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
    url: doc.url ?? '',
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    createdAt: doc.createdAt
  };
}

export const mediaService = {
  /**
   * Streams every uploaded buffer to Cloudinary, then records one row per file.
   *
   * Uploads happen before any row is written, so a failed upload leaves no
   * half-created batch; anything already pushed to Cloudinary is destroyed
   * again rather than being orphaned.
   */
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
    const folder = folderForMedia({boardId: scope.boardId, cardId: scope.cardId});

    const uploaded: {file: UploadedFile; result: Awaited<ReturnType<typeof uploadToCloudinary>>}[] =
      [];

    try {
      for (const file of files) {
        const result = await uploadToCloudinary(file.buffer, {
          folder,
          resource_type: 'auto',
          use_filename: true,
          unique_filename: true
        });
        uploaded.push({file, result});
      }
    } catch (error) {
      await Promise.all(
        uploaded.map(({result}) =>
          deleteFromCloudinary(result.public_id, toResourceType(result.resource_type)).catch(
            () => undefined
          )
        )
      );
      throw error;
    }

    const created = await Promise.all(
      uploaded.map(({file, result}) =>
        mediaRepository
          .create({
            ownerId,
            boardId,
            cardId,
            kind: kindForMimeType(file.mimetype) as MediaKind,
            resourceType: toResourceType(result.resource_type),
            originalName: path.basename(file.originalname),
            url: result.secure_url,
            publicId: result.public_id,
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

    // Destroy first: if Cloudinary is unreachable the row survives and the
    // request can be retried, rather than leaving an orphaned asset behind.
    if (existing.publicId) {
      await deleteFromCloudinary(
        existing.publicId,
        (existing.resourceType as CloudinaryResourceType) ?? 'image'
      );
    }

    await mediaRepository.deleteByIdForOwner(id.toString(), ownerId);
  }
};
