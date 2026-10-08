import mongoose, {Schema, Types} from 'mongoose';
import {
  ActivityActionType,
  ActivityActionTypes,
  ActivityTargetType,
  ActivityTargetTypes
} from '../constants/product';

/**
 * One entry of the board's audit trail. Written in the same transaction as the
 * change it describes, so a trail can never record something that did not
 * happen (or miss something that did).
 *
 * The metadata carries the structured diff — field changes, titles, roles — so
 * the client can build a human-readable sentence without a join, and so the
 * trail survives copy changes.
 */
export interface ActivityLogDocument extends mongoose.Document {
  boardId: Types.ObjectId;
  /** Who did it. */
  userId: Types.ObjectId;
  actionType: ActivityActionType;
  targetType: ActivityTargetType;
  /** The id of the row this is about; a plain string because the shape varies. */
  targetId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const ActivityLogSchema = new Schema<ActivityLogDocument>(
  {
    boardId: {
      type: Schema.Types.ObjectId,
      ref: 'Board',
      required: true,
      index: true
    },
    userId: {type: Schema.Types.ObjectId, ref: 'User', required: true},
    actionType: {type: String, enum: ActivityActionTypes, required: true},
    targetType: {type: String, enum: ActivityTargetTypes, required: true},
    targetId: {type: String, default: null},
    metadata: {type: Schema.Types.Mixed, default: {}}
  },
  {timestamps: true}
);

// The activity feed: newest first for one board, with a type filter.
ActivityLogSchema.index({boardId: 1, createdAt: -1});
ActivityLogSchema.index({boardId: 1, actionType: 1, createdAt: -1});

export const ActivityLogModel = mongoose.model<ActivityLogDocument>(
  'ActivityLog',
  ActivityLogSchema,
  'activitylog'
);
