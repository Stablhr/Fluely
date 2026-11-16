/**
 * Platforms a post can be scheduled to. Kept apart from `SocialPlatforms` in
 * `product.ts`, which also lists `x` for the older planning data; X is not
 * schedulable because its API no longer offers free posting.
 */
export const SchedulablePlatforms = ['instagram', 'facebook', 'tiktok', 'youtube', 'linkedin'] as const;
export type SchedulablePlatform = (typeof SchedulablePlatforms)[number];

/** Per-platform switch, from `<PLATFORM>_MODE`. */
export const PlatformModes = ['live', 'dryrun', 'disabled'] as const;
export type PlatformMode = (typeof PlatformModes)[number];

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
  'cancelled'
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
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  linkedin: 'LinkedIn'
};

/** Attempts per platform target before it is marked failed for good. */
export const DEFAULT_MAX_RETRIES = 3;
