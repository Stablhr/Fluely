import {z} from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');
const text = (max: number) => z.string().trim().max(max);
const requiredText = (max: number) => z.string().trim().min(1).max(max);
const optionalDate = z.string().datetime({offset: true}).optional();
const localDateTime = z.string().trim().min(1).max(80);

export function isIanaTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', {timeZone: value}).format();
    return true;
  } catch {
    return false;
  }
}

const timezone = z.string().trim().refine(isIanaTimezone, 'Invalid IANA timezone');

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export const boardIdParamsSchema = z.object({boardId: objectId});
export const listIdParamsSchema = z.object({boardId: objectId, listId: objectId});
export const cardIdParamsSchema = z.object({boardId: objectId, cardId: objectId});
export const labelIdParamsSchema = z.object({boardId: objectId, labelId: requiredText(80)});
export const memberIdParamsSchema = z.object({boardId: objectId, memberId: objectId});
export const invitationIdParamsSchema = z.object({invitationId: objectId});
export const shareIdParamsSchema = z.object({shareId: objectId});
export const tokenParamsSchema = z.object({token: requiredText(32)});
export const mediaIdParamsSchema = z.object({mediaId: objectId});
export const inboxIdParamsSchema = z.object({inboxId: objectId});
export const accountIdParamsSchema = z.object({accountId: objectId});
export const postIdParamsSchema = z.object({postId: objectId});
export const jobIdParamsSchema = z.object({jobId: objectId});
export const socialCardParamsSchema = z.object({boardId: objectId, cardId: objectId});

export const preferencesSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']).optional(),
  timezone: timezone.optional()
}).refine(value => value.theme !== undefined || value.timezone !== undefined, 'At least one preference is required');

export const preferencesPatchSchema = preferencesSchema;

export const inboxCreateSchema = z.object({
  title: requiredText(200),
  content: text(10000).default(''),
  source: text(200).optional(),
  boardId: objectId.optional(),
  cardId: objectId.optional(),
  scheduledAt: optionalDate
});

export const inboxPatchSchema = z.object({
  title: requiredText(200).optional(),
  content: text(10000).optional(),
  source: text(200).optional(),
  boardId: objectId.nullable().optional(),
  cardId: objectId.nullable().optional(),
  scheduledAt: z.string().datetime({offset: true}).nullable().optional(),
  dismissedAt: z.string().datetime({offset: true}).nullable().optional()
}).refine(value => Object.keys(value).length > 0, 'At least one field is required');

export const inboxListQuerySchema = paginationQuerySchema.extend({
  search: text(200).optional(),
  status: z.enum(['active', 'scheduled', 'dismissed', 'all']).default('active')
});

export const boardCreateSchema = z.object({
  name: requiredText(120),
  description: text(5000).default(''),
  visibility: z.enum(['private', 'workspace', 'public']).default('private'),
  background: text(500).default('default'),
  settings: z.object({
    commentPermission: z.enum(['everyone', 'members', 'editors']).default('members'),
    selfJoin: z.boolean().default(false)
  }).default({commentPermission: 'members', selfJoin: false}),
  labels: z.array(z.object({
    id: requiredText(80),
    name: requiredText(60),
    color: requiredText(30)
  })).max(50).default([]),
  template: z.enum(['blank', 'simple', 'social_content']).default('blank')
});

export const boardPatchSchema = z.object({
  name: requiredText(120).optional(),
  description: text(5000).optional(),
  visibility: z.enum(['private', 'workspace', 'public']).optional(),
  background: text(500).optional(),
  settings: z.object({
    commentPermission: z.enum(['everyone', 'members', 'editors']).optional(),
    selfJoin: z.boolean().optional()
  }).optional(),
  labels: z.array(z.object({
    id: requiredText(80),
    name: requiredText(60),
    color: requiredText(30)
  })).max(50).optional(),
  listOrder: z.array(objectId).max(1000).optional(),
  archivedAt: z.string().datetime({offset: true}).nullable().optional(),
  expectedRevision: z.number().int().positive().optional()
}).refine(value => Object.keys(value).length > 0, 'At least one field is required');

export const boardListQuerySchema = paginationQuerySchema.extend({
  scope: z.enum(['accessible', 'discoverable']).default('accessible'),
  search: text(200).optional(),
  visibility: z.enum(['private', 'workspace', 'public']).optional()
});

