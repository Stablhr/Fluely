"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.boardRepository = void 0;
const Board_model_1 = require("../models/Board.model");
exports.boardRepository = {
    create: (data) => Board_model_1.BoardModel.create(data),
    findById: (id) => Board_model_1.BoardModel.findById(id).exec(),
    findByPublicSlug: (slug) => Board_model_1.BoardModel.findOne({ publicSlug: slug }).exec(),
    /**
     * Board ids the actor owns, or has an accepted collaboration on. Used to build
     * the explicit ("accessible") slice of the board list.
     */
    listOwnedBy: (ownerId) => Board_model_1.BoardModel.find({ ownerId }).sort({ updatedAt: -1 }).exec(),
    /** Boards in a workspace that are visible to every member of it. */
    listWorkspaceVisible: (workspaceId, excludeOwnerId) => Board_model_1.BoardModel.find({
        workspaceId,
        visibility: 'workspace',
        ...(excludeOwnerId ? { ownerId: { $ne: excludeOwnerId } } : {})
    })
        .sort({ updatedAt: -1 })
        .exec(),
    listPublic: () => Board_model_1.BoardModel.find({ visibility: 'public' }).sort({ updatedAt: -1 }).exec(),
    listByIds: (ids) => Board_model_1.BoardModel.find({ _id: { $in: ids } }).exec(),
    listByOwnerAndVisibility: (ownerId, visibility) => Board_model_1.BoardModel.find({ ownerId, visibility }).sort({ updatedAt: -1 }).exec(),
    update: (id, data, bumpRevision = true) => {
        const update = { ...data };
        if (bumpRevision)
            update.$inc = { revision: 1 };
        return Board_model_1.BoardModel.updateOne({ _id: id }, update).exec();
    },
    setPublicSlug: (id, publicSlug) => Board_model_1.BoardModel.updateOne({ _id: id }, { publicSlug, $inc: { revision: 1 } }).exec(),
    findWithRevision: (id, expectedRevision) => {
        const filter = { _id: id };
        if (expectedRevision !== undefined)
            filter.revision = expectedRevision;
        return Board_model_1.BoardModel.findOne(filter).exec();
    },
    delete: (id) => Board_model_1.BoardModel.deleteOne({ _id: id }).exec()
};
