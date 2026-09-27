import mongoose, {Schema, Types} from 'mongoose';
import {WorkspaceMemberRole, WorkspaceMemberRoles} from './Workspace.model';

export interface WorkspaceMemberDocument extends mongoose.Document {
  workspaceId: Types.ObjectId;
  userId: Types.ObjectId;
  role: WorkspaceMemberRole;
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WorkspaceMemberSchema = new Schema<WorkspaceMemberDocument>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    role: {type: String, enum: WorkspaceMemberRoles, required: true, default: 'member'},
    // Set once, when the membership row is created. `createdAt` from the
    // timestamps option would also do, but the API promises an explicit
    // `joinedAt`, and leaving it undeclared made it silently undefined.
    joinedAt: {type: Date, default: () => new Date()}
  },
  {timestamps: true}
);

// One membership row per (workspace, user). Doubles as the lookup index for
// "which workspaces is this person in".
WorkspaceMemberSchema.index({workspaceId: 1, userId: 1}, {unique: true});

export const WorkspaceMemberModel = mongoose.model<WorkspaceMemberDocument>(
  'WorkspaceMember',
  WorkspaceMemberSchema,
  'workspace_members'
);
