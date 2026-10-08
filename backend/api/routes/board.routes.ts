import {Router} from 'express';
import {boardController} from '../controllers/board.controller';
import {boardCollaboratorController} from '../controllers/boardCollaborator.controller';
import {listController} from '../controllers/list.controller';
import {cardController} from '../controllers/card.controller';
import {activityController} from '../controllers/activity.controller';
import {pollController} from '../controllers/poll.controller';
import {validateRequest} from '../middleware/validation';
import {requireAuth, requireUser} from '../middleware/auth';
import {requireBoardAccess} from '../middleware/boardAccess';
import {authActionLimiter, authReadLimiter, pollLimiter} from '../middleware/rateLimit';
import {
  activityQuerySchema,
  boardCreateSchema,
  boardIdParamsSchema,
  boardListQuerySchema,
  boardPatchSchema,
  boardPublicSlugParamsSchema,
  boardVisibilityPatchSchema,
  cardCreateSchema,
  cardIdParamsSchema,
  cardMoveSchema,
  cardPatchSchema,
  cardReorderSchema,
  collaboratorIdParamsSchema,
  collaboratorInviteSchema,
  collaboratorRolePatchSchema,
  invitationIdParamsSchema,
  invitationRespondSchema,
  listCreateSchema,
  listIdParamsSchema,
  listPatchSchema,
  listReorderSchema,
  pollQuerySchema
} from '../dtos/product.dto';

const router = Router();

router.use(requireAuth, requireUser);

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

// ── Structure (lists and cards in one read) ───────────────────────
router.get(
  '/:boardId/structure',
  authReadLimiter,
  validateRequest({params: boardIdParamsSchema}),
  requireBoardAccess('read'),
  boardController.structure
);

// ── Audit trail ───────────────────────────────────────────────────
router.get(
  '/:boardId/activity',
  authReadLimiter,
  validateRequest({params: boardIdParamsSchema, query: activityQuerySchema}),
  requireBoardAccess('read'),
  activityController.list
);

// ── Poll (board sync + presence) ──────────────────────────────────
router.get(
  '/:boardId/poll',
  pollLimiter,
  validateRequest({params: boardIdParamsSchema, query: pollQuerySchema}),
  requireBoardAccess('read'),
  pollController.poll
);

// ── Lists ─────────────────────────────────────────────────────────
router.get(
  '/:boardId/lists',
  authReadLimiter,
  validateRequest({params: boardIdParamsSchema}),
  requireBoardAccess('read'),
  listController.list
);

router.post(
  '/:boardId/lists',
  authActionLimiter,
  validateRequest({params: boardIdParamsSchema, body: listCreateSchema}),
  requireBoardAccess('write'),
  listController.create
);

router.patch(
  '/:boardId/list-order',
  authActionLimiter,
  validateRequest({params: boardIdParamsSchema, body: listReorderSchema}),
  requireBoardAccess('write'),
  listController.reorder
);

router.patch(
  '/:boardId/lists/:listId',
  authActionLimiter,
  validateRequest({params: listIdParamsSchema, body: listPatchSchema}),
  requireBoardAccess('write'),
  listController.update
);

router.delete(
  '/:boardId/lists/:listId',
  authActionLimiter,
  validateRequest({params: listIdParamsSchema}),
  requireBoardAccess('write'),
  listController.remove
);

// ── Cards ─────────────────────────────────────────────────────────
router.get(
  '/:boardId/cards',
  authReadLimiter,
  validateRequest({params: boardIdParamsSchema}),
  requireBoardAccess('read'),
  cardController.list
);

router.post(
  '/:boardId/cards',
  authActionLimiter,
  validateRequest({params: boardIdParamsSchema, body: cardCreateSchema}),
  requireBoardAccess('write'),
  cardController.create
);

router.patch(
  '/:boardId/lists/:listId/card-order',
  authActionLimiter,
  validateRequest({params: listIdParamsSchema, body: cardReorderSchema}),
  requireBoardAccess('write'),
  cardController.reorder
);

router.patch(
  '/:boardId/cards/:cardId',
  authActionLimiter,
  validateRequest({params: cardIdParamsSchema, body: cardPatchSchema}),
  requireBoardAccess('write'),
  cardController.update
);

/** Declared after the PATCH so "move" is never read as a card id. */
router.post(
  '/:boardId/cards/:cardId/move',
  authActionLimiter,
  validateRequest({params: cardIdParamsSchema, body: cardMoveSchema}),
  requireBoardAccess('write'),
  cardController.move
);

router.delete(
  '/:boardId/cards/:cardId',
  authActionLimiter,
  validateRequest({params: cardIdParamsSchema}),
  requireBoardAccess('write'),
  cardController.remove
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
