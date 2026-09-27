"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.boardCollaboratorController = void 0;
const boardCollaborator_service_1 = require("../services/boardCollaborator.service");
const actor_1 = require("../utils/actor");
const error_1 = require("../utils/error");
const errorCodes_1 = require("../constants/errorCodes");
function requireBoard(req) {
    if (!req.board) {
        throw new error_1.ApiError(404, errorCodes_1.ErrorCodes.BOARD_NOT_FOUND, 'Board not found');
    }
    return req.board;
}
exports.boardCollaboratorController = {
    async list(req, res, next) {
        try {
            res.status(200).json({
                collaborators: await boardCollaborator_service_1.boardCollaboratorService.list(requireBoard(req))
            });
        }
        catch (error) {
            next(error);
        }
    },
    async invite(req, res, next) {
        try {
            const actor = (0, actor_1.actorFromRequest)(req);
            res.status(201).json({
                collaborator: await boardCollaborator_service_1.boardCollaboratorService.invite(actor, requireBoard(req), req.body.email, req.body.role)
            });
        }
        catch (error) {
            next(error);
        }
    },
    async setRole(req, res, next) {
        try {
            res.status(200).json(await boardCollaborator_service_1.boardCollaboratorService.setRole(requireBoard(req), req.params.collaboratorId, req.body.role));
        }
        catch (error) {
            next(error);
        }
    },
    async remove(req, res, next) {
        try {
            res.status(200).json(await boardCollaborator_service_1.boardCollaboratorService.remove(requireBoard(req), req.params.collaboratorId));
        }
        catch (error) {
            next(error);
        }
    },
    /** Not board-scoped: the invitation id is looked up against the caller. */
    async respond(req, res, next) {
        try {
            const actor = (0, actor_1.actorFromRequest)(req);
            res.status(200).json(await boardCollaborator_service_1.boardCollaboratorService.respond(actor, req.params.invitationId, req.body.decision));
        }
        catch (error) {
            next(error);
        }
    },
    async listPending(req, res, next) {
        try {
            const actor = (0, actor_1.actorFromRequest)(req);
            res.status(200).json({
                invitations: await boardCollaborator_service_1.boardCollaboratorService.listPendingForUser(actor)
            });
        }
        catch (error) {
            next(error);
        }
    }
};
