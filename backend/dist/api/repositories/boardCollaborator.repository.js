"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.boardCollaboratorRepository = void 0;
const BoardCollaborator_model_1 = require("../models/BoardCollaborator.model");
exports.boardCollaboratorRepository = {
    create: (data) => BoardCollaborator_model_1.BoardCollaboratorModel.create({
        status: 'pending',
        invitedAt: new Date(),
        ...data
    }),
    find: (boardId, userId) => BoardCollaborator_model_1.BoardCollaboratorModel.findOne({ boardId, userId }).exec(),
    listForBoard: (boardId) => BoardCollaborator_model_1.BoardCollaboratorModel.find({ boardId }).sort({ createdAt: 1 }).exec(),
    /** Accepted collaborations only: the rows that actually grant access. */
    listAcceptedForUser: (userId) => BoardCollaborator_model_1.BoardCollaboratorModel.find({ userId, status: 'accepted' }).exec(),
    listAcceptedForBoards: (boardIds) => BoardCollaborator_model_1.BoardCollaboratorModel.find({ boardId: { $in: boardIds }, status: 'accepted' }).exec(),
    listPendingForUser: (userId) => BoardCollaborator_model_1.BoardCollaboratorModel.find({ userId, status: 'pending' }).exec(),
    countAcceptedForBoard: (boardId) => BoardCollaborator_model_1.BoardCollaboratorModel.countDocuments({ boardId, status: 'accepted' }).exec(),
    update: (id, data) => BoardCollaborator_model_1.BoardCollaboratorModel.updateOne({ _id: id }, data).exec(),
    setStatus: (id, status, respondedAt) => BoardCollaborator_model_1.BoardCollaboratorModel.updateOne({ _id: id }, { status, respondedAt }).exec(),
    setRole: (id, role) => BoardCollaborator_model_1.BoardCollaboratorModel.updateOne({ _id: id }, { role }).exec(),
    delete: (id) => BoardCollaborator_model_1.BoardCollaboratorModel.deleteOne({ _id: id }).exec(),
    deleteForBoard: (boardId) => BoardCollaborator_model_1.BoardCollaboratorModel.deleteMany({ boardId }).exec(),
    deleteForBoardAndUser: (boardId, userId) => BoardCollaborator_model_1.BoardCollaboratorModel.deleteOne({ boardId, userId }).exec()
};
