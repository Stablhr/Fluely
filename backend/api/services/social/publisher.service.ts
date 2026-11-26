import {randomBytes} from 'crypto';
import {Types} from 'mongoose';
import {env} from '../../config/env';
import {PLATFORM_LABELS, PostStatus, REMINDER_ACCOUNT_TYPE, SchedulablePlatform} from '../../constants/social';
import {logger} from '../../logging/logger';
import {PublishingJobDocument, PublishingJobModel} from '../../models/PublishingJob.model';
import {SocialAccountModel} from '../../models/SocialAccount.model';
import {PlatformTarget, SocialPostDocument, SocialPostModel} from '../../models/SocialPost.model';
import {notificationService} from '../notification.service';
import {socialAccountService} from './accounts.service';
import {getProvider, platformMode, validateContent} from './providers/registry';
import {ProviderError, PublishContent, PublishResult} from './providers/types';
import {enqueuePublish} from './qstash';

/**
 * Runs publishing jobs: claim → publish (or simulate) → record the outcome on
 * the job and on the post's platform target → recompute the post's status.
 */

/**
 * Runs once a platform is finished for good with a post: tells the author when
 * it failed, and schedules the next post of a repeating series. Never throws,
 * since the publish it follows has already been recorded.
 */
async function afterFinalOutcome(post: SocialPostDocument, platform: SchedulablePlatform, failed: boolean) {
  if (failed) {
    await notificationService
      .notifyPostFailed({userId: post.createdBy, postId: post.id, title: post.title, platformLabel: PLATFORM_LABELS[platform]})
      .catch(err => logger.error({err, postId: post.id}, 'Could not send the failed-post notification'));
  }
  try {
    // Imported here: posts.service imports this module.
    const {scheduleNextOccurrence} = await import('./posts.service');
    await scheduleNextOccurrence(post._id as Types.ObjectId);
  } catch (err) {
    logger.error({err, postId: post.id}, 'Could not schedule the next post of a repeating series');
  }
}

/** A delivery up to this early still runs; earlier ones re-enqueue. */
const EARLY_TOLERANCE_MS = 30_000;
/**
 * A job stuck in `publishing` this long is assumed crashed and marked failed.
 * It is never re-queued: the platform may already have the post.
 */
const STALE_LOCK_MS = 15 * 60 * 1000;

const PLANNING: PostStatus[] = ['idea', 'draft', 'in_review'];

