import path from 'path';
import {Types} from 'mongoose';
import {mediaRepository} from '../repositories/media.repository';
import {boardRepository} from '../repositories/board.repository';
import {cloudinary, isCloudinaryConfigured} from '../config/cloudinary';
import {env} from '../config/env';
import {getBoardAccessLevel, canWrite} from './boardAccess.service';
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
  publicId?: string | null;
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
    publicId: doc.publicId ?? '',
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

    // Board-role enforcement: a viewer may not delete attachments on a board
    // they only have read access to.
    if (existing.boardId) {
      const board = await boardRepository.findById(existing.boardId.toString());
      if (board) {
        const level = await getBoardAccessLevel({actorType: 'user', actorId: ownerId}, board);
        if (!canWrite(level)) {
          throw new ApiError(403, ErrorCodes.FORBIDDEN, 'You have view-only access to this board');
        }
      }
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
  },

  /**
   * Returns signed upload parameters so the browser can upload large files
   * (e.g. videos) directly to Cloudinary, bypassing the serverless body limit.
   */
  async signature(
    ownerId: Types.ObjectId,
    scope: {boardId?: string; cardId?: string}
  ) {
    if (!isCloudinaryConfigured) {
      throw new ApiError(
        503,
        ErrorCodes.INTERNAL_ERROR,
        'Media storage is not configured'
      );
    }
    const folder = folderForMedia(scope);
    const timestamp = Math.round(Date.now() / 1000);
    // Every parameter the browser sends to Cloudinary must appear here, or the
    // signature will not match and Cloudinary rejects the upload. The resource
    // type comes from the upload endpoint (`/auto/upload`), so it is not
    // signed.
    const params: Record<string, unknown> = {
      timestamp,
      folder,
      use_filename: 'true',
      unique_filename: 'true'
    };
    const secret = env.CLOUDINARY_API_SECRET as string;
    const signature = cloudinary.utils.api_sign_request(params, secret);
    return {
      cloudName: env.CLOUDINARY_CLOUD_NAME as string,
      apiKey: env.CLOUDINARY_API_KEY as string,
      timestamp,
      signature,
      folder
    };
  },

  /**
   * Registers a media asset that was uploaded directly to Cloudinary by the
   * browser, creating the MediaAttachment row. Board access is verified.
   *
   * The kind is derived from the MIME type rather than trusted from the
   * client, so a video can never be recorded as an image (which would break
   * `destroy` later).
   */
  async register(
    ownerId: Types.ObjectId,
    data: {
      name: string;
      url: string;
      publicId: string;
      mimeType: string;
      sizeBytes: number;
      resourceType: string;
    },
    scope: {boardId?: string; cardId?: string}
  ) {
    const mimeType = data.mimeType.toLowerCase();
    if (!mediaConfig.allowedMimeTypes.includes(mimeType)) {
      throw new ApiError(
        415,
        ErrorCodes.UNSUPPORTED_MEDIA_TYPE,
        `Unsupported file type: ${data.mimeType}`
      );
    }
    if (data.sizeBytes > mediaConfig.maxFileSizeBytes) {
      throw new ApiError(
        413,
        ErrorCodes.FILE_TOO_LARGE,
        `File is larger than the ${Math.round(mediaConfig.maxFileSizeBytes / 1024 / 1024)}MB limit`
      );
    }

    const boardId = scope.boardId ? parseObjectId(scope.boardId, 'boardId') : null;
    const cardId = scope.cardId ? parseObjectId(scope.cardId, 'cardId') : null;

    if (boardId) {
      const board = await boardRepository.findById(boardId.toString());
      if (board) {
        const level = await getBoardAccessLevel({actorType: 'user', actorId: ownerId}, board);
        if (!canWrite(level)) {
          throw new ApiError(403, ErrorCodes.FORBIDDEN, 'You have view-only access to this board');
        }
      }
    }

    const usedBytes = await mediaRepository.usedBytes(ownerId);
    const currentBytes = usedBytes[0]?.total ?? 0;
    if (currentBytes + data.sizeBytes > mediaConfig.quotaBytes) {
      throw new ApiError(
        413,
        ErrorCodes.QUOTA_EXCEEDED,
        `Upload would exceed the ${Math.round(mediaConfig.quotaBytes / 1024 / 1024)}MB storage quota`
      );
    }

    const kind = kindForMimeType(mimeType);
    // Cloudinary's `auto` upload reports the real resource type, but fall back
    // to the derived kind so a video is never stored as an image.
    const resourceType: CloudinaryResourceType =
      data.resourceType === 'video' || data.resourceType === 'raw'
        ? data.resourceType
        : kind === 'video'
          ? 'video'
          : kind === 'image'
            ? 'image'
            : 'raw';

    const created = await mediaRepository.create({
      ownerId,
      boardId,
      cardId,
      kind: kind as MediaKind,
      resourceType,
      originalName: path.basename(data.name),
      url: data.url,
      publicId: data.publicId,
      mimeType: data.mimeType,
      sizeBytes: data.sizeBytes
    });
    return serialize(created);
  }
};
