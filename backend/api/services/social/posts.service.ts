import {Types} from 'mongoose';
import {ErrorCodes} from '../../constants/errorCodes';
import {
  DEFAULT_MAX_RETRIES,
  PLATFORM_LABELS,
  PostStatus,
  REMINDER_ACCOUNT_TYPE,
  SchedulablePlatform
} from '../../constants/social';
import {PublishingJobDocument, PublishingJobModel} from '../../models/PublishingJob.model';
import {SocialAccountModel} from '../../models/SocialAccount.model';
import {PlatformTarget, SocialPostDocument, SocialPostModel} from '../../models/SocialPost.model';
import {Actor} from '../../utils/actor';
import {createSecureToken} from '../../utils/crypto';
import {ApiError} from '../../utils/error';
import {platformMode, validateContent} from './providers/registry';
import {aggregateStatus, contentFor, refreshPostStatus} from './publisher.service';
import {cancelPublish, enqueuePublish} from './qstash';
import {zonedToUtc} from './time';
import {socialWorkspace} from './workspace';

/**
 * Social posts, scheduling, cancelling and retrying. Shared by everyone in
 * the workspace.
 */

const PLANNING: PostStatus[] = ['idea', 'draft', 'in_review'];
/**
 * Statuses a client may set directly: the planning stages, and "posted" for a
 * post published by hand. The rest are outcomes the server owns; "scheduled"
 * in particular is reached only through `schedule`.
 */
const CLIENT_STATUSES: PostStatus[] = [...PLANNING, 'posted'];
/** Target fields only the publisher writes. */
const OUTCOME_FIELDS: (keyof PlatformTarget)[] = [
  'status',
  'publishedUrl',
  'platformPostId',
  'externalPostId',
  'error',
  'errorCode',
  'publishedAt',
  'retryCount',
  'maxRetries',
  'lastAttemptAt',
  'nextRetryAt',
  'idempotencyKey',
  'dryRun'
];

export type PostInput = Partial<Omit<SocialPostDocument, 'platforms' | 'scheduledAt'>> & {
  platforms?: Partial<PlatformTarget>[];
  scheduledAt?: string | null;
};

export function serializePost(post: SocialPostDocument) {
  const raw = post.toObject({versionKey: false}) as Record<string, unknown>;
  delete raw._id;
  delete raw.workspaceId;
  return {
    ...raw,
    id: post.id,
    createdBy: post.createdBy.toString(),
    scheduledAt: post.scheduledAt ? post.scheduledAt.toISOString() : undefined,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString()
  };
}

function serializeJob(job: PublishingJobDocument) {
  return {
    _id: job._id.toString(),
    socialPostId: job.socialPostId,
    platform: job.platform,
    status: job.status,
    runAt: job.runAt.toISOString(),
    lockedAt: job.lockedAt?.toISOString(),
    startedAt: job.startedAt?.toISOString(),
    completedAt: job.completedAt?.toISOString(),
    error: job.error ?? undefined,
    errorCode: job.errorCode ?? undefined,
    retryCount: job.retryCount,
    maxRetries: job.maxRetries,
    nextRetryAt: job.nextRetryAt?.toISOString(),
    idempotencyKey: job.idempotencyKey,
    dryRun: job.dryRun,
    publishResult: job.publishResult,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString()
  };
}

/** Client targets merged over stored ones; outcome fields always come from the store. */
function mergeTargets(stored: PlatformTarget[], incoming: Partial<PlatformTarget>[]): PlatformTarget[] {
  return incoming.map(next => {
    const previous = stored.find(t => t.platform === next.platform);
    const merged: Record<string, unknown> = {...(previous ?? {}), ...next};
    for (const field of OUTCOME_FIELDS) {
      if (previous && previous[field] !== undefined) merged[field] = previous[field];
      else if (!previous && field !== 'status') delete merged[field];
    }
    if (!previous) merged.status = 'pending';
    return merged as unknown as PlatformTarget;
  });
}

async function findPost(workspaceId: Types.ObjectId, id: string) {
  const post = await SocialPostModel.findOne({workspaceId, id}).exec();
  if (!post) throw new ApiError(404, ErrorCodes.SOCIAL_POST_NOT_FOUND, 'Post not found');
  return post;
}

/** Withdraws queued jobs (all, or one platform's) and their QStash deliveries. */
async function cancelJobs(workspaceId: Types.ObjectId, postId: string, platform?: SchedulablePlatform) {
  const filter: Record<string, unknown> = {workspaceId, socialPostId: postId, status: 'queued'};
  if (platform) filter.platform = platform;
  const jobs = await PublishingJobModel.find(filter).exec();
  await Promise.all(jobs.map(job => cancelPublish(job.messageId)));
  if (jobs.length) {
    await PublishingJobModel.updateMany(
      {_id: {$in: jobs.map(j => j._id)}, status: 'queued'},
      {$set: {status: 'cancelled', completedAt: new Date()}}
    ).exec();
  }
  return jobs.length;
}

