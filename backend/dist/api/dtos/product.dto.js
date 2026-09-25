"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportQuerySchema = exports.activityQuerySchema = exports.captionSchema = exports.retryJobSchema = exports.runDueSchema = exports.socialPostListQuerySchema = exports.socialPostPatchSchema = exports.socialPostCreateSchema = exports.socialAccountPatchSchema = exports.socialAccountCreateSchema = exports.mediaListQuerySchema = exports.shareCreateSchema = exports.invitationCreateSchema = exports.memberPatchSchema = exports.memberCreateSchema = exports.reactionSchema = exports.commentPatchSchema = exports.commentCreateSchema = exports.labelPatchSchema = exports.labelCreateSchema = exports.cardReorderSchema = exports.cardMoveSchema = exports.cardPatchSchema = exports.cardCreateSchema = exports.listReorderSchema = exports.listPatchSchema = exports.listCreateSchema = exports.boardListQuerySchema = exports.boardPatchSchema = exports.boardCreateSchema = exports.inboxListQuerySchema = exports.inboxPatchSchema = exports.inboxCreateSchema = exports.preferencesPatchSchema = exports.preferencesSchema = exports.socialCardParamsSchema = exports.jobIdParamsSchema = exports.postIdParamsSchema = exports.accountIdParamsSchema = exports.inboxIdParamsSchema = exports.mediaIdParamsSchema = exports.tokenParamsSchema = exports.shareIdParamsSchema = exports.invitationIdParamsSchema = exports.memberIdParamsSchema = exports.labelIdParamsSchema = exports.cardIdParamsSchema = exports.listIdParamsSchema = exports.boardIdParamsSchema = exports.paginationQuerySchema = void 0;
exports.isIanaTimezone = isIanaTimezone;
const zod_1 = require("zod");
const objectId = zod_1.z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');
const text = (max) => zod_1.z.string().trim().max(max);
const requiredText = (max) => zod_1.z.string().trim().min(1).max(max);
const optionalDate = zod_1.z.string().datetime({ offset: true }).optional();
const localDateTime = zod_1.z.string().trim().min(1).max(80);
function isIanaTimezone(value) {
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
        return true;
    }
    catch {
        return false;
    }
}
const timezone = zod_1.z.string().trim().refine(isIanaTimezone, 'Invalid IANA timezone');
exports.paginationQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20)
});
exports.boardIdParamsSchema = zod_1.z.object({ boardId: objectId });
exports.listIdParamsSchema = zod_1.z.object({ boardId: objectId, listId: objectId });
exports.cardIdParamsSchema = zod_1.z.object({ boardId: objectId, cardId: objectId });
exports.labelIdParamsSchema = zod_1.z.object({ boardId: objectId, labelId: requiredText(80) });
exports.memberIdParamsSchema = zod_1.z.object({ boardId: objectId, memberId: objectId });
exports.invitationIdParamsSchema = zod_1.z.object({ invitationId: objectId });
exports.shareIdParamsSchema = zod_1.z.object({ shareId: objectId });
exports.tokenParamsSchema = zod_1.z.object({ token: requiredText(32) });
exports.mediaIdParamsSchema = zod_1.z.object({ mediaId: objectId });
exports.inboxIdParamsSchema = zod_1.z.object({ inboxId: objectId });
exports.accountIdParamsSchema = zod_1.z.object({ accountId: objectId });
exports.postIdParamsSchema = zod_1.z.object({ postId: objectId });
exports.jobIdParamsSchema = zod_1.z.object({ jobId: objectId });
exports.socialCardParamsSchema = zod_1.z.object({ boardId: objectId, cardId: objectId });
exports.preferencesSchema = zod_1.z.object({
    theme: zod_1.z.enum(['system', 'light', 'dark']).optional(),
    timezone: timezone.optional()
}).refine(value => value.theme !== undefined || value.timezone !== undefined, 'At least one preference is required');
exports.preferencesPatchSchema = exports.preferencesSchema;
exports.inboxCreateSchema = zod_1.z.object({
    title: requiredText(200),
    content: text(10000).default(''),
    source: text(200).optional(),
    boardId: objectId.optional(),
    cardId: objectId.optional(),
    scheduledAt: optionalDate
});
exports.inboxPatchSchema = zod_1.z.object({
    title: requiredText(200).optional(),
    content: text(10000).optional(),
    source: text(200).optional(),
    boardId: objectId.nullable().optional(),
    cardId: objectId.nullable().optional(),
    scheduledAt: zod_1.z.string().datetime({ offset: true }).nullable().optional(),
    dismissedAt: zod_1.z.string().datetime({ offset: true }).nullable().optional()
}).refine(value => Object.keys(value).length > 0, 'At least one field is required');
exports.inboxListQuerySchema = exports.paginationQuerySchema.extend({
    search: text(200).optional(),
    status: zod_1.z.enum(['active', 'scheduled', 'dismissed', 'all']).default('active')
});
exports.boardCreateSchema = zod_1.z.object({
    name: requiredText(120),
    description: text(5000).default(''),
    visibility: zod_1.z.enum(['private', 'workspace', 'public']).default('private'),
    background: text(500).default('default'),
    settings: zod_1.z.object({
        commentPermission: zod_1.z.enum(['everyone', 'members', 'editors']).default('members'),
        selfJoin: zod_1.z.boolean().default(false)
    }).default({ commentPermission: 'members', selfJoin: false }),
    labels: zod_1.z.array(zod_1.z.object({
        id: requiredText(80),
        name: requiredText(60),
        color: requiredText(30)
    })).max(50).default([]),
    template: zod_1.z.enum(['blank', 'simple', 'social_content']).default('blank')
});
exports.boardPatchSchema = zod_1.z.object({
    name: requiredText(120).optional(),
    description: text(5000).optional(),
    visibility: zod_1.z.enum(['private', 'workspace', 'public']).optional(),
    background: text(500).optional(),
    settings: zod_1.z.object({
        commentPermission: zod_1.z.enum(['everyone', 'members', 'editors']).optional(),
        selfJoin: zod_1.z.boolean().optional()
    }).optional(),
    labels: zod_1.z.array(zod_1.z.object({
        id: requiredText(80),
        name: requiredText(60),
        color: requiredText(30)
    })).max(50).optional(),
    listOrder: zod_1.z.array(objectId).max(1000).optional(),
    archivedAt: zod_1.z.string().datetime({ offset: true }).nullable().optional(),
    expectedRevision: zod_1.z.number().int().positive().optional()
}).refine(value => Object.keys(value).length > 0, 'At least one field is required');
exports.boardListQuerySchema = exports.paginationQuerySchema.extend({
    scope: zod_1.z.enum(['accessible', 'discoverable']).default('accessible'),
    search: text(200).optional(),
    visibility: zod_1.z.enum(['private', 'workspace', 'public']).optional()
});
exports.listCreateSchema = zod_1.z.object({
    name: requiredText(120),
    assignee: objectId.nullable().optional(),
    backgroundColor: text(30).optional(),
    position: zod_1.z.number().finite().optional(),
    expectedRevision: zod_1.z.number().int().positive().optional()
});
exports.listPatchSchema = zod_1.z.object({
    name: requiredText(120).optional(),
    assignee: objectId.nullable().optional(),
    collapsed: zod_1.z.boolean().optional(),
    cardOrder: zod_1.z.array(objectId).max(10000).optional(),
    backgroundColor: text(30).nullable().optional(),
    position: zod_1.z.number().finite().optional(),
    archivedAt: zod_1.z.string().datetime({ offset: true }).nullable().optional(),
    expectedRevision: zod_1.z.number().int().positive().optional()
}).refine(value => Object.keys(value).length > 0, 'At least one field is required');
exports.listReorderSchema = zod_1.z.object({
    listOrder: zod_1.z.array(objectId).min(1).max(1000),
    expectedRevision: zod_1.z.number().int().positive()
});
exports.cardCreateSchema = zod_1.z.object({
    listId: objectId,
    title: requiredText(300),
    desc: text(20000).default(''),
    coverMediaId: objectId.nullable().optional(),
    coverSize: zod_1.z.enum(['small', 'medium', 'large', 'full']).default('medium'),
    labelIds: zod_1.z.array(requiredText(80)).max(50).default([]),
    memberIds: zod_1.z.array(objectId).max(100).default([]),
    dueDate: optionalDate,
    startDate: optionalDate,
    location: text(500).nullable().optional(),
    watching: zod_1.z.boolean().default(false),
    mediaIds: zod_1.z.array(objectId).max(100).default([]),
    expectedRevision: zod_1.z.number().int().positive().optional()
});
exports.cardPatchSchema = zod_1.z.object({
    title: requiredText(300).optional(),
    desc: text(20000).optional(),
    coverMediaId: objectId.nullable().optional(),
    coverSize: zod_1.z.enum(['small', 'medium', 'large', 'full']).optional(),
    labelIds: zod_1.z.array(requiredText(80)).max(50).optional(),
    memberIds: zod_1.z.array(objectId).max(100).optional(),
    dueDate: zod_1.z.string().datetime({ offset: true }).nullable().optional(),
    startDate: zod_1.z.string().datetime({ offset: true }).nullable().optional(),
    location: text(500).nullable().optional(),
    watching: zod_1.z.boolean().optional(),
    archived: zod_1.z.boolean().optional(),
    done: zod_1.z.boolean().optional(),
    mediaIds: zod_1.z.array(objectId).max(100).optional(),
    expectedRevision: zod_1.z.number().int().positive().optional()
}).refine(value => Object.keys(value).length > 0, 'At least one field is required');
exports.cardMoveSchema = zod_1.z.object({
    listId: objectId,
    cardOrder: zod_1.z.array(objectId).max(10000).optional(),
    expectedRevision: zod_1.z.number().int().positive()
});
exports.cardReorderSchema = zod_1.z.object({
    cardOrder: zod_1.z.array(objectId).min(1).max(10000),
    expectedRevision: zod_1.z.number().int().positive()
});
exports.labelCreateSchema = zod_1.z.object({
    name: requiredText(60),
    color: requiredText(30)
});
exports.labelPatchSchema = zod_1.z.object({
    name: requiredText(60).optional(),
    color: requiredText(30).optional()
}).refine(value => Object.keys(value).length > 0, 'At least one field is required');
exports.commentCreateSchema = zod_1.z.object({
    body: requiredText(5000)
});
exports.commentPatchSchema = zod_1.z.object({
    body: requiredText(5000)
});
exports.reactionSchema = zod_1.z.object({
    emoji: requiredText(20)
});
exports.memberCreateSchema = zod_1.z.object({
    actorType: zod_1.z.enum(['user', 'admin']),
    actorId: objectId,
    role: zod_1.z.enum(['editor', 'viewer']).default('viewer'),
    color: text(30).optional()
});
exports.memberPatchSchema = zod_1.z.object({
    role: zod_1.z.enum(['owner', 'editor', 'viewer']).optional(),
    color: text(30).nullable().optional(),
    starred: zod_1.z.boolean().optional(),
    lastVisitedAt: zod_1.z.string().datetime({ offset: true }).nullable().optional()
}).refine(value => Object.keys(value).length > 0, 'At least one field is required');
exports.invitationCreateSchema = zod_1.z.object({
    email: zod_1.z.string().trim().email().max(320),
    role: zod_1.z.enum(['editor', 'viewer']).default('viewer')
});
exports.shareCreateSchema = zod_1.z.object({
    hint: requiredText(120),
    expiresAt: zod_1.z.string().datetime({ offset: true }).optional()
});
exports.mediaListQuerySchema = exports.paginationQuerySchema.extend({
    kind: zod_1.z.enum(['image', 'video', 'audio', 'document']).optional(),
    search: text(200).optional()
});
exports.socialAccountCreateSchema = zod_1.z.object({
    platform: zod_1.z.enum(['instagram', 'facebook', 'x', 'linkedin', 'tiktok', 'youtube']),
    handle: requiredText(100),
    displayName: requiredText(120).optional()
});
exports.socialAccountPatchSchema = zod_1.z.object({
    handle: requiredText(100).optional(),
    displayName: requiredText(120).optional()
}).refine(value => Object.keys(value).length > 0, 'At least one field is required');
const repeatSchema = zod_1.z.object({
    frequency: zod_1.z.enum(['daily', 'weekly', 'monthly']),
    interval: zod_1.z.number().int().min(1).max(12).default(1),
    count: zod_1.z.number().int().min(1).max(52).default(1)
});
const socialPostFields = {
    title: requiredText(300),
    caption: text(2200).default(''),
    mediaIds: zod_1.z.array(objectId).max(20).default([]),
    cardId: objectId.nullable().optional(),
    platforms: zod_1.z.array(zod_1.z.enum(['instagram', 'facebook', 'x', 'linkedin', 'tiktok', 'youtube'])).min(1).max(6),
    tags: zod_1.z.array(requiredText(50)).max(30).default([]),
    aiGeneration: zod_1.z.boolean().default(false),
    schedule: zod_1.z.object({
        localDateTime: localDateTime,
        timezone,
        repeat: repeatSchema.default({ frequency: 'daily', interval: 1, count: 1 })
    }).optional()
};
exports.socialPostCreateSchema = zod_1.z.object(socialPostFields);
exports.socialPostPatchSchema = zod_1.z.object({
    title: requiredText(300).optional(),
    caption: text(2200).optional(),
    mediaIds: zod_1.z.array(objectId).max(20).optional(),
    cardId: objectId.nullable().optional(),
    platforms: zod_1.z.array(zod_1.z.enum(['instagram', 'facebook', 'x', 'linkedin', 'tiktok', 'youtube'])).min(1).max(6).optional(),
    tags: zod_1.z.array(requiredText(50)).max(30).optional(),
    aiGeneration: zod_1.z.boolean().optional(),
    schedule: zod_1.z.object({
        localDateTime: localDateTime,
        timezone,
        repeat: repeatSchema.default({ frequency: 'daily', interval: 1, count: 1 })
    }).nullable().optional()
}).refine(value => Object.keys(value).length > 0, 'At least one field is required');
exports.socialPostListQuerySchema = exports.paginationQuerySchema.extend({
    status: zod_1.z.enum(['draft', 'scheduled', 'queued', 'published', 'failed', 'cancelled']).optional(),
    cardId: objectId.optional(),
    search: text(200).optional()
});
exports.runDueSchema = zod_1.z.object({
    failNextJobId: objectId.optional(),
    forceFailure: zod_1.z.boolean().default(false)
});
exports.retryJobSchema = zod_1.z.object({
    forceFailure: zod_1.z.boolean().default(false)
});
exports.captionSchema = zod_1.z.object({
    title: requiredText(300),
    tone: zod_1.z.enum(['neutral', 'friendly', 'professional', 'playful']).default('friendly'),
    keywords: zod_1.z.array(requiredText(50)).max(20).default([]),
    platform: zod_1.z.enum(['instagram', 'facebook', 'x', 'linkedin', 'tiktok', 'youtube']).optional()
});
exports.activityQuerySchema = exports.paginationQuerySchema.extend({
    type: text(80).optional()
});
exports.exportQuerySchema = zod_1.z.object({
    includeArchived: zod_1.z.coerce.boolean().default(true)
});
