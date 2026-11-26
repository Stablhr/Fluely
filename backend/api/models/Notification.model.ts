import mongoose, {Schema, Types} from 'mongoose';
import {NotificationTypes, NotificationType} from '../constants/product';

export interface NotificationDocument extends mongoose.Document {
  /** The person who should see this notification. */
  userId: Types.ObjectId;
  type: NotificationType;
  /** Who caused it: the inviter, or the invitee who answered. */
  actorId: Types.ObjectId;
  /** Null for notifications about social posts, which belong to no board. */
  boardId: Types.ObjectId | null;
  /** The social post a `post_failed` notification is about. */
  postId: string | null;
  /** The invitation row this is about; lets the UI wire Accept/Decline directly. */
  collaboratorId: Types.ObjectId | null;
  /** Where a mention happened (nullable for non-mention notifications). */
  cardId: Types.ObjectId | null;
  commentId: string | null;
  snippet: string | null;
  read: boolean;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<NotificationDocument>(
  {
    userId: {type: Schema.Types.ObjectId, ref: 'User', required: true, index: true},
    type: {type: String, enum: NotificationTypes, required: true},
    actorId: {type: Schema.Types.ObjectId, ref: 'User', required: true},
    boardId: {type: Schema.Types.ObjectId, ref: 'Board', default: null, index: true},
    postId: {type: String, default: null},
    collaboratorId: {type: Schema.Types.ObjectId, ref: 'BoardCollaborator', default: null},
    cardId: {type: Schema.Types.ObjectId, ref: 'Card', default: null},
    commentId: {type: String, default: null},
    snippet: {type: String, default: null, maxlength: 200},
    read: {type: Boolean, required: true, default: false},
    readAt: {type: Date, default: null}
  },
  {timestamps: true}
);

// Notifications: one person's notifications, newest first, unread filterable.
NotificationSchema.index({userId: 1, createdAt: -1});

export const NotificationModel = mongoose.model<NotificationDocument>(
  'Notification',
  NotificationSchema,
  'notifications'
);

