import {NextFunction, Request, Response} from 'express';
import {actorFromRequest} from '../utils/actor';
import {boardRepository} from '../repositories/board.repository';
import {userRepository} from '../repositories/user.repository';
import {canRead, getBoardAccessLevel} from '../services/boardAccess.service';
import {parseChannel, realtimeService} from '../services/realtime.service';
import {ApiError} from '../utils/error';
import {ErrorCodes} from '../constants/errorCodes';

/**
 * Channel subscription is gated by exactly the same access check as a REST
 * read: someone who could not fetch the board over HTTP cannot join its
 * channel. Unreadable boards are reported as 404 so this never confirms that a
 * private board exists — the same shape `requireBoardAccess` uses.
 *
 * Runs on pusher-js's first subscribe for a channel (once per socket), so the
 * read cost is one board fetch per channel join, not per event.
 */
export const realtimeController = {
  async authorize(req: Request, res: Response, next: NextFunction) {
    try {
      const {socket_id, channel_name} = req.body as {
        socket_id: string;
        channel_name: string;
      };

      const parsed = parseChannel(channel_name);
      if (!parsed) {
        throw new ApiError(403, ErrorCodes.FORBIDDEN, 'That channel cannot be authorised');
      }

      if (!realtimeService.enabled) {
        throw new ApiError(
          503,
          ErrorCodes.REALTIME_UNAVAILABLE,
          'Realtime sync is not available'
        );
      }

      const board = await boardRepository.findById(parsed.boardId);
      if (!board) {
        throw new ApiError(404, ErrorCodes.BOARD_NOT_FOUND, 'Board not found');
      }

      const actor = actorFromRequest(req);
      const level = await getBoardAccessLevel(actor, board);
      if (!canRead(level)) {
        throw new ApiError(404, ErrorCodes.BOARD_NOT_FOUND, 'Board not found');
      }

      let presence: {userId: string; name: string} | undefined;
      if (parsed.kind === 'presence') {
        const user = await userRepository.findById(actor.actorId.toString());
        presence = {
          userId: actor.actorId.toString(),
          name: user ? `${user.firstName} ${user.lastName}`.trim() : ''
        };
      }

      const authBody = realtimeService.authorize(socket_id, channel_name, presence);
      if (!authBody) {
        throw new ApiError(
          503,
          ErrorCodes.REALTIME_UNAVAILABLE,
          'Realtime sync is not available'
        );
      }

      res.status(200).json(authBody);
    } catch (error) {
      next(error);
    }
  }
};
