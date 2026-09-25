export const ActorTypes = ['user', 'admin'] as const;
export type ActorType = (typeof ActorTypes)[number];

export const BoardRoles = ['owner', 'editor', 'viewer'] as const;
export type BoardRole = (typeof BoardRoles)[number];

export const BoardVisibilities = ['private', 'workspace', 'public'] as const;
export type BoardVisibility = (typeof BoardVisibilities)[number];

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
