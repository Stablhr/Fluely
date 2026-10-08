import {Types} from 'mongoose';
import {
  BoardCollaboratorDocument,
  BoardCollaboratorModel
} from '../models/BoardCollaborator.model';
import {CollaboratorRole, CollaboratorStatus} from '../constants/product';
import {ProductSession} from '../utils/transaction';

/** Optional session on writes and post-write reads: see `list.repository`. */
export const boardCollaboratorRepository = {
  create: (
    data: {
      boardId: Types.ObjectId;
      userId: Types.ObjectId;
      role: CollaboratorRole;
      status?: CollaboratorStatus;
      invitedBy: Types.ObjectId;
      invitedAt?: Date;
    },
    session?: ProductSession
  ) =>
    BoardCollaboratorModel.create(
      [
        {
          status: 'pending',
          invitedAt: new Date(),
          ...data
        }
      ],
      {session}
    ).then(([created]) => created),

  find: (boardId: Types.ObjectId, userId: Types.ObjectId, session?: ProductSession) =>
    session
      ? BoardCollaboratorModel.findOne({boardId, userId}).session(session).exec()
      : BoardCollaboratorModel.findOne({boardId, userId}).exec(),

  /**
   * By row id, scoped to the board.
   *
   * The route param is the collaborator's own id, not their user id, so this
   * cannot reuse `find`. The boardId in the filter is what stops an id belonging
   * to some other board from being mutated through a board the caller happens
   * to own.
   */
  findByIdForBoard: (id: string, boardId: Types.ObjectId, session?: ProductSession) =>
    session
      ? BoardCollaboratorModel.findOne({_id: id, boardId})
          .session(session)
          .exec()
      : BoardCollaboratorModel.findOne({_id: id, boardId}).exec(),

  /** Scoped to the invitee, so one person can never answer another's invitation. */
  findByIdForUser: (id: string, userId: Types.ObjectId, session?: ProductSession) =>
    session
      ? BoardCollaboratorModel.findOne({_id: id, userId})
          .session(session)
          .exec()
      : BoardCollaboratorModel.findOne({_id: id, userId}).exec(),

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

  update: (
    id: string,
    data: Partial<BoardCollaboratorDocument>,
    session?: ProductSession
  ) => BoardCollaboratorModel.updateOne({_id: id}, data, {session}).exec(),

  setStatus: (
    id: string,
    status: CollaboratorStatus,
    respondedAt: Date,
    session?: ProductSession
  ) =>
    BoardCollaboratorModel.updateOne(
      {_id: id},
      {status, respondedAt},
      {session}
    ).exec(),

  setRole: (id: string, role: CollaboratorRole, session?: ProductSession) =>
    BoardCollaboratorModel.updateOne({_id: id}, {role}, {session}).exec(),

  delete: (id: string, session?: ProductSession) =>
    BoardCollaboratorModel.deleteOne({_id: id}, {session}).exec(),

  deleteForBoard: (boardId: Types.ObjectId, session?: ProductSession) =>
    BoardCollaboratorModel.deleteMany({boardId}, {session}).exec(),

  deleteForBoardAndUser: (boardId: Types.ObjectId, userId: Types.ObjectId) =>
    BoardCollaboratorModel.deleteOne({boardId, userId}).exec()
};