/** The text a platform receives: caption, then any hashtags not already in it. */
export function composeText(caption: string, hashtags: string[]): string {
  const tags = hashtags
    .map(tag => tag.trim().replace(/^#+/, ''))
    .filter(Boolean)
    .filter(tag => !new RegExp(`#${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(caption));
  const suffix = tags.map(tag => `#${tag}`).join(' ');
  return [caption.trim(), suffix].filter(Boolean).join('\n\n');
}

export function contentFor(post: SocialPostDocument, target: PlatformTarget): PublishContent {
  const caption = target.caption?.trim() ? target.caption : post.caption;
  return {
    title: post.title,
    text: composeText(caption ?? '', target.hashtags ?? []),
    hashtags: (target.hashtags ?? []).map(tag => tag.replace(/^#+/, '')),
    media: post.media ?? [],
    visibility: target.visibility ?? 'public',
    altText: target.altText,
    link: target.deepLink
  };
}

/** Overall status from the enabled targets' statuses. */
export function aggregateStatus(post: SocialPostDocument): PostStatus {
  const targets = (post.platforms ?? []).filter(t => t.enabled);
  const statuses = targets.map(t => t.status);
  if (statuses.length === 0) return post.status;
  if (statuses.some(s => s === 'publishing')) return 'publishing';
  // Waiting for its time, or for the person to post it themselves.
  if (statuses.some(s => s === 'scheduled' || s === 'reminder')) return 'scheduled';
  const posted = statuses.filter(s => s === 'posted').length;
  const failed = statuses.filter(s => s === 'failed').length;
  if (posted === statuses.length) return 'posted';
  if (posted > 0) return 'partially_published';
  if (failed > 0) return 'failed';
  if (statuses.every(s => s === 'cancelled')) return 'cancelled';
  return PLANNING.includes(post.status) ? post.status : 'draft';
}

async function setTarget(
  post: SocialPostDocument,
  platform: SchedulablePlatform,
  patch: Partial<PlatformTarget>,
  unset: (keyof PlatformTarget)[] = []
) {
  const $set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) $set[`platforms.$.${key}`] = value;
  const $unset: Record<string, ''> = {};
  for (const key of unset) $unset[`platforms.$.${key}`] = '';
  await SocialPostModel.updateOne(
    {_id: post._id, 'platforms.platform': platform},
    {$set, ...(unset.length ? {$unset} : {})}
  ).exec();
}

export async function refreshPostStatus(postId: Types.ObjectId) {
  const fresh = await SocialPostModel.findById(postId).exec();
  if (!fresh) return;
  const status = aggregateStatus(fresh);
  if (status !== fresh.status) await SocialPostModel.updateOne({_id: postId}, {$set: {status}}).exec();
}

async function simulate(platform: SchedulablePlatform): Promise<PublishResult> {
  if (env.SOCIAL_SIMULATION_FAILURE_RATE > 0 && Math.random() < env.SOCIAL_SIMULATION_FAILURE_RATE) {
    throw new ProviderError(`${PLATFORM_LABELS[platform]} (dry run): simulated outage`, 'SIMULATED_FAILURE', true);
  }
  return {externalPostId: `dryrun_${platform}_${randomBytes(6).toString('hex')}`};
}

async function publishLive(job: PublishingJobDocument, post: SocialPostDocument, content: PublishContent) {
  const account = job.accountId
    ? await SocialAccountModel.findOne({_id: job.accountId, workspaceId: job.workspaceId}).exec()
    : null;
  if (!account) {
    throw new ProviderError(
      `The ${PLATFORM_LABELS[job.platform]} account for this post was disconnected`,
      'ACCOUNT_MISSING',
      false
    );
  }
  if (account.demo) {
    throw new ProviderError(
      `${account.accountName} is a demo account. Connect a real ${PLATFORM_LABELS[job.platform]} account to post live.`,
      'DEMO_ACCOUNT',
      false
    );
  }
  try {
    const accessToken = await socialAccountService.accessToken(account);
    return await getProvider(job.platform).publish({
      account: {platformAccountId: account.platformAccountId, accountType: account.accountType, accessToken},
      content
    });
  } catch (error) {
    if (error instanceof ProviderError && error.authFailed) {
      await SocialAccountModel.updateOne(
        {_id: account._id},
        {$set: {status: 'expired', lastError: error.message}}
      ).exec();
    }
    throw error;
  }
}

/**
 * Runs one job if it is due and not already taken. Safe to call more than
 * once for the same job (duplicate deliveries, the sweep racing QStash).
 */
export async function runPublishingJob(jobId: string): Promise<{status: string}> {
  if (!Types.ObjectId.isValid(jobId)) return {status: 'unknown'};
  const existing = await PublishingJobModel.findById(jobId).exec();
  if (!existing) return {status: 'unknown'};
  if (existing.status !== 'queued') return {status: existing.status};

  // Delivered early (long waits hop in steps of up to 6 days): wait again.
  if (existing.runAt.getTime() - Date.now() > EARLY_TOLERANCE_MS) {
    const messageId = await enqueuePublish(existing._id.toString(), existing.runAt);
    if (messageId) await PublishingJobModel.updateOne({_id: existing._id}, {$set: {messageId}}).exec();
    return {status: 'waiting'};
  }

  const now = new Date();
  const job = await PublishingJobModel.findOneAndUpdate(
    {_id: existing._id, status: 'queued'},
    {$set: {status: 'publishing', lockedAt: now, startedAt: now}},
    {new: true}
  ).exec();
  if (!job) return {status: 'taken'};

  const post = await SocialPostModel.findOne({workspaceId: job.workspaceId, id: job.socialPostId}).exec();
  const target = post?.platforms.find(t => t.platform === job.platform);
  if (!post || !target || !target.enabled || target.status === 'cancelled') {
    await PublishingJobModel.updateOne({_id: job._id}, {$set: {status: 'cancelled', completedAt: new Date()}}).exec();
    return {status: 'cancelled'};
  }

  await setTarget(post, job.platform, {status: 'publishing', lastAttemptAt: now.toISOString()});
  await refreshPostStatus(post._id as Types.ObjectId);

  // Reminder accounts: nothing to publish. Hand it to the person.
  const account = job.accountId ? await SocialAccountModel.findById(job.accountId).lean() : null;
  if (account?.accountType === REMINDER_ACCOUNT_TYPE) {
    await PublishingJobModel.updateOne(
      {_id: job._id},
      {$set: {status: 'completed', completedAt: new Date(), dryRun: false, error: null, errorCode: null}}
    ).exec();
    await setTarget(post, job.platform, {status: 'reminder'}, ['error', 'errorCode', 'nextRetryAt']);
    await refreshPostStatus(post._id as Types.ObjectId);
    logger.info({jobId: job._id.toString(), platform: job.platform}, 'Reminder due for a hand-posted post');
    await afterFinalOutcome(post, job.platform, false);
    return {status: 'reminder'};
  }

  const content = contentFor(post, target);
  const mode = platformMode(job.platform);
  try {
    const problems = validateContent(job.platform, content);
    if (problems.length) throw new ProviderError(problems.join('. '), 'INVALID_CONTENT', false);
    if (mode === 'disabled') {
      throw new ProviderError(`${PLATFORM_LABELS[job.platform]} is turned off`, 'PLATFORM_DISABLED', false);
    }
    const result = mode === 'live' ? await publishLive(job, post, content) : await simulate(job.platform);
    const dryRun = mode !== 'live';

    await PublishingJobModel.updateOne(
      {_id: job._id},
      {
        $set: {
          status: 'completed',
          completedAt: new Date(),
          error: null,
          errorCode: null,
          dryRun,
          publishResult: result
        }
      }
    ).exec();
    await setTarget(
      post,
      job.platform,
      {
        status: 'posted',
        externalPostId: result.externalPostId,
        platformPostId: result.externalPostId,
        ...(result.publishedUrl ? {publishedUrl: result.publishedUrl} : {}),
        publishedAt: new Date().toISOString(),
        retryCount: job.retryCount,
        dryRun
      },
      ['error', 'errorCode', 'nextRetryAt']
    );
    await refreshPostStatus(post._id as Types.ObjectId);
    logger.info({jobId: job._id.toString(), platform: job.platform, dryRun}, 'Social post published');
    await afterFinalOutcome(post, job.platform, false);
    return {status: 'completed'};
  } catch (error) {
    const providerError =
      error instanceof ProviderError
        ? error
        : new ProviderError(`${PLATFORM_LABELS[job.platform]}: ${(error as Error).message}`, 'UNEXPECTED', true);
    const canRetry = providerError.retryable && job.retryCount < job.maxRetries;

    if (canRetry) {
      const retryCount = job.retryCount + 1;
      const runAt = new Date(Date.now() + 2 ** retryCount * 60_000);
      await PublishingJobModel.updateOne(
        {_id: job._id},
        {
          $set: {
            status: 'queued',
            runAt,
            nextRetryAt: runAt,
            retryCount,
            lockedAt: null,
            error: providerError.message,
            errorCode: providerError.code
          }
        }
      ).exec();
      const messageId = await enqueuePublish(job._id.toString(), runAt);
      if (messageId) await PublishingJobModel.updateOne({_id: job._id}, {$set: {messageId}}).exec();
      await setTarget(post, job.platform, {
        status: 'scheduled',
        error: providerError.message,
        errorCode: providerError.code,
        retryCount,
        nextRetryAt: runAt.toISOString()
      });
    } else {
      await PublishingJobModel.updateOne(
        {_id: job._id},
        {
          $set: {
            status: 'failed',
            completedAt: new Date(),
            error: providerError.message,
            errorCode: providerError.code
          }
        }
      ).exec();
      await setTarget(
        post,
        job.platform,
        {status: 'failed', error: providerError.message, errorCode: providerError.code, retryCount: job.retryCount},
        ['nextRetryAt']
      );
    }
    await refreshPostStatus(post._id as Types.ObjectId);
    logger.warn(
      {jobId: job._id.toString(), platform: job.platform, code: providerError.code, retry: canRetry},
      'Social post publish failed'
    );
    if (!canRetry) await afterFinalOutcome(post, job.platform, true);
    return {status: canRetry ? 'retrying' : 'failed'};
  }
}

/** Fails jobs whose run was cut off mid-publish, so a person checks the platform before retrying. */
async function failStaleJobs(): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_LOCK_MS);
  const stale = await PublishingJobModel.find({status: 'publishing', lockedAt: {$lt: cutoff}}).exec();
  for (const job of stale) {
    const label = PLATFORM_LABELS[job.platform];
    const error = `Publishing to ${label} was interrupted. Check ${label} before retrying: the post may already be live.`;
    const claimed = await PublishingJobModel.updateOne(
      {_id: job._id, status: 'publishing', lockedAt: {$lt: cutoff}},
      {$set: {status: 'failed', completedAt: new Date(), lockedAt: null, error, errorCode: 'INTERRUPTED'}}
    ).exec();
    if (!claimed.modifiedCount) continue;
    const post = await SocialPostModel.findOne({workspaceId: job.workspaceId, id: job.socialPostId}).exec();
    if (!post) continue;
    await setTarget(post, job.platform, {status: 'failed', error, errorCode: 'INTERRUPTED'}, ['nextRetryAt']);
    await refreshPostStatus(post._id as Types.ObjectId);
    logger.warn({jobId: job._id.toString(), platform: job.platform}, 'Publishing job interrupted; marked failed');
    await afterFinalOutcome(post, job.platform, true);
  }
}

/** One sweep stops starting new jobs after this long, to finish inside the function's time limit. */
const SWEEP_BUDGET_MS = 45_000;

/**
 * Publishes everything due, in batches, until nothing is due or the time
 * budget runs out. The safety net behind QStash, and the scheduler in local
 * development.
 */
export async function publishDueJobs(batchSize = 20, budgetMs = SWEEP_BUDGET_MS): Promise<{processed: number}> {
  const deadline = Date.now() + budgetMs;
  await failStaleJobs();
  // A job that crashes before it is claimed stays due; skip it for the rest of this sweep.
  const seen: Types.ObjectId[] = [];
  while (Date.now() < deadline) {
    const due = await PublishingJobModel.find({status: 'queued', runAt: {$lte: new Date()}, _id: {$nin: seen}})
      .sort({runAt: 1})
      .limit(batchSize)
      .select('_id')
      .exec();
    if (due.length === 0) break;
    for (const job of due) {
      if (Date.now() >= deadline) break;
      seen.push(job._id as Types.ObjectId);
      try {
        await runPublishingJob(job._id.toString());
      } catch (error) {
        logger.error({err: error, jobId: job._id.toString()}, 'Publishing job crashed');
      }
    }
  }
  return {processed: seen.length};
}
