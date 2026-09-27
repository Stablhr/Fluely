import {NextFunction, Request, Response} from 'express';
import {boardRepository} from '../repositories/board.repository';
import {
  getBoardAccessLevel,
  canWrite
} from '../services/boardAccess.service';
import {actorFromRequest} from '../utils/actor';
import {ApiError} from '../utils/error';
import {ErrorCodes} from '../constants/errorCodes';
import {BoardDocument} from '../models/Board.model';
import {BoardAccessLevel} from '../constants/product';

export type BoardRequirement = 'read' | 'write' | 'owner';

declare global {
  namespace Express {
    interface Request {
      board?: BoardDocument;
      boardAccess?: BoardAccessLevel;
    }
  }
}

/**
 * The only way a board route may be reached. Resolves the actor's access level
 * once and hangs both the board and the level on the request, so handlers never
 * re-derive permissions.
 *
 * A board the actor cannot see is reported as 404 whether or not it exists, so
 * this never confirms the existence of a private board. Someone who can see the
 * board but lacks the required level gets a 403, which is not a leak.
 */
export function requireBoardAccess(requirement: BoardRequirement) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const actor = actorFromRequest(req);
      const board = await boardRepository.findById(req.params.boardId);

      // A missing board and an invisible one are reported identically, so this
      // never confirms that a private board exists.
      if (!board) {
        throw new ApiError(404, ErrorCodes.BOARD_NOT_FOUND, 'Board not found');
      }

      const level = await getBoardAccessLevel(actor, board);

      if (level === 'none') {
        throw new ApiError(404, ErrorCodes.BOARD_NOT_FOUND, 'Board not found');
      }

      if (requirement === 'owner' && level !== 'owner') {
        throw new ApiError(
          403,
          ErrorCodes.FORBIDDEN,
          'Only the board owner can do that'
        );
      }

      if (requirement === 'write' && !canWrite(level)) {
        throw new ApiError(
          403,
          ErrorCodes.FORBIDDEN,
          level === 'viewer'
            ? 'You have view-only access to this board'
            : 'You do not have edit access to this board'
        );
      }

      req.board = board;
      req.boardAccess = level;
      next();
    } catch (error) {
      next(error);
    }
  };
}
