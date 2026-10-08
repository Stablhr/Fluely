export const ActorTypes = ['user', 'admin'] as const;
export type ActorType = (typeof ActorTypes)[number];

export const BoardRoles = ['owner', 'editor', 'viewer'] as const;
export type BoardRole = (typeof BoardRoles)[number];

export const BoardVisibilities = ['private', 'workspace', 'public'] as const;
export type BoardVisibility = (typeof BoardVisibilities)[number];

/**
 * Collaborator roles. Deliberately narrower than BoardRoles: 'owner' is implied
 * by Board.ownerId and can never be handed to a collaborator record.
 */
export const CollaboratorRoles = ['editor', 'viewer'] as const;
export type CollaboratorRole = (typeof CollaboratorRoles)[number];

/** Lifecycle of a board invitation. Only 'accepted' grants any access. */
export const CollaboratorStatuses = ['pending', 'accepted', 'declined'] as const;
export type CollaboratorStatus = (typeof CollaboratorStatuses)[number];

/**
 * The single vocabulary the permission matrix is written in. Every board route
 * resolves one of these, and the value is echoed to the client on each board so
 * the UI can gate controls without recomputing anything.
 *
 * Write access is exactly: 'owner' or 'editor'. Nothing else may mutate, and
 * visibility mode alone never confers write.
 */
export const BoardAccessLevels = [
  'owner',
  'editor',
  'viewer',
  'workspace-view',
  'public-view',
  'none'
] as const;
export type BoardAccessLevel = (typeof BoardAccessLevels)[number];

export const WRITE_ACCESS_LEVELS: readonly BoardAccessLevel[] = ['owner', 'editor'];

export const BoardTemplates = ['blank', 'simple', 'social_content'] as const;
export type BoardTemplate = (typeof BoardTemplates)[number];

export const SocialPlatforms = ['instagram', 'facebook', 'x', 'linkedin', 'tiktok', 'youtube'] as const;
export type SocialPlatform = (typeof SocialPlatforms)[number];

export const SocialPostStatuses = ['draft', 'scheduled', 'queued', 'published', 'failed', 'cancelled'] as const;
export type SocialPostStatus = (typeof SocialPostStatuses)[number];

export const SocialJobStatuses = ['queued', 'running', 'succeeded', 'failed', 'cancelled'] as const;
export type SocialJobStatus = (typeof SocialJobStatuses)[number];

export const RepeatFrequencies = ['daily', 'weekly', 'monthly'] as const;
export type RepeatFrequency = (typeof RepeatFrequencies)[number];

export const MediaKinds = ['image', 'video', 'audio', 'document'] as const;
export type MediaKind = (typeof MediaKinds)[number];

/**
 * The audit trail's vocabulary. Names the event, not the wording — the sentence
 * shown in the activity feed is assembled by the client from the type plus the
 * metadata recorded with it, so copy can change without a data migration.
 *
 * Adapted to the boards domain (lists and cards rather than generic tasks).
 * Every value here must also exist in the ActivityLog model's enum.
 */
export const ActivityActionTypes = [
  'board.updated',
  'board.visibility_changed',
  'board.deleted',
  'list.created',
  'list.updated',
  'list.archived',
  'list.deleted',
  'card.created',
  'card.updated',
  'card.status_changed',
  'card.assigned',
  'card.moved',
  'card.archived',
  'card.deleted',
  'collaborator.invited',
  'collaborator.role_changed',
  'collaborator.removed',
  'collaborator.accepted'
] as const;
export type ActivityActionType = (typeof ActivityActionTypes)[number];

/** What an activity entry points at. Free-form ids, so the target is a string. */
export const ActivityTargetTypes = [
  'board',
  'list',
  'card',
  'collaborator'
] as const;
export type ActivityTargetType = (typeof ActivityTargetTypes)[number];

/**
 * In-app notifications. Each type names the event, not the wording: the copy
 * lives with the consumer so it can change without a data migration.
 */
export const NotificationTypes = [
  'board_invitation',
  'board_invitation_accepted',
  'board_invitation_declined'
] as const;
export type NotificationType = (typeof NotificationTypes)[number];