export const listCreateSchema = z.object({
  name: requiredText(120),
  assignee: objectId.nullable().optional(),
  backgroundColor: text(30).optional(),
  position: z.number().finite().optional(),
  expectedRevision: z.number().int().positive().optional()
});

export const listPatchSchema = z.object({
  name: requiredText(120).optional(),
  assignee: objectId.nullable().optional(),
  collapsed: z.boolean().optional(),
  cardOrder: z.array(objectId).max(10000).optional(),
  backgroundColor: text(30).nullable().optional(),
  position: z.number().finite().optional(),
  archivedAt: z.string().datetime({offset: true}).nullable().optional(),
  expectedRevision: z.number().int().positive().optional()
}).refine(value => Object.keys(value).length > 0, 'At least one field is required');

export const listReorderSchema = z.object({
  listOrder: z.array(objectId).min(1).max(1000),
  expectedRevision: z.number().int().positive()
});

export const cardCreateSchema = z.object({
  listId: objectId,
  title: requiredText(300),
  desc: text(20000).default(''),
  coverMediaId: objectId.nullable().optional(),
  coverSize: z.enum(['small', 'medium', 'large', 'full']).default('medium'),
  labelIds: z.array(requiredText(80)).max(50).default([]),
  memberIds: z.array(objectId).max(100).default([]),
  dueDate: optionalDate,
  startDate: optionalDate,
  location: text(500).nullable().optional(),
  watching: z.boolean().default(false),
  mediaIds: z.array(objectId).max(100).default([]),
  expectedRevision: z.number().int().positive().optional()
});

export const cardPatchSchema = z.object({
  title: requiredText(300).optional(),
  desc: text(20000).optional(),
  coverMediaId: objectId.nullable().optional(),
  coverSize: z.enum(['small', 'medium', 'large', 'full']).optional(),
  labelIds: z.array(requiredText(80)).max(50).optional(),
  memberIds: z.array(objectId).max(100).optional(),
  dueDate: z.string().datetime({offset: true}).nullable().optional(),
  startDate: z.string().datetime({offset: true}).nullable().optional(),
  location: text(500).nullable().optional(),
  watching: z.boolean().optional(),
  archived: z.boolean().optional(),
  done: z.boolean().optional(),
  mediaIds: z.array(objectId).max(100).optional(),
  expectedRevision: z.number().int().positive().optional()
}).refine(value => Object.keys(value).length > 0, 'At least one field is required');

export const cardMoveSchema = z.object({
  listId: objectId,
  cardOrder: z.array(objectId).max(10000).optional(),
  expectedRevision: z.number().int().positive()
});

export const cardReorderSchema = z.object({
  cardOrder: z.array(objectId).min(1).max(10000),
  expectedRevision: z.number().int().positive()
});

export const labelCreateSchema = z.object({
  name: requiredText(60),
  color: requiredText(30)
});

export const labelPatchSchema = z.object({
  name: requiredText(60).optional(),
  color: requiredText(30).optional()
}).refine(value => Object.keys(value).length > 0, 'At least one field is required');

export const commentCreateSchema = z.object({
  body: requiredText(5000)
});

export const commentPatchSchema = z.object({
  body: requiredText(5000)
});

export const reactionSchema = z.object({
  emoji: requiredText(20)
});

export const memberCreateSchema = z.object({
  actorType: z.enum(['user', 'admin']),
  actorId: objectId,
  role: z.enum(['editor', 'viewer']).default('viewer'),
  color: text(30).optional()
});

export const memberPatchSchema = z.object({
  role: z.enum(['owner', 'editor', 'viewer']).optional(),
  color: text(30).nullable().optional(),
  starred: z.boolean().optional(),
  lastVisitedAt: z.string().datetime({offset: true}).nullable().optional()
}).refine(value => Object.keys(value).length > 0, 'At least one field is required');

export const invitationCreateSchema = z.object({
  email: z.string().trim().email().max(320),
  role: z.enum(['editor', 'viewer']).default('viewer')
});

export const shareCreateSchema = z.object({
  hint: requiredText(120),
  expiresAt: z.string().datetime({offset: true}).optional()
});

export const mediaListQuerySchema = paginationQuerySchema.extend({
  kind: z.enum(['image', 'video', 'audio', 'document']).optional(),
  search: text(200).optional()
});

export const socialAccountCreateSchema = z.object({
  platform: z.enum(['instagram', 'facebook', 'x', 'linkedin', 'tiktok', 'youtube']),
  handle: requiredText(100),
  displayName: requiredText(120).optional()
});

