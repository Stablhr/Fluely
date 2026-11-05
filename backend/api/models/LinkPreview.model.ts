import mongoose, {Schema} from 'mongoose';
import {
  LinkPreviewAspectRatios,
  LinkPreviewProviders,
  type LinkPreviewAspectRatio,
  type LinkPreviewProvider
} from '../constants/linkPreview';

/**
 * Cached result of one successful unfurl.
 *
 * `urlHash` is the lookup key: the full URL can exceed a comfortable index key
 * and contains characters that are noisy in logs. `expiresAt` doubles as the
 * freshness check and the TTL index, so stale rows disappear on their own.
 */
export interface LinkPreviewDocument extends mongoose.Document {
  urlHash: string;
  url: string;
  provider: LinkPreviewProvider;
  title: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  embedUrl: string | null;
  aspectRatio: LinkPreviewAspectRatio;
  fetchedAt: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const LinkPreviewSchema = new Schema<LinkPreviewDocument>(
  {
    urlHash: {type: String, required: true, unique: true},
    url: {type: String, required: true},
    provider: {type: String, enum: LinkPreviewProviders, required: true},
    title: {type: String, default: null},
    description: {type: String, default: null},
    thumbnailUrl: {type: String, default: null},
    embedUrl: {type: String, default: null},
    aspectRatio: {
      type: String,
      enum: LinkPreviewAspectRatios,
      required: true,
      default: '16/9'
    },
    fetchedAt: {type: Date, required: true},
    expiresAt: {type: Date, required: true}
  },
  {timestamps: true}
);

LinkPreviewSchema.index({expiresAt: 1}, {expireAfterSeconds: 0});

export const LinkPreviewModel = mongoose.model<LinkPreviewDocument>(
  'LinkPreview',
  LinkPreviewSchema,
  'linkpreviews'
);
