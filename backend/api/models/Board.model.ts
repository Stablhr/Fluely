import mongoose, {Schema, Types} from 'mongoose';
import {BoardVisibility, BoardVisibilities} from '../constants/product';

export interface BoardSettingsDocument {
  commentPermission: 'everyone' | 'members' | 'editors';
  selfJoin: boolean;
}

export interface BoardDocument extends mongoose.Document {
  name: string;
  description: string;
  ownerId: Types.ObjectId;
  workspaceId: Types.ObjectId | null;
  visibility: BoardVisibility;
  /**
   * Handles `/boards/public/:boardPublicSlug`. Generated on first publish and
   * then kept for the board's life, so re-publicising restores the same links
   * instead of orphaning them. Only honoured while visibility is 'public'.
   */
  publicSlug: string | null;
  background: string;
  backgroundMediaId: Types.ObjectId | null;
  labels: {id: string; name: string; color: string}[];
  template: string;
  settings: BoardSettingsDocument;
  listOrder: Types.ObjectId[];
  /** Monotonic counter, compared against `expectedRevision` on every write. */
  revision: number;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const BoardSchema = new Schema<BoardDocument>(
  {
    name: {type: String, required: true, trim: true, maxlength: 120},
    description: {type: String, default: '', maxlength: 5000},
    ownerId: {type: Schema.Types.ObjectId, ref: 'User', required: true, index: true},
    workspaceId: {type: Schema.Types.ObjectId, ref: 'Workspace', default: null, index: true},
    visibility: {
      type: String,
      enum: BoardVisibilities,
      required: true,
      default: 'private'
    },
    publicSlug: {type: String, default: null},
    background: {type: String, default: 'default', maxlength: 500},
    backgroundMediaId: {type: Schema.Types.ObjectId, ref: 'MediaAttachment', default: null},
    labels: {
      type: [
        {
          id: {type: String, required: true},
          name: {type: String, required: true},
          color: {type: String, required: true}
        }
      ],
      default: []
    },
    template: {type: String, default: 'blank'},
    settings: {
      commentPermission: {type: String, default: 'members'},
      selfJoin: {type: Boolean, default: false}
    },
    listOrder: {type: [Schema.Types.ObjectId], default: []},
    revision: {type: Number, default: 1, min: 1},
    archivedAt: {type: Date, default: null}
  },
  {timestamps: true}
);

/**
 * Only public boards are addressable by slug, and each slug must be unique.
 *
 * The filter matters more than it looks. A plain `sparse` unique index does not
 * do what it appears to: sparse skips documents where the field is *absent*, not
 * where it is explicitly `null`. Every private board stores `publicSlug: null`,
 * so a sparse unique index allows exactly one private board and rejects the
 * second with E11000. Restricting the index to actual strings keeps slugs unique
 * while leaving any number of unpublished boards alone.
 *
 * Existing deployments still carry the old index; see
 * `scripts/fix-public-slug-index.ts`, which must run once before this takes
 * effect.
 */
BoardSchema.index(
  {publicSlug: 1},
  {unique: true, partialFilterExpression: {publicSlug: {$type: 'string'}}}
);
// Drives the "workspace boards" listing.
BoardSchema.index({workspaceId: 1, visibility: 1});

export const BoardModel = mongoose.model<BoardDocument>(
  'Board',
  BoardSchema,
  'boards'
);
