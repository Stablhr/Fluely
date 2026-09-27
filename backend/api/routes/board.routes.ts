import {Router} from 'express';
import {boardController} from '../controllers/board.controller';
import {boardCollaboratorController} from '../controllers/boardCollaborator.controller';
import {validateRequest} from '../middleware/validation';
import {requireUser} from '../middleware/auth';
import {requireBoardAccess} from '../middleware/boardAccess';
import {authActionLimiter, authReadLimiter} from '../middleware/rateLimit';
import {
  boardCreateSchema,
  boardIdParamsSchema,
  boardListQuerySchema,
  boardPatchSchema,
  boardPublicSlugParamsSchema,
  boardVisibilityPatchSchema,
  collaboratorIdParamsSchema,
  collaboratorInviteSchema,
  collaboratorRolePatchSchema,
  invitationIdParamsSchema,
  invitationRespondSchema
} from '../dtos/product.dto';

const router = Router();

router.use(requireUser);

// ── Public by slug ────────────────────────────────────────────────
// Declared before `/:boardId` so "public" is never read as an id.
// Still requires a signed-in user account, per the product default.
router.get(
  '/public/:boardPublicSlug',
  authReadLimiter,
  validateRequest({params: boardPublicSlugParamsSchema}),
  boardController.getPublic
);

// ── Collection ────────────────────────────────────────────────────
router.get(
  '/',
  authReadLimiter,
  validateRequest({query: boardListQuerySchema}),
  boardController.list
);

router.post(
  '/',
  authActionLimiter,
  validateRequest({body: boardCreateSchema}),
  boardController.create
);

// ── Invitations for the signed-in person ──────────────────────────
router.get(
  '/invitations',
  authReadLimiter,
  boardCollaboratorController.listPending
);

router.post(
  '/invitations/:invitationId',
  authActionLimiter,
  validateRequest({params: invitationIdParamsSchema, body: invitationRespondSchema}),
  boardCollaboratorController.respond
);

// ── Single board ──────────────────────────────────────────────────
router.get(
  '/:boardId',
  authReadLimiter,
  validateRequest({params: boardIdParamsSchema}),
  requireBoardAccess('read'),
  boardController.get
);

router.patch(
  '/:boardId',
  authActionLimiter,
  validateRequest({params: boardIdParamsSchema, body: boardPatchSchema}),
  requireBoardAccess('write'),
  boardController.update
);

router.delete(
  '/:boardId',
  authActionLimiter,
  validateRequest({params: boardIdParamsSchema}),
  requireBoardAccess('owner'),
  boardController.remove
);

/**
 * Visibility is owner-only, and deliberately not folded into the general board
 * PATCH: a separate route keeps the narrower permission check unambiguous.
 */
router.patch(
  '/:boardId/visibility',
  authActionLimiter,
  validateRequest({params: boardIdParamsSchema, body: boardVisibilityPatchSchema}),
  requireBoardAccess('owner'),
  boardController.setVisibility
);

// ── Collaborators ─────────────────────────────────────────────────
router.get(
  '/:boardId/collaborators',
  authReadLimiter,
  validateRequest({params: boardIdParamsSchema}),
  requireBoardAccess('read'),
  boardCollaboratorController.list
);

router.post(
  '/:boardId/collaborators',
  authActionLimiter,
  validateRequest({params: boardIdParamsSchema, body: collaboratorInviteSchema}),
  requireBoardAccess('owner'),
  boardCollaboratorController.invite
);

router.patch(
  '/:boardId/collaborators/:collaboratorId',
  authActionLimiter,
  validateRequest({
    params: collaboratorIdParamsSchema,
    body: collaboratorRolePatchSchema
  }),
  requireBoardAccess('owner'),
  boardCollaboratorController.setRole
);

router.delete(
  '/:boardId/collaborators/:collaboratorId',
  authActionLimiter,
  validateRequest({params: collaboratorIdParamsSchema}),
  requireBoardAccess('owner'),
  boardCollaboratorController.remove
);

export default router;
