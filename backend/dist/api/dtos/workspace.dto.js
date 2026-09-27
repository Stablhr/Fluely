"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workspaceListQuerySchema = exports.workspaceJoinSchema = exports.workspaceMemberCreateSchema = exports.workspacePatchSchema = exports.workspaceCreateSchema = exports.workspaceMemberParamsSchema = exports.workspaceIdParamsSchema = void 0;
const zod_1 = require("zod");
const objectId = zod_1.z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');
const name = zod_1.z.string().trim().min(1).max(120);
const email = zod_1.z.string().trim().toLowerCase().email().max(320);
exports.workspaceIdParamsSchema = zod_1.z.object({ workspaceId: objectId });
exports.workspaceMemberParamsSchema = zod_1.z.object({
    workspaceId: objectId,
    userId: objectId
});
exports.workspaceCreateSchema = zod_1.z.object({
    name
});
exports.workspacePatchSchema = zod_1.z
    .object({
    name: name.optional()
})
    .refine(value => Object.keys(value).length > 0, 'At least one field is required');
exports.workspaceMemberCreateSchema = zod_1.z.object({
    email
});
exports.workspaceJoinSchema = zod_1.z.object({
    code: zod_1.z.string().trim().min(6).max(64)
});
exports.workspaceListQuerySchema = zod_1.z.object({
    search: zod_1.z.string().trim().max(200).optional()
});
