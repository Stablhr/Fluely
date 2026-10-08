import {Types} from 'mongoose';
import {cardRepository} from '../repositories/card.repository';
import {listRepository} from '../repositories/list.repository';
import {BoardDocument} from '../models/Board.model';
import {CardCoverSize, CardDocument} from '../models/Card.model';
import {bumpBoardRevision} from './boardRevision';
import {activityService} from './activity.service';
import {realtimeService} from './realtime.service';
import {withProductTransaction, ProductSession} from '../utils/transaction';
import {ActivityActionType} from '../constants/product';
import {Actor} from '../utils/actor';
import {ApiError} from '../utils/error';
import {ErrorCodes} from '../constants/errorCodes';

type CardInput = {
  title?: string;
  desc?: string;
  coverMediaId?: string | null;
  coverSize?: CardCoverSize;
  labelIds?: string[];
  memberIds?: string[];
  dueDate?: string | null;
  startDate?: string | null;
  location?: string | null;
  watching?: boolean;
  mediaIds?: string[];
  archived?: boolean;
  done?: boolean;
  expectedRevision?: number;
};

type CreateCardInput = Omit<CardInput, 'title' | 'expectedRevision'> & {
  listId: string;
  title: string;
  expectedRevision?: number;
};

type MoveCardInput = {
  listId: string;
  cardOrder?: string[];
  expectedRevision?: number;
};

function serializeCard(card: CardDocument) {
  return {
    id: card._id.toString(),
    boardId: card.boardId.toString(),
    listId: card.listId.toString(),
    title: card.title,
    desc: card.desc,
    coverMediaId: card.coverMediaId ? card.coverMediaId.toString() : null,
    coverSize: card.coverSize,
    labelIds: card.labelIds,
    memberIds: card.memberIds.map(id => id.toString()),
    dueDate: card.dueDate,
    startDate: card.startDate,
    location: card.location,
    watching: card.watching,
    mediaIds: card.mediaIds.map(id => id.toString()),
    archived: card.archived,
    done: card.done,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt
  };
}

async function requireCardForBoard(
  cardId: string,
  boardId: Types.ObjectId,
  session?: ProductSession
) {
  const card = await cardRepository.findByIdForBoard(cardId, boardId, session);
  if (!card) {
    throw new ApiError(404, ErrorCodes.CARD_NOT_FOUND, 'Card not found');
  }
  return card;
}

async function requireListForBoard(
  listId: string,
  boardId: Types.ObjectId,
  session?: ProductSession
) {
  const list = await listRepository.findByIdForBoard(listId, boardId, session);
  if (!list) {
    throw new ApiError(404, ErrorCodes.LIST_NOT_FOUND, 'List not found');
  }
  return list;
}

/**
 * Rejects an order that names cards the target list does not hold.
 *
 * Checking board ownership alone is not enough. A card sitting in a different
 * list of the same board passes such a check, which leaves it in two lists'
 * `cardOrder` at once while its `listId` still names only one of them: the card
 * then renders twice, and moving it updates only one of the two. Ids from
 * another board must be caught by the same guard, since an order is exactly the
 * place where a stray id from a different board would be smuggled in.
 *
 * `alsoAllowed` names cards that legitimately appear in the order despite not
 * belonging to the list yet — the card being moved, whose `listId` is still the
 * source list at the moment the new order is validated.
 */
export async function assertOrderFitsList(
  boardId: Types.ObjectId,
  listId: string,
  order: string[],
  alsoAllowed: string[] = []
) {
  const cards = await cardRepository.listByBoard(boardId, true);
  const inList = new Set(
    cards
      .filter(card => card.listId.toString() === listId)
      .map(card => card._id.toString()),
  );
  const extra = new Set(alsoAllowed);

  if (order.some(id => !inList.has(id) && !extra.has(id))) {
    throw new ApiError(
      404,
      ErrorCodes.CARD_NOT_FOUND,
      'One or more cards in that order do not belong to this list',
    );
  }
}

/** Which of a card's changeable facets the patch touched — drives the audit type. */
function actionTypeForCardPatch(patch: Record<string, unknown>): ActivityActionType {
  if ('done' in patch) return 'card.status_changed';
  if ('archived' in patch) return 'card.archived';
  if ('memberIds' in patch) return 'card.assigned';
  return 'card.updated';
}

