import mongoose, {Schema, Types} from 'mongoose';
import {NotificationTypes, NotificationType} from '../constants/product';

export interface NotificationDocument extends mongoose.Document {
  /** The person who should see this notification. */
  userId: Types.ObjectId;
  type: NotificationType;
  /** Who caused it: the inviter, or the invitee who answered. */
  actorId: Types.ObjectId;
  boardId: Types.ObjectId;
  /** The invitation row this is about; lets the UI wire Accept/Decline directly. */
  collaboratorId: Types.ObjectId | null;
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
    boardId: {type: Schema.Types.ObjectId, ref: 'Board', required: true, index: true},
    collaboratorId: {type: Schema.Types.ObjectId, ref: 'BoardCollaborator', default: null},
    read: {type: Boolean, required: true, default: false},
    readAt: {type: Date, default: null}
  },
  {timestamps: true}
);

// The inbox query: one person's notifications, newest first, unread filterable.
NotificationSchema.index({userId: 1, createdAt: -1});

export const NotificationModel = mongoose.model<NotificationDocument>(
  'Notification',
  NotificationSchema,
  'notifications'
);
