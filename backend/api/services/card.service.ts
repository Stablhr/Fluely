import {Types} from 'mongoose';
import {cardRepository} from '../repositories/card.repository';
import {listRepository} from '../repositories/list.repository';
import {BoardDocument} from '../models/Board.model';
import {CardCoverSize, CardDocument} from '../models/Card.model';
import {bumpBoardRevision} from './boardRevision';
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

async function requireCardForBoard(cardId: string, boardId: Types.ObjectId) {
  const card = await cardRepository.findByIdForBoard(cardId, boardId);
  if (!card) {
    throw new ApiError(404, ErrorCodes.CARD_NOT_FOUND, 'Card not found');
  }
  return card;
}

async function requireListForBoard(listId: string, boardId: Types.ObjectId) {
  const list = await listRepository.findByIdForBoard(listId, boardId);
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

export const cardService = {
  serialize: serializeCard,

  async list(board: BoardDocument) {
    const cards = await cardRepository.listByBoard(board._id);
    return cards.map(serializeCard);
  },

  async create(board: BoardDocument, input: CreateCardInput) {
    // A card may only be filed under a list on its own board, so the target list
    // is proven before anything is written.
    await requireListForBoard(input.listId, board._id);
    const revision = await bumpBoardRevision(board._id, input.expectedRevision);

    const card = await cardRepository.create({
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
    });

    // Appending to the list's order is what makes the card visible; the list
    // document is the only thing that knows where its cards sit.
    await listRepository.update(input.listId, board._id, {
      cardOrder: [...(await listOrderOf(input.listId, board._id)), card._id]
    });

    return {card: serializeCard(card), revision};
  },

  async update(board: BoardDocument, cardId: string, input: CardInput) {
    await requireCardForBoard(cardId, board._id);
    const revision = await bumpBoardRevision(board._id, input.expectedRevision);

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

    await cardRepository.update(cardId, board._id, patch);
    const updated = await requireCardForBoard(cardId, board._id);
    return {card: serializeCard(updated), revision};
  },

  /**
   * Moves a card, possibly to another list. Both lists' order arrays are
   * rewritten, because leaving the old one holding the card would show it twice
   * and dropping the new one would hide it.
   */
  async move(board: BoardDocument, cardId: string, input: MoveCardInput) {
    const card = await requireCardForBoard(cardId, board._id);
    const targetList = await requireListForBoard(input.listId, board._id);

    if (input.cardOrder) {
      await assertOrderFitsList(
        board._id,
        targetList._id.toString(),
        input.cardOrder,
        [cardId],
      );
    }

    const revision = await bumpBoardRevision(board._id, input.expectedRevision);

    const sameList = card.listId.toString() === targetList._id.toString();
    if (!sameList) {
      const sourceOrder = (await listOrderOf(card.listId.toString(), board._id)).filter(
        id => id.toString() !== cardId
      );
      await listRepository.update(card.listId.toString(), board._id, {
        cardOrder: sourceOrder
      });
    }

    const targetOrder = input.cardOrder
      ? input.cardOrder.map(id => new Types.ObjectId(id))
      : sameList
        ? targetList.cardOrder
        : [...targetList.cardOrder, card._id];

    await listRepository.update(targetList._id.toString(), board._id, {
      cardOrder: targetOrder
    });
    await cardRepository.move(cardId, board._id, targetList._id);

    const moved = await requireCardForBoard(cardId, board._id);
    return {
      card: serializeCard(moved),
      listId: targetList._id.toString(),
      revision
    };
  },

  /** Sets a list's card order, after checking every id is a card of this board. */
  async reorder(
    board: BoardDocument,
    listId: string,
    cardOrder: string[],
    expectedRevision?: number
  ) {
    await requireListForBoard(listId, board._id);
    await assertOrderFitsList(board._id, listId, cardOrder);

    const revision = await bumpBoardRevision(board._id, expectedRevision);
    await listRepository.update(listId, board._id, {
      cardOrder: cardOrder.map(id => new Types.ObjectId(id))
    });
    return {cardOrder, revision};
  },

  async remove(board: BoardDocument, cardId: string, expectedRevision?: number) {
    const card = await requireCardForBoard(cardId, board._id);
    const revision = await bumpBoardRevision(board._id, expectedRevision);

    const order = (await listOrderOf(card.listId.toString(), board._id)).filter(
      id => id.toString() !== cardId
    );
    await listRepository.update(card.listId.toString(), board._id, {cardOrder: order});
    await cardRepository.delete(cardId, board._id);

    return {message: 'Card deleted', revision};
  }
};

/** Reads a list's current card order. */
async function listOrderOf(listId: string, boardId: Types.ObjectId): Promise<Types.ObjectId[]> {
  const list = await listRepository.findByIdForBoard(listId, boardId);
  return list ? [...list.cardOrder] : [];
}
