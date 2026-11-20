/**
 * Platforms a post can be scheduled to. Kept apart from `SocialPlatforms` in
 * `product.ts`, which also lists `x` for the older planning data; X is not
 * schedulable because its API no longer offers free posting.
 */
export const SchedulablePlatforms = ['facebook', 'tiktok', 'youtube', 'linkedin'] as const;
export type SchedulablePlatform = (typeof SchedulablePlatforms)[number];

/** Per-platform switch, from `<PLATFORM>_MODE`. */
export const PlatformModes = ['live', 'dryrun', 'disabled'] as const;
export type PlatformMode = (typeof PlatformModes)[number];

/**
 * `accountType` of a reminder account: no sign-in and no API. At the post's
 * time Fluely reminds the person instead of publishing, e.g. for a personal
 * Facebook profile, which Facebook's API does not allow apps to post to.
 */
export const REMINDER_ACCOUNT_TYPE = 'reminder';

export const SocialAccountStatuses = ['active', 'expired', 'revoked', 'error'] as const;
export type SocialAccountStatus = (typeof SocialAccountStatuses)[number];

/** Mirrors the frontend `SocialPostStatus`: planning stages, then outcomes. */
export const PostStatuses = [
  'idea',
  'draft',
  'in_review',
  'scheduled',
  'publishing',
  'posted',
  'partially_published',
  'failed',
  'cancelled'
] as const;
export type PostStatus = (typeof PostStatuses)[number];

/** Mirrors the frontend `PlatformStatus`. */
export const PlatformTargetStatuses = [
  'pending',
  'scheduled',
  'publishing',
  'posted',
  'failed',
  'cancelled',
  /** A reminder account's time came: the person posts it themselves. */
  'reminder'
] as const;
export type PlatformTargetStatus = (typeof PlatformTargetStatuses)[number];

/** Mirrors the frontend `PublishingJob.status`. */
export const PublishJobStatuses = [
  'queued',
  'locked',
  'publishing',
  'completed',
  'failed',
  'cancelled'
] as const;
export type PublishJobStatus = (typeof PublishJobStatuses)[number];

export const PLATFORM_LABELS: Record<SchedulablePlatform, string> = {
  facebook: 'Facebook',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  linkedin: 'LinkedIn'
};

/** Attempts per platform target before it is marked failed for good. */
export const DEFAULT_MAX_RETRIES = 3;
