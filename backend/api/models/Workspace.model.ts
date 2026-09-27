import mongoose, {Schema, Types} from 'mongoose';

export const WorkspaceMemberRoles = ['owner', 'member'] as const;
export type WorkspaceMemberRole = (typeof WorkspaceMemberRoles)[number];

export interface WorkspaceDocument extends mongoose.Document {
  name: string;
  slug: string;
  ownerId: Types.ObjectId;
  /**
   * SHA-256 of the join code. The raw code is shown once at creation and never
   * stored, so a database leak cannot be replayed as a join link.
   */
  joinCodeHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const WorkspaceSchema = new Schema<WorkspaceDocument>(
  {
    name: {type: String, required: true, trim: true, maxlength: 120},
    slug: {type: String, required: true, unique: true, lowercase: true, trim: true},
    ownerId: {type: Schema.Types.ObjectId, ref: 'User', required: true, index: true},
    joinCodeHash: {type: String, default: null, index: true, sparse: true}
  },
  {timestamps: true}
);

export const WorkspaceModel = mongoose.model<WorkspaceDocument>(
  'Workspace',
  WorkspaceSchema,
  'workspaces'
);
