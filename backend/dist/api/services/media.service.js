"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mediaService = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const media_repository_1 = require("../repositories/media.repository");
const media_1 = require("../config/media");
const error_1 = require("../utils/error");
const errorCodes_1 = require("../constants/errorCodes");
const pagination_1 = require("../utils/pagination");
const actor_1 = require("../utils/actor");
function serialize(doc) {
    return {
        id: doc._id.toString(),
        boardId: doc.boardId ? doc.boardId.toString() : null,
        cardId: doc.cardId ? doc.cardId.toString() : null,
        kind: doc.kind,
        name: doc.originalName,
        url: `${media_1.mediaConfig.publicPath}/${doc.storedName}`,
        mimeType: doc.mimeType,
        sizeBytes: doc.sizeBytes,
        createdAt: doc.createdAt
    };
}
exports.mediaService = {
    async create(ownerId, files, scope) {
        if (files.length === 0) {
            throw new error_1.ApiError(400, errorCodes_1.ErrorCodes.VALIDATION_ERROR, 'No files were uploaded');
        }
        const used = await media_repository_1.mediaRepository.usedBytes(ownerId);
        const currentBytes = used[0]?.total ?? 0;
        const incomingBytes = files.reduce((sum, file) => sum + file.size, 0);
        if (currentBytes + incomingBytes > media_1.mediaConfig.quotaBytes) {
            throw new error_1.ApiError(413, errorCodes_1.ErrorCodes.QUOTA_EXCEEDED, `Upload would exceed the ${Math.round(media_1.mediaConfig.quotaBytes / 1024 / 1024)}MB storage quota`);
        }
        const boardId = scope.boardId ? (0, actor_1.parseObjectId)(scope.boardId, 'boardId') : null;
        const cardId = scope.cardId ? (0, actor_1.parseObjectId)(scope.cardId, 'cardId') : null;
        const created = await Promise.all(files.map((file) => media_repository_1.mediaRepository
            .create({
            ownerId,
            boardId,
            cardId,
            kind: (0, media_1.kindForMimeType)(file.mimetype),
            originalName: path_1.default.basename(file.originalname),
            storedName: path_1.default.basename(file.filename),
            mimeType: file.mimetype,
            sizeBytes: file.size
        })
            .then(serialize)));
        return created;
    },
    async list(ownerId, query) {
        const pagination = (0, pagination_1.paginationFrom)(query);
        const filter = { kind: query.kind, search: query.search };
        const [items, total] = await Promise.all([
            media_repository_1.mediaRepository.listForOwner(ownerId, filter, pagination.limit, pagination.skip),
            media_repository_1.mediaRepository.countForOwner(ownerId, filter)
        ]);
        return { items: items.map(serialize), pagination: (0, pagination_1.paginationMeta)(pagination, total) };
    },
    async remove(ownerId, mediaId) {
        const id = (0, actor_1.parseObjectId)(mediaId, 'mediaId');
        const existing = await media_repository_1.mediaRepository.findByIdForOwner(id.toString(), ownerId);
        if (!existing) {
            throw new error_1.ApiError(404, errorCodes_1.ErrorCodes.MEDIA_NOT_FOUND, 'Attachment not found');
        }
        await media_repository_1.mediaRepository.deleteByIdForOwner(id.toString(), ownerId);
        await promises_1.default.unlink(path_1.default.join(media_1.mediaConfig.uploadDirAbs, existing.storedName)).catch(() => undefined);
    }
};
