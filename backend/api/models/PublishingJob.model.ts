import mongoose, {Schema, Types} from 'mongoose';
import {
  PublishJobStatus,
  PublishJobStatuses,
  SchedulablePlatform,
  SchedulablePlatforms
} from '../constants/social';

/**
 * One post going to one platform.
 *
 * The job row is the source of truth for "what is due". QStash only wakes the
 * server at `runAt`; a sweep (`/api/cron/publish-due`, or a timer in local
 * development) catches anything a delivery missed. A job is claimed by an
 * atomic status change, so a duplicate delivery cannot publish twice.
 */
export interface PublishingJobDocument extends mongoose.Document {
  workspaceId: Types.ObjectId;
  socialPostId: string;
  platform: SchedulablePlatform;
  accountId?: Types.ObjectId | null;
  status: PublishJobStatus;
  runAt: Date;
  lockedAt?: Date | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  error?: string | null;
  errorCode?: string | null;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: Date | null;
  idempotencyKey: string;
  /** QStash message id, so a cancel can withdraw the delivery. */
  messageId?: string | null;
  dryRun: boolean;
  publishResult?: {externalPostId?: string; publishedUrl?: string};
  createdAt: Date;
  updatedAt: Date;
}

const PublishingJobSchema = new Schema<PublishingJobDocument>(
  {
    workspaceId: {type: Schema.Types.ObjectId, ref: 'Workspace', required: true},
    socialPostId: {type: String, required: true},
    platform: {type: String, enum: SchedulablePlatforms, required: true},
    accountId: {type: Schema.Types.ObjectId, ref: 'SocialAccount', default: null},
    status: {type: String, enum: PublishJobStatuses, default: 'queued'},
    runAt: {type: Date, required: true},
    lockedAt: {type: Date, default: null},
    startedAt: {type: Date, default: null},
    completedAt: {type: Date, default: null},
    error: {type: String, default: null},
    errorCode: {type: String, default: null},
    retryCount: {type: Number, default: 0},
    maxRetries: {type: Number, default: 3},
    nextRetryAt: {type: Date, default: null},
    idempotencyKey: {type: String, required: true},
    messageId: {type: String, default: null},
    dryRun: {type: Boolean, default: false},
    publishResult: {
      externalPostId: String,
      publishedUrl: String
    }
  },
  {timestamps: true}
);

PublishingJobSchema.index({workspaceId: 1, socialPostId: 1});
PublishingJobSchema.index({status: 1, runAt: 1});
PublishingJobSchema.index({idempotencyKey: 1}, {unique: true});

export const PublishingJobModel = mongoose.model<PublishingJobDocument>(
  'PublishingJob',
  PublishingJobSchema,
  'publishing_jobs'
);
