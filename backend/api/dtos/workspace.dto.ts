import {z} from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');
const name = z.string().trim().min(1).max(120);
const email = z.string().trim().toLowerCase().email().max(320);

export const workspaceIdParamsSchema = z.object({workspaceId: objectId});
export const workspaceMemberParamsSchema = z.object({
  workspaceId: objectId,
  userId: objectId
});

export const workspaceCreateSchema = z.object({
  name
});

export const workspacePatchSchema = z
  .object({
    name: name.optional()
  })
  .refine(value => Object.keys(value).length > 0, 'At least one field is required');

export const workspaceMemberCreateSchema = z.object({
  email
});

export const workspaceJoinSchema = z.object({
  code: z.string().trim().min(6).max(64)
});

export const workspaceListQuerySchema = z.object({
  search: z.string().trim().max(200).optional()
});

export type WorkspaceCreateInput = z.infer<typeof workspaceCreateSchema>;
export type WorkspacePatchInput = z.infer<typeof workspacePatchSchema>;
export type WorkspaceJoinInput = z.infer<typeof workspaceJoinSchema>;