export const socialAccountPatchSchema = z.object({
  handle: requiredText(100).optional(),
  displayName: requiredText(120).optional()
}).refine(value => Object.keys(value).length > 0, 'At least one field is required');

const repeatSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  interval: z.number().int().min(1).max(12).default(1),
  count: z.number().int().min(1).max(52).default(1)
});

const socialPostFields = {
  title: requiredText(300),
  caption: text(2200).default(''),
  mediaIds: z.array(objectId).max(20).default([]),
  cardId: objectId.nullable().optional(),
  platforms: z.array(z.enum(['instagram', 'facebook', 'x', 'linkedin', 'tiktok', 'youtube'])).min(1).max(6),
  tags: z.array(requiredText(50)).max(30).default([]),
  aiGeneration: z.boolean().default(false),
  schedule: z.object({
    localDateTime: localDateTime,
    timezone,
    repeat: repeatSchema.default({frequency: 'daily', interval: 1, count: 1})
  }).optional()
};

export const socialPostCreateSchema = z.object(socialPostFields);

export const socialPostPatchSchema = z.object({
  title: requiredText(300).optional(),
  caption: text(2200).optional(),
  mediaIds: z.array(objectId).max(20).optional(),
  cardId: objectId.nullable().optional(),
  platforms: z.array(z.enum(['instagram', 'facebook', 'x', 'linkedin', 'tiktok', 'youtube'])).min(1).max(6).optional(),
  tags: z.array(requiredText(50)).max(30).optional(),
  aiGeneration: z.boolean().optional(),
  schedule: z.object({
    localDateTime: localDateTime,
    timezone,
    repeat: repeatSchema.default({frequency: 'daily', interval: 1, count: 1})
  }).nullable().optional()
}).refine(value => Object.keys(value).length > 0, 'At least one field is required');

export const socialPostListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['draft', 'scheduled', 'queued', 'published', 'failed', 'cancelled']).optional(),
  cardId: objectId.optional(),
  search: text(200).optional()
});

export const runDueSchema = z.object({
  failNextJobId: objectId.optional(),
  forceFailure: z.boolean().default(false)
});

export const retryJobSchema = z.object({
  forceFailure: z.boolean().default(false)
});

export const captionSchema = z.object({
  title: requiredText(300),
  tone: z.enum(['neutral', 'friendly', 'professional', 'playful']).default('friendly'),
  keywords: z.array(requiredText(50)).max(20).default([]),
  platform: z.enum(['instagram', 'facebook', 'x', 'linkedin', 'tiktok', 'youtube']).optional()
});

export const activityQuerySchema = paginationQuerySchema.extend({
  type: text(80).optional()
});

export const exportQuerySchema = z.object({
  includeArchived: z.coerce.boolean().default(true)
});

export type BoardCreateInput = z.infer<typeof boardCreateSchema>;
export type BoardPatchInput = z.infer<typeof boardPatchSchema>;
export type ListCreateInput = z.infer<typeof listCreateSchema>;
export type ListPatchInput = z.infer<typeof listPatchSchema>;
export type CardCreateInput = z.infer<typeof cardCreateSchema>;
export type CardPatchInput = z.infer<typeof cardPatchSchema>;
export type CardMoveInput = z.infer<typeof cardMoveSchema>;
export type MemberCreateInput = z.infer<typeof memberCreateSchema>;
export type MemberPatchInput = z.infer<typeof memberPatchSchema>;
export type InvitationCreateInput = z.infer<typeof invitationCreateSchema>;
export type ShareCreateInput = z.infer<typeof shareCreateSchema>;
export type InboxCreateInput = z.infer<typeof inboxCreateSchema>;
export type InboxPatchInput = z.infer<typeof inboxPatchSchema>;
export type PreferencesInput = z.infer<typeof preferencesSchema>;
export type SocialPostCreateInput = z.infer<typeof socialPostCreateSchema>;
export type SocialPostPatchInput = z.infer<typeof socialPostPatchSchema>;
export type SocialAccountCreateInput = z.infer<typeof socialAccountCreateSchema>;
export type SocialAccountPatchInput = z.infer<typeof socialAccountPatchSchema>;
export type RunDueInput = z.infer<typeof runDueSchema>;
export type CaptionInput = z.infer<typeof captionSchema>;
