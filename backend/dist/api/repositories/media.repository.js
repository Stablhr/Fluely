"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mediaRepository = void 0;
const MediaAttachment_model_1 = require("../models/MediaAttachment.model");
exports.mediaRepository = {
    create: (data) => MediaAttachment_model_1.MediaAttachmentModel.create(data),
    findById: (id) => MediaAttachment_model_1.MediaAttachmentModel.findById(id).exec(),
    findByIdForOwner: (id, ownerId) => MediaAttachment_model_1.MediaAttachmentModel.findOne({ _id: id, ownerId }).exec(),
    listForOwner: (ownerId, filter, limit, skip) => {
        const query = { ownerId };
        if (filter.kind)
            query.kind = filter.kind;
        if (filter.search) {
            query.originalName = { $regex: filter.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
        }
        return MediaAttachment_model_1.MediaAttachmentModel.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .exec();
    },
    countForOwner: (ownerId, filter) => {
        const query = { ownerId };
        if (filter.kind)
            query.kind = filter.kind;
        if (filter.search) {
            query.originalName = { $regex: filter.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
        }
        return MediaAttachment_model_1.MediaAttachmentModel.countDocuments(query).exec();
    },
    usedBytes: (ownerId) => MediaAttachment_model_1.MediaAttachmentModel.aggregate([
        { $match: { ownerId } },
        { $group: { _id: null, total: { $sum: '$sizeBytes' } } }
    ]).exec(),
    deleteByIdForOwner: (id, ownerId) => MediaAttachment_model_1.MediaAttachmentModel.deleteOne({ _id: id, ownerId }).exec(),
    deleteForBoard: (boardId) => MediaAttachment_model_1.MediaAttachmentModel.deleteMany({ boardId }).exec()
};