async function resolveAccount(workspaceId: Types.ObjectId, target: PlatformTarget) {
  if (target.accountId && Types.ObjectId.isValid(target.accountId)) {
    const chosen = await SocialAccountModel.findOne({
      _id: target.accountId,
      workspaceId,
      platform: target.platform
    }).exec();
    if (chosen) return chosen;
  }
  return SocialAccountModel.findOne({workspaceId, platform: target.platform, status: 'active'})
    .sort({createdAt: 1})
    .exec();
}

function newIdempotencyKey(postId: string, platform: SchedulablePlatform) {
  return `${postId}:${platform}:${createSecureToken(8)}`;
}

function alreadyPublishing(platform: SchedulablePlatform) {
  return new ApiError(
    409,
    ErrorCodes.VALIDATION_ERROR,
    `${PLATFORM_LABELS[platform]} is publishing this post right now. Try again in a minute.`
  );
}

/**
 * Creates and enqueues a job. The post must already be saved with the target
 * marked scheduled: a "post now" job can finish before this returns.
 */
async function createJob(
  workspaceId: Types.ObjectId,
  post: SocialPostDocument,
  platform: SchedulablePlatform,
  accountId: Types.ObjectId,
  runAt: Date,
  idempotencyKey: string
) {
  let job: PublishingJobDocument;
  try {
    job = await PublishingJobModel.create({
      workspaceId,
      socialPostId: post.id,
      platform,
      accountId,
      runAt,
      status: 'queued',
      maxRetries: DEFAULT_MAX_RETRIES,
      dryRun: platformMode(platform) !== 'live',
      idempotencyKey
    });
  } catch (error) {
    // `one_live_job_per_target`: another request queued this platform first.
    if ((error as {code?: number}).code === 11000) throw alreadyPublishing(platform);
    throw error;
  }
  const messageId = await enqueuePublish(job._id.toString(), runAt);
  if (messageId) {
    job.messageId = messageId;
    await job.save();
  }
  return job;
}

type ScheduleInput = {
  scheduledDate: string;
  scheduledTime?: string;
  timezone?: string;
  repeat?: string;
  repeatUntil?: string;
};

