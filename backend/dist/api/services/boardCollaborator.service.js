"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.boardCollaboratorService = void 0;
const mongoose_1 = require("mongoose");
const boardCollaborator_repository_1 = require("../repositories/boardCollaborator.repository");
const user_repository_1 = require("../repositories/user.repository");
const board_repository_1 = require("../repositories/board.repository");
const error_1 = require("../utils/error");
const errorCodes_1 = require("../constants/errorCodes");
const logger_1 = require("../logging/logger");
function serializeCollaborator(row, person) {
    return {
        id: row._id.toString(),
        userId: row.userId.toString(),
        role: row.role,
        status: row.status,
        invitedBy: row.invitedBy.toString(),
        invitedAt: row.invitedAt,
        respondedAt: row.respondedAt,
        firstName: person?.firstName ?? '',
        lastName: person?.lastName ?? '',
        email: person?.email ?? '',
        username: person?.username
    };
}
async function findRowOrThrow(board, collaboratorId) {
    if (!mongoose_1.Types.ObjectId.isValid(collaboratorId)) {
        throw new error_1.ApiError(400, errorCodes_1.ErrorCodes.VALIDATION_ERROR, 'collaboratorId must be a valid ObjectId');
    }
    const row = await boardCollaborator_repository_1.boardCollaboratorRepository.findByIdForBoard(collaboratorId, board._id);
    if (!row) {
        throw new error_1.ApiError(404, errorCodes_1.ErrorCodes.COLLABORATOR_NOT_FOUND, 'Collaborator not found');
    }
    return row;
}
exports.boardCollaboratorService = {
    /** Owner-only, enforced by the route. */
    async list(board) {
        const rows = await boardCollaborator_repository_1.boardCollaboratorRepository.listForBoard(board._id);
        const people = await Promise.all(rows.map(row => user_repository_1.userRepository.findById(row.userId.toString())));
        return rows.map((row, index) => serializeCollaborator(row, people[index]));
    },
    /**
     * Owner-only. A re-invite replaces the existing row and resets it to pending,
     * so somebody who previously declined can be invited again.
     */
    async invite(actor, board, email, role) {
        const invitee = await user_repository_1.userRepository.findByEmail(email);
        if (!invitee) {
            // Deliberately vague: do not confirm whether an address is registered.
            throw new error_1.ApiError(404, errorCodes_1.ErrorCodes.USER_NOT_FOUND, 'No account matches that email');
        }
        if (invitee._id.equals(board.ownerId)) {
            throw new error_1.ApiError(400, errorCodes_1.ErrorCodes.CANNOT_INVITE_SELF, 'You already own this board');
        }
        const existing = await boardCollaborator_repository_1.boardCollaboratorRepository.find(board._id, invitee._id);
        if (existing && existing.status === 'accepted') {
            throw new error_1.ApiError(409, errorCodes_1.ErrorCodes.COLLABORATOR_EXISTS, 'That person already has access to this board');
        }
        let row;
        if (existing) {
            await boardCollaborator_repository_1.boardCollaboratorRepository.update(existing._id.toString(), {
                role,
                status: 'pending',
                invitedBy: actor.actorId,
                invitedAt: new Date(),
                respondedAt: null
            });
            row = await boardCollaborator_repository_1.boardCollaboratorRepository.find(board._id, invitee._id);
        }
        else {
            row = await boardCollaborator_repository_1.boardCollaboratorRepository.create({
                boardId: board._id,
                userId: invitee._id,
                role,
                status: 'pending',
                invitedBy: actor.actorId
            });
        }
        logger_1.logger.info({ boardId: board._id.toString(), userId: invitee._id.toString(), role }, 'Board invitation sent');
        return serializeCollaborator(row, invitee);
    },
    /** Owner-only. */
    async setRole(board, collaboratorId, role) {
        const row = await findRowOrThrow(board, collaboratorId);
        if (row.userId.equals(board.ownerId)) {
            throw new error_1.ApiError(400, errorCodes_1.ErrorCodes.CANNOT_MODIFY_OWNER, "The owner's role cannot be changed");
        }
        await boardCollaborator_repository_1.boardCollaboratorRepository.setRole(row._id.toString(), role);
        return { id: row._id.toString(), userId: row.userId.toString(), role };
    },
    /** Owner-only. */
    async remove(board, collaboratorId) {
        const row = await findRowOrThrow(board, collaboratorId);
        if (row.userId.equals(board.ownerId)) {
            throw new error_1.ApiError(400, errorCodes_1.ErrorCodes.CANNOT_MODIFY_OWNER, 'The owner cannot be removed from their own board');
        }
        await boardCollaborator_repository_1.boardCollaboratorRepository.delete(row._id.toString());
        return { message: 'Collaborator removed' };
    },
    /**
     * The invitee answers their own invitation. The lookup is scoped to the
     * authenticated user, so one person can never accept an invitation addressed
     * to somebody else.
     */
    async respond(actor, collaboratorId, decision) {
        if (!mongoose_1.Types.ObjectId.isValid(collaboratorId)) {
            throw new error_1.ApiError(400, errorCodes_1.ErrorCodes.VALIDATION_ERROR, 'collaboratorId must be a valid ObjectId');
        }
        const row = await boardCollaborator_repository_1.boardCollaboratorRepository.findByIdForUser(collaboratorId, actor.actorId);
        if (!row) {
            throw new error_1.ApiError(404, errorCodes_1.ErrorCodes.COLLABORATOR_NOT_FOUND, 'Invitation not found');
        }
        if (row.status !== 'pending') {
            throw new error_1.ApiError(409, errorCodes_1.ErrorCodes.VALIDATION_ERROR, `This invitation was already ${row.status}`);
        }
        await boardCollaborator_repository_1.boardCollaboratorRepository.setStatus(row._id.toString(), decision, new Date());
        const board = await board_repository_1.boardRepository.findById(row.boardId.toString());
        logger_1.logger.info({ boardId: row.boardId.toString(), userId: actor.actorId.toString(), decision }, 'Board invitation answered');
        return {
            id: row._id.toString(),
            boardId: row.boardId.toString(),
            boardName: board?.name ?? '',
            role: row.role,
            status: decision
        };
    },
    /** Invitations waiting on the signed-in person. */
    async listPendingForUser(actor) {
        const rows = await boardCollaborator_repository_1.boardCollaboratorRepository.listPendingForUser(actor.actorId);
        const boards = await board_repository_1.boardRepository.listByIds(rows.map(row => row.boardId));
        const owners = await Promise.all(boards.map(board => user_repository_1.userRepository.findById(board.ownerId.toString())));
        const boardNameById = new Map(boards.map(board => [board._id.toString(), board.name]));
        return rows.map((row, index) => ({
            id: row._id.toString(),
            boardId: row.boardId.toString(),
            boardName: boardNameById.get(row.boardId.toString()) ?? '',
            role: row.role,
            invitedAt: row.invitedAt,
            invitedByName: owners[index]
                ? `${owners[index].firstName} ${owners[index].lastName}`.trim()
                : ''
        }));
    }
};
