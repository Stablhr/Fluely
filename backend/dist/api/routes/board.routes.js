"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const board_controller_1 = require("../controllers/board.controller");
const boardCollaborator_controller_1 = require("../controllers/boardCollaborator.controller");
const validation_1 = require("../middleware/validation");
const auth_1 = require("../middleware/auth");
const boardAccess_1 = require("../middleware/boardAccess");
const rateLimit_1 = require("../middleware/rateLimit");
const product_dto_1 = require("../dtos/product.dto");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth, auth_1.requireUser);
// ── Public by slug ────────────────────────────────────────────────
// Declared before `/:boardId` so "public" is never read as an id.
// Still requires a signed-in user account, per the product default.
router.get('/public/:boardPublicSlug', rateLimit_1.authReadLimiter, (0, validation_1.validateRequest)({ params: product_dto_1.boardPublicSlugParamsSchema }), board_controller_1.boardController.getPublic);
// ── Collection ────────────────────────────────────────────────────
router.get('/', rateLimit_1.authReadLimiter, (0, validation_1.validateRequest)({ query: product_dto_1.boardListQuerySchema }), board_controller_1.boardController.list);
router.post('/', rateLimit_1.authActionLimiter, (0, validation_1.validateRequest)({ body: product_dto_1.boardCreateSchema }), board_controller_1.boardController.create);
// ── Invitations for the signed-in person ──────────────────────────
router.get('/invitations', rateLimit_1.authReadLimiter, boardCollaborator_controller_1.boardCollaboratorController.listPending);
router.post('/invitations/:invitationId', rateLimit_1.authActionLimiter, (0, validation_1.validateRequest)({ params: product_dto_1.invitationIdParamsSchema, body: product_dto_1.invitationRespondSchema }), boardCollaborator_controller_1.boardCollaboratorController.respond);
// ── Single board ──────────────────────────────────────────────────
router.get('/:boardId', rateLimit_1.authReadLimiter, (0, validation_1.validateRequest)({ params: product_dto_1.boardIdParamsSchema }), (0, boardAccess_1.requireBoardAccess)('read'), board_controller_1.boardController.get);
router.patch('/:boardId', rateLimit_1.authActionLimiter, (0, validation_1.validateRequest)({ params: product_dto_1.boardIdParamsSchema, body: product_dto_1.boardPatchSchema }), (0, boardAccess_1.requireBoardAccess)('write'), board_controller_1.boardController.update);
router.delete('/:boardId', rateLimit_1.authActionLimiter, (0, validation_1.validateRequest)({ params: product_dto_1.boardIdParamsSchema }), (0, boardAccess_1.requireBoardAccess)('owner'), board_controller_1.boardController.remove);
/**
 * Visibility is owner-only, and deliberately not folded into the general board
 * PATCH: a separate route keeps the narrower permission check unambiguous.
 */
router.patch('/:boardId/visibility', rateLimit_1.authActionLimiter, (0, validation_1.validateRequest)({ params: product_dto_1.boardIdParamsSchema, body: product_dto_1.boardVisibilityPatchSchema }), (0, boardAccess_1.requireBoardAccess)('owner'), board_controller_1.boardController.setVisibility);
// ── Collaborators ─────────────────────────────────────────────────
router.get('/:boardId/collaborators', rateLimit_1.authReadLimiter, (0, validation_1.validateRequest)({ params: product_dto_1.boardIdParamsSchema }), (0, boardAccess_1.requireBoardAccess)('read'), boardCollaborator_controller_1.boardCollaboratorController.list);
router.post('/:boardId/collaborators', rateLimit_1.authActionLimiter, (0, validation_1.validateRequest)({ params: product_dto_1.boardIdParamsSchema, body: product_dto_1.collaboratorInviteSchema }), (0, boardAccess_1.requireBoardAccess)('owner'), boardCollaborator_controller_1.boardCollaboratorController.invite);
router.patch('/:boardId/collaborators/:collaboratorId', rateLimit_1.authActionLimiter, (0, validation_1.validateRequest)({
    params: product_dto_1.collaboratorIdParamsSchema,
    body: product_dto_1.collaboratorRolePatchSchema
}), (0, boardAccess_1.requireBoardAccess)('owner'), boardCollaborator_controller_1.boardCollaboratorController.setRole);
router.delete('/:boardId/collaborators/:collaboratorId', rateLimit_1.authActionLimiter, (0, validation_1.validateRequest)({ params: product_dto_1.collaboratorIdParamsSchema }), (0, boardAccess_1.requireBoardAccess)('owner'), boardCollaborator_controller_1.boardCollaboratorController.remove);
exports.default = router;
