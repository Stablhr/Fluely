import mongoose, {Schema, Types} from 'mongoose';
import {MediaKinds, MediaKind} from '../constants/product';

export interface MediaAttachmentDocument extends mongoose.Document {
  ownerId: Types.ObjectId;
  boardId: Types.ObjectId | null;
  cardId: Types.ObjectId | null;
  kind: MediaKind;
  originalName: string;
  storedName: string;
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
    originalName: {type: String, required: true},
    storedName: {type: String, required: true},
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
