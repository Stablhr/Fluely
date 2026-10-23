import {Types} from 'mongoose';
import {cardRepository} from '../repositories/card.repository';
import {listRepository} from '../repositories/list.repository';
import {mediaRepository} from '../repositories/media.repository';
import {mentionRepository} from '../repositories/mention.repository';
import {notificationRepository} from '../repositories/notification.repository';
import {boardRepository} from '../repositories/board.repository';
import {bumpBoardRevision} from './boardRevision';
import {activityService} from './activity.service';
import {deleteFromCloudinary} from './cloudinary.service';
import {env} from '../config/env';
import {withProductTransaction} from '../utils/transaction';
import {ApiError} from '../utils/error';
import {ErrorCodes} from '../constants/errorCodes';

export interface CleanupResult {
  deleted: number;
  boards: string[];
}

/**
 * Deletes cards that have been marked done for longer than the retention
 * window, so storage stays bounded. Cascade: media (Cloudinary + DB),
 * mentions, mention notifications, list cardOrder, and the card itself.
 * Board revisions are bumped so clients sync the deletion.
 */
export async function cleanupDoneCards(retentionDays?: number): Promise<CleanupResult> {
  const days = retentionDays ?? env.DONE_CARD_RETENTION_DAYS;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const cards = await cardRepository.listDoneOlderThan(cutoff, 200);
  if (cards.length === 0) return {deleted: 0, boards: []};

  const affectedBoards = new Set<string>();

  for (const card of cards) {
    const boardId = card.boardId;
    const board = await boardRepository.findById(boardId.toString());
    if (!board) continue;

    await withProductTransaction(async session => {
      // Media: destroy on Cloudinary and drop the rows.
      const mediaDocs = await mediaRepository.listByCard(card._id);
      await Promise.all(
        mediaDocs.map(async doc => {
          if (doc.publicId) {
            await deleteFromCloudinary(
              doc.publicId,
              (doc.resourceType as 'image' | 'video' | 'raw') ?? 'image'
            ).catch(() => undefined);
          }
        })
      );
      await mediaRepository.deleteByCard(card._id);

      // Mentions + mention notifications.
      await mentionRepository.deleteByCard(card._id);
      await notificationRepository.deleteMentionsForCard(card._id);

      // Remove from list cardOrder.
      const list = await listRepository.findByIdForBoard(card.listId.toString(), boardId, session);
      if (list) {
        const order = (list.cardOrder ?? []).filter(id => !id.equals(card._id));
        await listRepository.update(list._id.toString(), boardId, {cardOrder: order}, session);
      }

      await cardRepository.delete(card._id.toString(), boardId, session);

      affectedBoards.add(boardId.toString());
      await bumpBoardRevision(boardId, undefined, session);
    });
  }

  return {deleted: cards.length, boards: Array.from(affectedBoards)};
}