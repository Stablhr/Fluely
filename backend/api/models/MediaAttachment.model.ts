import mongoose, {Schema, Types} from 'mongoose';
import {
  CloudinaryResourceType,
  CloudinaryResourceTypes,
  MediaKinds,
  MediaKind
} from '../constants/product';

export interface MediaAttachmentDocument extends mongoose.Document {
  ownerId: Types.ObjectId;
  boardId: Types.ObjectId | null;
  cardId: Types.ObjectId | null;
  kind: MediaKind;
  /** Cloudinary resource type, required to delete the asset later. */
  resourceType: CloudinaryResourceType;
  originalName: string;
  /** Cloudinary `secure_url`. */
  url: string;
  /** Cloudinary `public_id`, the handle used by `destroy`. */
  publicId: string;
  /**
   * @deprecated Filename from the retired local-disk upload flow. Only ever
   * present on records created before the Cloudinary migration; the migration
   * script reads it and then leaves it in place for auditability.
   */
  storedName?: string | null;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
  updatedAt: Date;
}

const MediaAttachmentSchema = new Schema<MediaAttachmentDocument>(
  {
    ownerId: {type: Schema.Types.ObjectId, ref: 'User', required: true, index: true},
    boardId: {type: Schema.Types.ObjectId, ref: 'Board', default: null, index: true},
    cardId: {type: Schema.Types.ObjectId, ref: 'Card', default: null, index: true},
    kind: {type: String, enum: MediaKinds, required: true},
    resourceType: {
      type: String,
      enum: CloudinaryResourceTypes,
      default: 'image'
    },
    originalName: {type: String, required: true},
    // Optional at the schema level so rows written before the Cloudinary
    // migration still load (and can be migrated); every new row sets both.
    url: {type: String},
    publicId: {type: String, index: true},
    /** Legacy local filename. Read by the migration script, never written now. */
    storedName: {type: String},
    mimeType: {type: String, required: true},
    sizeBytes: {type: Number, required: true, min: 0}
  },
  {timestamps: true}
);

export const MediaAttachmentModel = mongoose.model<MediaAttachmentDocument>(
  'MediaAttachment',
  MediaAttachmentSchema,
  'media_attachments'
);
