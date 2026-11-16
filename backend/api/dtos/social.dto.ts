import {z} from 'zod';
import {
  PlatformTargetStatuses,
  PostStatuses,
  SchedulablePlatforms
} from '../constants/social';

const httpUrl = z
  .string()
  .max(2000)
  .optional()
  .transform(value => (value && /^https?:\/\//.test(value) ? value : undefined));

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const clock = z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:mm');

/** The planner sends '' for "not set"; treat it as absent (or null, to clear). */
const blank = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(value => (value === '' ? undefined : value), schema);
const blankNull = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(value => (value === '' ? null : value), schema);

export const platformParamsSchema = z.object({platform: z.enum(SchedulablePlatforms)});
export const accountIdParamsSchema = z.object({id: z.string().min(1).max(40)});
export const postIdParamsSchema = z.object({id: z.string().min(1).max(100)});

const targetSchema = z.object({
  platform: z.enum(SchedulablePlatforms),
  enabled: z.boolean().default(true),
  status: z.enum(PlatformTargetStatuses).optional(),
  accountId: z.string().max(40).nullable().optional(),
  caption: z.string().max(70000).default(''),
  hashtags: z.array(z.string().max(200)).max(60).default([]),
  mentions: z.array(z.string().max(200)).max(60).default([]),
  location: z.string().max(300).optional(),
  altText: z.string().max(1500).optional(),
  visibility: z.enum(['public', 'private', 'friends', 'unlisted']).default('public'),
  deepLink: httpUrl
});

/**
 * Media metadata only. The browser keeps a `dataUrl` preview of each file,
 * which is never sent to the server: platforms fetch `storageUrl`.
 */
const mediaSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.enum(['image', 'video', 'audio']),
  name: z.string().max(300).default(''),
  storageUrl: httpUrl,
  mediaId: z.string().max(100).optional(),
  publicId: z.string().max(300).optional(),
  size: z.number().nonnegative().default(0),
  thumbnailUrl: httpUrl,
  mimeType: z.string().max(100).optional(),
  duration: z.number().nonnegative().optional(),
  width: z.number().nonnegative().optional(),
  height: z.number().nonnegative().optional(),
  platformCompat: z.array(z.string().max(30)).max(10).default([]),
  uploadedAt: z.string().max(40).optional()
});

const postFields = {
  title: z.string().max(300).default(''),
  caption: z.string().max(70000).default(''),
  // Older browser data can hold platforms that are no longer schedulable.
  platforms: z
    .array(z.unknown())
    .max(10)
    .default([])
    .transform(items =>
      items.flatMap(item => {
        const parsed = targetSchema.safeParse(item);
        return parsed.success ? [parsed.data] : [];
      })
    ),
  media: z.array(mediaSchema).max(20).default([]),
  cardId: blank(z.string().max(100).nullish()).transform(v => v ?? undefined),
  scheduledDate: blank(isoDate.nullish()).transform(v => v ?? undefined),
  scheduledTime: blank(clock.nullish()).transform(v => v ?? undefined),
  scheduledAt: blankNull(z.string().datetime({offset: true}).nullable().optional()),
  timezone: blank(z.string().max(64).nullish()).transform(v => v ?? undefined),
  status: z.enum(PostStatuses).optional(),
  repeat: z.enum(['none', 'daily', 'weekdays', 'weekly', 'biweekly', 'monthly']).default('none'),
  repeatUntil: blank(isoDate.nullish()).transform(v => v ?? undefined),
  analytics: z.array(z.record(z.unknown())).max(10).optional(),
  aiGeneration: z.record(z.unknown()).optional(),
  tags: z.array(z.string().max(60)).max(30).default([]),
  notes: z.string().max(10000).nullish().transform(v => v ?? undefined)
};

export const postCreateSchema = z.object({id: z.string().min(1).max(100), ...postFields});

export const postPatchSchema = z
  .object({
    title: z.string().max(300).optional(),
    caption: z.string().max(70000).optional(),
    platforms: z
      .array(z.unknown())
      .max(10)
      .optional()
      .transform(items =>
        items?.flatMap(item => {
          const parsed = targetSchema.safeParse(item);
          return parsed.success ? [parsed.data] : [];
        })
      ),
    media: z.array(mediaSchema).max(20).optional(),
    cardId: blankNull(z.string().max(100).nullable().optional()),
    scheduledDate: blankNull(isoDate.nullable().optional()),
    scheduledTime: blankNull(clock.nullable().optional()),
    scheduledAt: postFields.scheduledAt,
    timezone: blankNull(z.string().max(64).nullable().optional()),
    status: z.enum(PostStatuses).optional(),
    repeat: z.enum(['none', 'daily', 'weekdays', 'weekly', 'biweekly', 'monthly']).optional(),
    repeatUntil: blankNull(isoDate.nullable().optional()),
    analytics: postFields.analytics,
    aiGeneration: postFields.aiGeneration,
    tags: z.array(z.string().max(60)).max(30).optional(),
    notes: z.string().max(10000).nullable().optional()
  })
  .transform(value => {
    // `null` clears a field; Mongoose takes `undefined` as "unset".
    const out: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(value)) {
      if (field === undefined) continue;
      out[key] = field === null && key !== 'scheduledAt' ? undefined : field;
    }
    return out;
  });

export const postImportSchema = z.object({
  posts: z
    .array(z.unknown())
    .max(500)
    .transform(items =>
      items.flatMap(item => {
        const parsed = postCreateSchema
          .extend({createdAt: z.string().datetime({offset: true}).optional()})
          .safeParse(item);
        return parsed.success ? [parsed.data] : [];
      })
    )
});

export const postListQuerySchema = z.object({
  status: z.enum(PostStatuses).optional(),
  platform: z.enum(SchedulablePlatforms).optional(),
  date: isoDate.optional()
});

export const scheduleSchema = z.object({
  scheduledDate: isoDate,
  scheduledTime: blank(clock.optional()),
  timezone: blank(z.string().max(64).optional()),
  repeat: z.enum(['none', 'daily', 'weekdays', 'weekly', 'biweekly', 'monthly']).optional(),
  repeatUntil: blank(isoDate.optional())
});

export const connectBodySchema = z.object({
  returnTo: z.enum(['planner', 'settings']).default('planner')
});

export const platformBodySchema = z.object({platform: z.enum(SchedulablePlatforms).optional()});

export const jobListQuerySchema = z.object({
  socialPostId: z.string().max(100).optional(),
  status: z.enum(['queued', 'locked', 'publishing', 'completed', 'failed', 'cancelled']).optional()
});

export const oauthCallbackQuerySchema = z.object({
  code: z.string().max(4000).optional(),
  state: z.string().max(4000).optional(),
  error: z.string().max(500).optional(),
  error_description: z.string().max(1000).optional()
});
