import {Router} from 'express';
import {workspaceController} from '../controllers/workspace.controller';
import {validateRequest} from '../middleware/validation';
import {requireUser} from '../middleware/auth';
import {authActionLimiter, authReadLimiter} from '../middleware/rateLimit';
import {
  workspaceCreateSchema,
  workspaceIdParamsSchema,
  workspaceJoinSchema,
  workspaceListQuerySchema,
  workspaceMemberCreateSchema,
  workspaceMemberParamsSchema,
  workspacePatchSchema
} from '../dtos/workspace.dto';

const router = Router();

// Workspaces are only ever read or written by signed-in user accounts.
router.use(requireUser);

router.get(
  '/',
  authReadLimiter,
  validateRequest({query: workspaceListQuerySchema}),
  workspaceController.list
);

router.post(
  '/join',
  authActionLimiter,
  validateRequest({body: workspaceJoinSchema}),
  workspaceController.join
);

router.post(
  '/',
  authActionLimiter,
  validateRequest({body: workspaceCreateSchema}),
  workspaceController.create
);

router.get(
  '/:workspaceId',
  authReadLimiter,
  validateRequest({params: workspaceIdParamsSchema}),
  workspaceController.detail
);

router.patch(
  '/:workspaceId',
  authActionLimiter,
  validateRequest({params: workspaceIdParamsSchema, body: workspacePatchSchema}),
  workspaceController.rename
);

router.get(
  '/:workspaceId/members',
  authReadLimiter,
  validateRequest({params: workspaceIdParamsSchema}),
  workspaceController.listMembers
);

router.post(
  '/:workspaceId/members',
  authActionLimiter,
  validateRequest({params: workspaceIdParamsSchema, body: workspaceMemberCreateSchema}),
  workspaceController.addMember
);

router.delete(
  '/:workspaceId/members/:userId',
  authActionLimiter,
  validateRequest({params: workspaceMemberParamsSchema}),
  workspaceController.removeMember
);

export default router;
