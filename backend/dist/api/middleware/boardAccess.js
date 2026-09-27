"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireBoardAccess = requireBoardAccess;
const board_repository_1 = require("../repositories/board.repository");
const boardAccess_service_1 = require("../services/boardAccess.service");
const actor_1 = require("../utils/actor");
const error_1 = require("../utils/error");
const errorCodes_1 = require("../constants/errorCodes");
/**
 * The only way a board route may be reached. Resolves the actor's access level
 * once and hangs both the board and the level on the request, so handlers never
 * re-derive permissions.
 *
 * A board the actor cannot see is reported as 404 whether or not it exists, so
 * this never confirms the existence of a private board. Someone who can see the
 * board but lacks the required level gets a 403, which is not a leak.
 */
function requireBoardAccess(requirement) {
    return async (req, _res, next) => {
        try {
            const actor = (0, actor_1.actorFromRequest)(req);
            const board = await board_repository_1.boardRepository.findById(req.params.boardId);
            // A missing board and an invisible one are reported identically, so this
            // never confirms that a private board exists.
            if (!board) {
                throw new error_1.ApiError(404, errorCodes_1.ErrorCodes.BOARD_NOT_FOUND, 'Board not found');
            }
            const level = await (0, boardAccess_service_1.getBoardAccessLevel)(actor, board);
            if (level === 'none') {
                throw new error_1.ApiError(404, errorCodes_1.ErrorCodes.BOARD_NOT_FOUND, 'Board not found');
            }
            if (requirement === 'owner' && level !== 'owner') {
                throw new error_1.ApiError(403, errorCodes_1.ErrorCodes.FORBIDDEN, 'Only the board owner can do that');
            }
            if (requirement === 'write' && !(0, boardAccess_service_1.canWrite)(level)) {
                throw new error_1.ApiError(403, errorCodes_1.ErrorCodes.FORBIDDEN, level === 'viewer'
                    ? 'You have view-only access to this board'
                    : 'You do not have edit access to this board');
            }
            req.board = board;
            req.boardAccess = level;
            next();
        }
        catch (error) {
            next(error);
        }
    };
}
