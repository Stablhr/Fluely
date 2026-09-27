import {Types} from 'mongoose';
import {
  BoardCollaboratorDocument,
  BoardCollaboratorModel
} from '../models/BoardCollaborator.model';
import {CollaboratorRole, CollaboratorStatus} from '../constants/product';

export const boardCollaboratorRepository = {
  create: (data: {
    boardId: Types.ObjectId;
    userId: Types.ObjectId;
    role: CollaboratorRole;
    status?: CollaboratorStatus;
    invitedBy: Types.ObjectId;
    invitedAt?: Date;
  }) =>
    BoardCollaboratorModel.create({
      status: 'pending',
      invitedAt: new Date(),
      ...data
    }),

  find: (boardId: Types.ObjectId, userId: Types.ObjectId) =>
    BoardCollaboratorModel.findOne({boardId, userId}).exec(),

  /**
   * By row id, scoped to the board.
   *
   * The route param is the collaborator's own id, not their user id, so this
   * cannot reuse `find`. The boardId in the filter is what stops an id belonging
   * to some other board from being mutated through a board the caller happens
   * to own.
   */
  findByIdForBoard: (id: string, boardId: Types.ObjectId) =>
    BoardCollaboratorModel.findOne({_id: id, boardId}).exec(),

  /** Scoped to the invitee, so one person can never answer another's invitation. */
  findByIdForUser: (id: string, userId: Types.ObjectId) =>
    BoardCollaboratorModel.findOne({_id: id, userId}).exec(),

  listForBoard: (boardId: Types.ObjectId) =>
    BoardCollaboratorModel.find({boardId}).sort({createdAt: 1}).exec(),

  /** Accepted collaborations only: the rows that actually grant access. */
  listAcceptedForUser: (userId: Types.ObjectId) =>
    BoardCollaboratorModel.find({userId, status: 'accepted'}).exec(),

  listAcceptedForBoards: (boardIds: Types.ObjectId[]) =>
    BoardCollaboratorModel.find({boardId: {$in: boardIds}, status: 'accepted'}).exec(),

  listPendingForUser: (userId: Types.ObjectId) =>
    BoardCollaboratorModel.find({userId, status: 'pending'}).exec(),

  countAcceptedForBoard: (boardId: Types.ObjectId) =>
    BoardCollaboratorModel.countDocuments({boardId, status: 'accepted'}).exec(),

  update: (id: string, data: Partial<BoardCollaboratorDocument>) =>
    BoardCollaboratorModel.updateOne({_id: id}, data).exec(),

  setStatus: (id: string, status: CollaboratorStatus, respondedAt: Date) =>
    BoardCollaboratorModel.updateOne({_id: id}, {status, respondedAt}).exec(),

  setRole: (id: string, role: CollaboratorRole) =>
    BoardCollaboratorModel.updateOne({_id: id}, {role}).exec(),

  delete: (id: string) => BoardCollaboratorModel.deleteOne({_id: id}).exec(),

  deleteForBoard: (boardId: Types.ObjectId) =>
    BoardCollaboratorModel.deleteMany({boardId}).exec(),

  deleteForBoardAndUser: (boardId: Types.ObjectId, userId: Types.ObjectId) =>
    BoardCollaboratorModel.deleteOne({boardId, userId}).exec()
};
