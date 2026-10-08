import {Types} from 'mongoose';
import {boardRepository} from '../repositories/board.repository';
import {BoardDocument} from '../models/Board.model';
import {ApiError} from '../utils/error';
import {ErrorCodes} from '../constants/errorCodes';
import {ProductSession} from '../utils/transaction';

/**
 * The board is the aggregate root: a card or a list is part of the board's
 * state, so writing one is a write to the board and shares its concurrency
 * token. Two people dragging cards in different lists of the same board would
 * otherwise each believe they had the latest state.
 *
 * Lives outside `board.service.ts` so the list and card services enforce the
 * same rule instead of each growing a private copy.
 */
export function assertBoardRevision(board: BoardDocument, expectedRevision?: number): void {
  if (expectedRevision !== undefined && board.revision !== expectedRevision) {
    throw new ApiError(
      409,
      ErrorCodes.REVISION_CONFLICT,
      'This board changed since you loaded it. Refresh and try again.'
    );
  }
}

/**
 * Records a child write against the board's revision and returns the new value.
 *
 * Conditional on the revision that was checked, so two writers that both read
 * revision 4 cannot both land: the loser's update matches no document and is
 * reported as a conflict instead of silently overwriting the winner.
 *
 * The new revision comes back so callers can pass it on to the client. Every
 * child write advances the counter, and a client that keeps sending the
 * revision it started with would have its second write rejected as a conflict
 * with itself -- so the value has to travel with the response, not be guessed
 * at on the client.
 */
export async function bumpBoardRevision(
  boardId: Types.ObjectId | string,
  expectedRevision?: number,
  session?: ProductSession
): Promise<number> {
  const filter: Record<string, unknown> = {_id: boardId};
  if (expectedRevision !== undefined) filter.revision = expectedRevision;

  const updated = await boardRepository.bumpRevision(filter, session);
  if (!updated) {
    throw new ApiError(
      409,
      ErrorCodes.REVISION_CONFLICT,
      'This board changed since you loaded it. Refresh and try again.'
    );
  }
  return updated.revision;
}
