import mongoose, {Schema, Types} from 'mongoose';
import {
  PlatformTargetStatus,
  PlatformTargetStatuses,
  PostStatus,
  PostStatuses,
  SchedulablePlatform,
  SchedulablePlatforms
} from '../constants/social';

/**
 * A planned social post and its per-platform targets.
 *
 * `id` is the client's id (a UUID the browser generates), so a post created
 * offline or imported from browser storage keeps the id the rest of the UI
 * already refers to. It is unique per workspace.
 *
 * Fields the server acts on (schedule, status, captions, media, targets) are
 * typed; planning extras the server only stores (analytics, AI metadata) are
 * kept as-is.
 */
export interface PlatformTarget {
  platform: SchedulablePlatform;
  enabled: boolean;
  status: PlatformTargetStatus;
  /** Chosen account; when empty, the workspace's first active account for the platform. */
  accountId?: string | null;
  caption: string;
  hashtags: string[];
  mentions: string[];
  location?: string;
  altText?: string;
  visibility: 'public' | 'private' | 'friends' | 'unlisted';
  deepLink?: string;
  publishedUrl?: string;
  platformPostId?: string;
  externalPostId?: string;
  error?: string;
  errorCode?: string;
  publishedAt?: string;
  retryCount?: number;
  maxRetries?: number;
  lastAttemptAt?: string;
  nextRetryAt?: string;
  idempotencyKey?: string;
  /** Set when the post was simulated because the platform is in dry-run mode. */
  dryRun?: boolean;
}

export interface PostMedia {
  id: string;
  type: 'image' | 'video' | 'audio';
  name: string;
  storageUrl?: string;
  mediaId?: string;
  publicId?: string;
  size: number;
  thumbnailUrl?: string;
  mimeType?: string;
  duration?: number;
  width?: number;
  height?: number;
  platformCompat: string[];
  uploadedAt?: string;
}

export interface SocialPostDocument extends mongoose.Document {
  id: string;
  workspaceId: Types.ObjectId;
  createdBy: Types.ObjectId;
  title: string;
  caption: string;
  platforms: PlatformTarget[];
  media: PostMedia[];
  cardId?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  scheduledAt?: Date | null;
  timezone?: string;
  status: PostStatus;
  repeat: string;
  repeatUntil?: string;
  analytics?: unknown[];
  aiGeneration?: unknown;
  tags: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PlatformTargetSchema = new Schema<PlatformTarget>(
  {
    platform: {type: String, enum: SchedulablePlatforms, required: true},
    enabled: {type: Boolean, default: true},
    status: {type: String, enum: PlatformTargetStatuses, default: 'pending'},
    accountId: {type: String, default: null},
    caption: {type: String, default: '', maxlength: 70000},
    hashtags: {type: [String], default: []},
    mentions: {type: [String], default: []},
    location: String,
    altText: String,
    visibility: {type: String, enum: ['public', 'private', 'friends', 'unlisted'], default: 'public'},
    deepLink: String,
    publishedUrl: String,
    platformPostId: String,
    externalPostId: String,
    error: String,
    errorCode: String,
    publishedAt: String,
    retryCount: Number,
    maxRetries: Number,
    lastAttemptAt: String,
    nextRetryAt: String,
    idempotencyKey: String,
    dryRun: Boolean
  },
  {_id: false}
);

const PostMediaSchema = new Schema<PostMedia>(
  {
    id: {type: String, required: true},
    type: {type: String, enum: ['image', 'video', 'audio'], required: true},
    name: {type: String, default: ''},
    storageUrl: String,
    mediaId: String,
    publicId: String,
    size: {type: Number, default: 0},
    thumbnailUrl: String,
    mimeType: String,
    duration: Number,
    width: Number,
    height: Number,
    platformCompat: {type: [String], default: []},
    uploadedAt: String
  },
  {_id: false}
);

const SocialPostSchema = new Schema<SocialPostDocument>(
  {
    id: {type: String, required: true},
    workspaceId: {type: Schema.Types.ObjectId, ref: 'Workspace', required: true},
    createdBy: {type: Schema.Types.ObjectId, ref: 'User', required: true},
    title: {type: String, default: '', maxlength: 300},
    caption: {type: String, default: '', maxlength: 70000},
    platforms: {type: [PlatformTargetSchema], default: []},
    media: {type: [PostMediaSchema], default: []},
    cardId: String,
    scheduledDate: String,
    scheduledTime: String,
    scheduledAt: {type: Date, default: null},
    timezone: String,
    status: {type: String, enum: PostStatuses, default: 'draft'},
    repeat: {type: String, default: 'none'},
    repeatUntil: String,
    analytics: {type: [Schema.Types.Mixed], default: undefined},
    aiGeneration: {type: Schema.Types.Mixed, default: undefined},
    tags: {type: [String], default: []},
    notes: String
  },
  {timestamps: true}
);

SocialPostSchema.index({workspaceId: 1, id: 1}, {unique: true});
SocialPostSchema.index({workspaceId: 1, scheduledAt: 1});

export const SocialPostModel = mongoose.model<SocialPostDocument>(
  'SocialPost',
  SocialPostSchema,
  'social_posts'
);