export const socialPostService = {
  async list(actor: Actor, filter: {status?: string; platform?: string; date?: string}) {
    const {workspaceId} = await socialWorkspace(actor);
    const query: Record<string, unknown> = {workspaceId};
    if (filter.status) query.status = filter.status;
    if (filter.platform) query['platforms.platform'] = filter.platform;
    if (filter.date) query.scheduledDate = filter.date;
    const posts = await SocialPostModel.find(query).sort({createdAt: -1}).limit(2000).exec();
    return posts.map(serializePost);
  },

  async get(actor: Actor, id: string) {
    const {workspaceId} = await socialWorkspace(actor);
    return serializePost(await findPost(workspaceId, id));
  },

  async create(actor: Actor, input: PostInput & {id: string}) {
    const {workspaceId} = await socialWorkspace(actor);
    const existing = await SocialPostModel.findOne({workspaceId, id: input.id}).exec();
    if (existing) return serializePost(existing);
    const status = CLIENT_STATUSES.includes(input.status as PostStatus) ? input.status : 'draft';
    const post = await SocialPostModel.create({
      ...input,
      workspaceId,
      createdBy: actor.actorId,
      status,
      platforms: mergeTargets([], input.platforms ?? []),
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null
    });
    return serializePost(post);
  },

  /**
   * Brings posts that only existed in this browser's storage onto the server.
   * Existing ids are left alone. Outcome statuses become drafts: nothing was
   * ever queued for them, so showing them as scheduled would be untrue.
   */
  async importPosts(actor: Actor, posts: (PostInput & {id: string})[]) {
    const {workspaceId} = await socialWorkspace(actor);
    const ids = posts.map(p => p.id);
    const existing = new Set(
      (await SocialPostModel.find({workspaceId, id: {$in: ids}}).select('id').exec()).map(p => p.id)
    );
    const fresh = posts.filter(p => !existing.has(p.id));
    if (fresh.length) {
      await SocialPostModel.insertMany(
        fresh.map(input => ({
          ...input,
          workspaceId,
          createdBy: actor.actorId,
          status: CLIENT_STATUSES.includes(input.status as PostStatus) ? input.status : 'draft',
          platforms: mergeTargets([], input.platforms ?? []),
          scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
          ...(input.createdAt ? {createdAt: input.createdAt} : {})
        })),
        {ordered: false}
      );
    }
    return {imported: fresh.length, skipped: posts.length - fresh.length};
  },

  async update(actor: Actor, id: string, patch: PostInput) {
    const {workspaceId} = await socialWorkspace(actor);
    const post = await findPost(workspaceId, id);
    const {platforms, scheduledAt, status, ...rest} = patch;
    delete (rest as Record<string, unknown>).id;

    Object.assign(post, rest);
    if (platforms) post.platforms = mergeTargets(post.platforms, platforms);
    if (scheduledAt !== undefined) post.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;

    const hasQueued = await PublishingJobModel.exists({workspaceId, socialPostId: id, status: 'queued'});

    // Moving a scheduled post back to a planning column unschedules it.
    if (status && CLIENT_STATUSES.includes(status as PostStatus)) {
      if (hasQueued) {
        await cancelJobs(workspaceId, id);
        post.platforms = post.platforms.map(t =>
          t.status === 'scheduled' ? ({...t, status: 'pending'} as PlatformTarget) : t
        );
      }
      post.status = status as PostStatus;
    }
    await post.save();

    // Dragging a scheduled post on the calendar moves its jobs with it.
    if (hasQueued && scheduledAt && !(status && CLIENT_STATUSES.includes(status as PostStatus))) {
      const runAt = new Date(Math.max(Date.now(), new Date(scheduledAt).getTime()));
      const jobs = await PublishingJobModel.find({workspaceId, socialPostId: id, status: 'queued'}).exec();
      for (const job of jobs) {
        await cancelPublish(job.messageId);
        job.runAt = runAt;
        job.messageId = await enqueuePublish(job._id.toString(), runAt);
        await job.save();
      }
    }
    return serializePost(post);
  },

  async remove(actor: Actor, id: string) {
    const {workspaceId} = await socialWorkspace(actor);
    const post = await findPost(workspaceId, id);
    await cancelJobs(workspaceId, id);
    await post.deleteOne();
  },

  /**
   * Queues each enabled platform at the chosen time. Platforms that fail a
   * check (no connected account, content the platform would refuse) are
   * reported and left unscheduled; the rest go ahead.
   */
  async schedule(actor: Actor, id: string, input: ScheduleInput) {
    const {workspaceId} = await socialWorkspace(actor);
    const post = await findPost(workspaceId, id);
    const scheduledAt = zonedToUtc(input.scheduledDate, input.scheduledTime, input.timezone);
    const runAt = new Date(Math.max(Date.now(), scheduledAt.getTime()));

    const running = await PublishingJobModel.findOne({workspaceId, socialPostId: id, status: 'publishing'}).exec();
    if (running) throw alreadyPublishing(running.platform);

    await cancelJobs(workspaceId, id);

    const validation: {platform: SchedulablePlatform; valid: boolean; errors: string[]}[] = [];
    const jobsCreated: string[] = [];
    const jobsSkipped: string[] = [];
    const targets: PlatformTarget[] = [];
    const toQueue: {platform: SchedulablePlatform; accountId: Types.ObjectId; idempotencyKey: string}[] = [];

    for (const target of post.platforms) {
      if (!target.enabled) {
        targets.push(target);
        continue;
      }
      const errors: string[] = [];
      const label = PLATFORM_LABELS[target.platform];
      if (platformMode(target.platform) === 'disabled') errors.push(`${label} is turned off`);
      const account = await resolveAccount(workspaceId, target);
      if (!account) errors.push(`Connect ${/^[AEIOU]/i.test(label) ? 'an' : 'a'} ${label} account first`);
      else if (account.status !== 'active') errors.push(`Reconnect ${account.accountName} (${label})`);
      if (account?.accountType !== REMINDER_ACCOUNT_TYPE) {
        errors.push(...validateContent(target.platform, contentFor(post, target)));
      }

      validation.push({platform: target.platform, valid: errors.length === 0, errors});
      if (errors.length || !account) {
        jobsSkipped.push(target.platform);
        targets.push({...target, status: 'pending', error: errors.join('. '), errorCode: 'NOT_SCHEDULED'});
        continue;
      }
      const idempotencyKey = newIdempotencyKey(post.id, target.platform);
      toQueue.push({platform: target.platform, accountId: account._id as Types.ObjectId, idempotencyKey});
      targets.push({
        ...target,
        status: 'scheduled',
        accountId: account._id.toString(),
        retryCount: 0,
        maxRetries: DEFAULT_MAX_RETRIES,
        idempotencyKey,
        error: undefined,
        errorCode: undefined,
        nextRetryAt: undefined
      });
    }

    post.platforms = targets;
    post.scheduledDate = input.scheduledDate;
    post.scheduledTime = input.scheduledTime;
    post.timezone = input.timezone;
    post.scheduledAt = scheduledAt;
    if (input.repeat) post.repeat = input.repeat;
    if (input.repeatUntil !== undefined) post.repeatUntil = input.repeatUntil;
    post.status = toQueue.length ? 'scheduled' : PLANNING.includes(post.status) ? post.status : 'draft';
    // Saved before the jobs exist, so a job that runs at once is not overwritten by this save.
    await post.save();
    for (const item of toQueue) {
      const job = await createJob(workspaceId, post, item.platform, item.accountId, runAt, item.idempotencyKey);
      jobsCreated.push(job._id.toString());
    }

    return {
      post: serializePost(post),
      scheduledAt: scheduledAt.toISOString(),
      timezone: input.timezone ?? 'UTC',
      jobsCreated,
      jobsSkipped,
      validation
    };
  },

  async cancel(actor: Actor, id: string, platform?: SchedulablePlatform) {
    const {workspaceId} = await socialWorkspace(actor);
    const post = await findPost(workspaceId, id);
    await cancelJobs(workspaceId, id, platform);
    post.platforms = post.platforms.map(t =>
      (!platform || t.platform === platform) && (t.status === 'scheduled' || t.status === 'pending' || t.status === 'reminder')
        ? ({...t, status: 'cancelled'} as PlatformTarget)
        : t
    );
    post.status = aggregateStatus(post);
    await post.save();
    return {post: serializePost(post)};
  },

  /** Re-queues failed (or the named) platforms to publish now. */
  async retry(actor: Actor, id: string, platform?: SchedulablePlatform) {
    const {workspaceId} = await socialWorkspace(actor);
    const post = await findPost(workspaceId, id);
    const retried: SchedulablePlatform[] = [];
    const jobsCreated: string[] = [];
    const jobsSkipped: string[] = [];
    const targets: PlatformTarget[] = [];
    const toQueue: {platform: SchedulablePlatform; accountId: Types.ObjectId; idempotencyKey: string}[] = [];
    for (const target of post.platforms) {
      const wanted = platform ? target.platform === platform : target.status === 'failed';
      if (!wanted || !target.enabled || target.status === 'posted' || target.status === 'publishing') {
        targets.push(target);
        continue;
      }
      const account = await resolveAccount(workspaceId, target);
      if (!account || account.status !== 'active') {
        jobsSkipped.push(target.platform);
        targets.push(target);
        continue;
      }
      await cancelJobs(workspaceId, id, target.platform);
      const idempotencyKey = newIdempotencyKey(post.id, target.platform);
      toQueue.push({platform: target.platform, accountId: account._id as Types.ObjectId, idempotencyKey});
      retried.push(target.platform);
      targets.push({
        ...target,
        status: 'scheduled',
        accountId: account._id.toString(),
        retryCount: 0,
        idempotencyKey,
        error: undefined,
        errorCode: undefined,
        nextRetryAt: undefined
      });
    }
    post.platforms = targets;
    post.status = aggregateStatus(post);
    // Saved before the jobs exist, so a job that runs at once is not overwritten by this save.
    await post.save();
    for (const item of toQueue) {
      const job = await createJob(workspaceId, post, item.platform, item.accountId, new Date(), item.idempotencyKey);
      jobsCreated.push(job._id.toString());
    }
    await refreshPostStatus(post._id as Types.ObjectId);
    const fresh = await findPost(workspaceId, id);
    return {post: serializePost(fresh), retried, jobsCreated, jobsSkipped};
  },

  /**
   * Records that the person posted a reminder target themselves, with an
   * optional link to the live post.
   */
  async markPosted(actor: Actor, id: string, platform: SchedulablePlatform, url?: string) {
    const {workspaceId} = await socialWorkspace(actor);
    const post = await findPost(workspaceId, id);
    const target = post.platforms.find(t => t.platform === platform && t.enabled);
    if (!target) throw new ApiError(404, ErrorCodes.SOCIAL_POST_NOT_FOUND, 'That platform is not part of this post');
    if (target.status !== 'reminder') {
      throw new ApiError(409, ErrorCodes.VALIDATION_ERROR, 'Only a post waiting for you to post it can be marked as posted');
    }
    post.platforms = post.platforms.map(t =>
      t.platform === platform
        ? ({
            ...t,
            status: 'posted',
            manual: true,
            publishedAt: new Date().toISOString(),
            publishedUrl: url,
            error: undefined,
            errorCode: undefined
          } as PlatformTarget)
        : t
    );
    post.status = aggregateStatus(post);
    await post.save();
    return {post: serializePost(post)};
  },

  async listJobs(actor: Actor, filter: {socialPostId?: string; status?: string}) {
    const {workspaceId} = await socialWorkspace(actor);
    const query: Record<string, unknown> = {workspaceId};
    if (filter.socialPostId) query.socialPostId = filter.socialPostId;
    if (filter.status) query.status = filter.status;
    const jobs = await PublishingJobModel.find(query).sort({createdAt: -1}).limit(500).exec();
    return jobs.map(serializeJob);
  }
};
