import mongoose, {Schema, Types} from 'mongoose';
import {
  CollaboratorRole,
  CollaboratorRoles,
  CollaboratorStatus,
  CollaboratorStatuses
} from '../constants/product';

export interface BoardCollaboratorDocument extends mongoose.Document {
  boardId: Types.ObjectId;
  userId: Types.ObjectId;
  role: CollaboratorRole;
  /**
   * Only 'accepted' confers any access. A pending row exists so the invitee can
   * see and answer the invitation, and so the owner can see outstanding invites.
   */
  status: CollaboratorStatus;
  invitedBy: Types.ObjectId;
  invitedAt: Date;
  respondedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const BoardCollaboratorSchema = new Schema<BoardCollaboratorDocument>(
  {
    boardId: {
      type: Schema.Types.ObjectId,
      ref: 'Board',
      required: true,
      index: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    role: {type: String, enum: CollaboratorRoles, required: true, default: 'viewer'},
    status: {
      type: String,
      enum: CollaboratorStatuses,
      required: true,
      default: 'pending'
    },
    invitedBy: {type: Schema.Types.ObjectId, ref: 'User', required: true},
    invitedAt: {type: Date, required: true, default: Date.now},
    respondedAt: {type: Date, default: null}
  },
  {timestamps: true}
);

// One row per (board, user). A re-invite overwrites the existing row rather
// than creating a duplicate.
BoardCollaboratorSchema.index({boardId: 1, userId: 1}, {unique: true});
// Serves the invitee's "what is waiting for me" query.
BoardCollaboratorSchema.index({userId: 1, status: 1});

export const BoardCollaboratorModel = mongoose.model<BoardCollaboratorDocument>(
  'BoardCollaborator',
  BoardCollaboratorSchema,
  'board_collaborators'
);