export const cardService = {
  serialize: serializeCard,

  async list(board: BoardDocument) {
    const cards = await cardRepository.listByBoard(board._id);
    return cards.map(serializeCard);
  },

  async create(actor: Actor, board: BoardDocument, input: CreateCardInput) {
    const result = await withProductTransaction(async session => {
      // A card may only be filed under a list on its own board, so the target list
      // is proven before anything is written.
      await requireListForBoard(input.listId, board._id, session);
      const revision = await bumpBoardRevision(board._id, input.expectedRevision, session);

      const card = await cardRepository.create(
        {
          boardId: board._id,
          listId: new Types.ObjectId(input.listId),
          title: input.title,
          desc: input.desc ?? '',
          coverMediaId: input.coverMediaId ? new Types.ObjectId(input.coverMediaId) : null,
          coverSize: input.coverSize ?? 'medium',
          labelIds: input.labelIds ?? [],
          memberIds: (input.memberIds ?? []).map(id => new Types.ObjectId(id)),
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          startDate: input.startDate ? new Date(input.startDate) : null,
          location: input.location ?? null,
          watching: input.watching ?? false,
          mediaIds: (input.mediaIds ?? []).map(id => new Types.ObjectId(id))
        },
        session
      );

      // Appending to the list's order is what makes the card visible; the list
      // document is the only thing that knows where its cards sit.
      await listRepository.update(
        input.listId,
        board._id,
        {cardOrder: [...(await listOrderOf(input.listId, board._id, session)), card._id]},
        session
      );

      const activity = await activityService.log(session, {
        boardId: board._id,
        actor,
        actionType: 'card.created',
        targetType: 'card',
        targetId: card._id.toString(),
        metadata: {title: card.title, listId: input.listId}
      });

      return {card, revision, activity};
    });

    const body = {card: serializeCard(result.card), revision: result.revision};
    await realtimeService.broadcast({
      boardId: board._id.toString(),
      revision: result.revision,
      type: 'card.created',
      payload: body,
      activity: result.activity
    });

    return body;
  },

  async update(actor: Actor, board: BoardDocument, cardId: string, input: CardInput) {
    const result = await withProductTransaction(async session => {
      const before = await requireCardForBoard(cardId, board._id, session);
      const revision = await bumpBoardRevision(board._id, input.expectedRevision, session);

      const patch: Record<string, unknown> = {};
      if (input.title !== undefined) patch.title = input.title;
      if (input.desc !== undefined) patch.desc = input.desc;
      if (input.coverSize !== undefined) patch.coverSize = input.coverSize;
      if (input.labelIds !== undefined) patch.labelIds = input.labelIds;
      if (input.watching !== undefined) patch.watching = input.watching;
      if (input.archived !== undefined) patch.archived = input.archived;
      if (input.done !== undefined) patch.done = input.done;
      if (input.coverMediaId !== undefined) {
        patch.coverMediaId = input.coverMediaId ? new Types.ObjectId(input.coverMediaId) : null;
      }
      if (input.memberIds !== undefined) {
        patch.memberIds = input.memberIds.map(id => new Types.ObjectId(id));
      }
      if (input.mediaIds !== undefined) {
        patch.mediaIds = input.mediaIds.map(id => new Types.ObjectId(id));
      }
      if (input.dueDate !== undefined) {
        patch.dueDate = input.dueDate ? new Date(input.dueDate) : null;
      }
      if (input.startDate !== undefined) {
        patch.startDate = input.startDate ? new Date(input.startDate) : null;
      }
      if (input.location !== undefined) patch.location = input.location;

      await cardRepository.update(cardId, board._id, patch, session);
      const updated = await requireCardForBoard(cardId, board._id, session);

      const actionType = actionTypeForCardPatch(patch);
      const metadata: Record<string, unknown> = {
        fields: Object.keys(patch),
        title: updated.title
      };
      if (input.title !== undefined && input.title !== before.title) {
        metadata.before = {title: before.title};
      }
      if ('done' in patch) metadata.done = updated.done;
      if ('archived' in patch) metadata.archived = updated.archived;
      if ('memberIds' in patch) {
        metadata.before = {
          ...((metadata.before as object) ?? {}),
          memberIds: before.memberIds.map(id => id.toString())
        };
        metadata.memberIds = updated.memberIds.map(id => id.toString());
      }

      const activity = await activityService.log(session, {
        boardId: board._id,
        actor,
        actionType,
        targetType: 'card',
        targetId: cardId,
        metadata
      });

      return {updated, revision, activity};
    });

    const body = {card: serializeCard(result.updated), revision: result.revision};
    await realtimeService.broadcast({
      boardId: board._id.toString(),
      revision: result.revision,
      type: result.activity.actionType,
      payload: body,
      activity: result.activity
    });

    return body;
  },

  /**
   * Moves a card, possibly to another list. Both lists' order arrays are
   * rewritten, because leaving the old one holding the card would show it twice
   * and dropping the new one would hide it.
   */
  async move(actor: Actor, board: BoardDocument, cardId: string, input: MoveCardInput) {
    const result = await withProductTransaction(async session => {
      const card = await requireCardForBoard(cardId, board._id, session);
      const targetList = await requireListForBoard(input.listId, board._id, session);

      if (input.cardOrder) {
        await assertOrderFitsList(
          board._id,
          targetList._id.toString(),
          input.cardOrder,
          [cardId],
        );
      }

      const revision = await bumpBoardRevision(board._id, input.expectedRevision, session);

      const sameList = card.listId.toString() === targetList._id.toString();
      if (!sameList) {
        const sourceOrder = (
          await listOrderOf(card.listId.toString(), board._id, session)
        ).filter(id => id.toString() !== cardId);
        await listRepository.update(card.listId.toString(), board._id, {
          cardOrder: sourceOrder
        }, session);
      }

      const targetOrder = input.cardOrder
        ? input.cardOrder.map(id => new Types.ObjectId(id))
        : sameList
          ? targetList.cardOrder
          : [...targetList.cardOrder, card._id];

      await listRepository.update(targetList._id.toString(), board._id, {
        cardOrder: targetOrder
      }, session);
      await cardRepository.move(cardId, board._id, targetList._id, session);

      const moved = await requireCardForBoard(cardId, board._id, session);

      const activity = await activityService.log(session, {
        boardId: board._id,
        actor,
        actionType: 'card.moved',
        targetType: 'card',
        targetId: cardId,
        metadata: {
          title: moved.title,
          fromListId: card.listId.toString(),
          toListId: targetList._id.toString()
        }
      });

      return {
        moved,
        listId: targetList._id.toString(),
        revision,
        activity
      };
    });

    const body = {
      card: serializeCard(result.moved),
      listId: result.listId,
      revision: result.revision
    };
    await realtimeService.broadcast({
      boardId: board._id.toString(),
      revision: result.revision,
      type: 'card.moved',
      payload: body,
      activity: result.activity
    });

    return body;
  },

  /** Sets a list's card order, after checking every id is a card of this board. */
  async reorder(
    actor: Actor,
    board: BoardDocument,
    listId: string,
    cardOrder: string[],
    expectedRevision?: number
  ) {
    const result = await withProductTransaction(async session => {
      await requireListForBoard(listId, board._id, session);
      await assertOrderFitsList(board._id, listId, cardOrder);

      const revision = await bumpBoardRevision(board._id, expectedRevision, session);
      await listRepository.update(listId, board._id, {
        cardOrder: cardOrder.map(id => new Types.ObjectId(id))
      }, session);
      const updated = await requireListForBoard(listId, board._id, session);

      const activity = await activityService.log(session, {
        boardId: board._id,
        actor,
        actionType: 'list.updated',
        targetType: 'list',
        targetId: listId,
        metadata: {fields: ['cardOrder'], name: updated.name}
      });

      return {updated, revision, activity};
    });

    const body = {
      cardOrder,
      list: serializeListSummary(result.updated),
      revision: result.revision
    };
    await realtimeService.broadcast({
      boardId: board._id.toString(),
      revision: result.revision,
      type: 'list.updated',
      payload: body,
      activity: result.activity
    });

    return {cardOrder, revision: result.revision};
  },

  async remove(
    actor: Actor,
    board: BoardDocument,
    cardId: string,
    expectedRevision?: number
  ) {
    const result = await withProductTransaction(async session => {
      const doomed = await requireCardForBoard(cardId, board._id, session);
      const revision = await bumpBoardRevision(board._id, expectedRevision, session);

      const order = (
        await listOrderOf(doomed.listId.toString(), board._id, session)
      ).filter(id => id.toString() !== cardId);
      await listRepository.update(
        doomed.listId.toString(),
        board._id,
        {cardOrder: order},
        session
      );
      await cardRepository.delete(cardId, board._id, session);

      const activity = await activityService.log(session, {
        boardId: board._id,
        actor,
        actionType: 'card.deleted',
        targetType: 'card',
        targetId: cardId,
        metadata: {title: doomed.title, listId: doomed.listId.toString()}
      });

      return {revision, activity};
    });

    const body = {message: 'Card deleted', revision: result.revision};
    await realtimeService.broadcast({
      boardId: board._id.toString(),
      revision: result.revision,
      type: 'card.deleted',
      payload: {cardId, revision: result.revision},
      activity: result.activity
    });

    return body;
  }
};

/**
 * Reads a list's current card order. Session-aware so that inside a
 * transaction the read observes the same snapshot the writes commit against.
 */
async function listOrderOf(
  listId: string,
  boardId: Types.ObjectId,
  session?: ProductSession
): Promise<Types.ObjectId[]> {
  const list = await listRepository.findByIdForBoard(listId, boardId, session);
  return list ? [...list.cardOrder] : [];
}

/** The subset of a list the realtime reorder event needs. */
function serializeListSummary(list: {
  _id: Types.ObjectId;
  name: string;
  cardOrder: Types.ObjectId[];
}) {
  return {
    id: list._id.toString(),
    name: list.name,
    cardOrder: (list.cardOrder ?? []).map(id => id.toString())
  };
}
