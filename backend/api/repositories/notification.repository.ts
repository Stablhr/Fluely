import {Types} from 'mongoose';
import {NotificationDocument, NotificationModel} from '../models/Notification.model';
import {NotificationType} from '../constants/product';

/** Newest first; the bell only ever shows a window of the most recent items. */
const LIST_LIMIT = 50;

export const notificationRepository = {
  create: (data: {
    userId: Types.ObjectId;
    type: NotificationType;
    actorId: Types.ObjectId;
    boardId: Types.ObjectId;
    collaboratorId?: Types.ObjectId | null;
  }) => NotificationModel.create({...data, collaboratorId: data.collaboratorId ?? null}),

  listForUser: (userId: Types.ObjectId, limit = LIST_LIMIT) =>
    NotificationModel.find({userId}).sort({createdAt: -1}).limit(limit).exec(),

  countUnread: (userId: Types.ObjectId) =>
    NotificationModel.countDocuments({userId, read: false}).exec(),

  /** Scoped to the owner, so a notification can never be marked read for someone else. */
  markRead: (id: string, userId: Types.ObjectId) =>
    NotificationModel.updateOne(
      {_id: id, userId, read: false},
      {read: true, readAt: new Date()}
    ).exec(),

  markAllRead: (userId: Types.ObjectId) =>
    NotificationModel.updateMany(
      {userId, read: false},
      {read: true, readAt: new Date()}
    ).exec(),

  /**
   * An answered invitation is deleted rather than marked read: the card's only
   * purpose is to collect a decision, and a lingering "Accept/Decline" row is
   * worse than no row at all.
   */
  deleteByCollaboratorId: (collaboratorId: Types.ObjectId) =>
    NotificationModel.deleteMany({collaboratorId}).exec(),

  /**
   * A re-invite supersedes whatever the invitee was looking at, so the stale
   * card is deleted rather than left to stack with the new one.
   */
  deleteInvitationsForBoard: (userId: Types.ObjectId, boardId: Types.ObjectId) =>
    NotificationModel.deleteMany({
      userId,
      boardId,
      type: 'board_invitation'
    }).exec()
};

export type NotificationRow = NotificationDocument;
