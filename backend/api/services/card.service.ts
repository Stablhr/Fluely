import {Types} from 'mongoose';
import {cardRepository} from '../repositories/card.repository';
import {listRepository} from '../repositories/list.repository';
import {mediaRepository} from '../repositories/media.repository';
import {BoardDocument} from '../models/Board.model';
import {CardCoverSize, CardDocument} from '../models/Card.model';
import {bumpBoardRevision} from './boardRevision';
import {activityService} from './activity.service';
import {
  POSITION_GAP,
  positionBetween,
  needsRespace,
  spacedPositions
} from '../utils/position';
import {boardMemberService} from './boardMember.service';
import {withProductTransaction, ProductSession} from '../utils/transaction';
import {ActivityActionType} from '../constants/product';
import {Actor} from '../utils/actor';
import {ApiError} from '../utils/error';
import {ErrorCodes} from '../constants/errorCodes';

type CardInput = {
  title?: string;
  desc?: string;
  comments?: {
    id: string;
    authorId?: string | null;
    text: string;
    reactions?: Record<string, number>;
    createdAt?: string;
  }[];
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
  beforeId?: string;
  afterId?: string;
  index?: number;
  cardOrder?: string[];
  expectedRevision?: number;
};

/** Returns the list's cards in display order, backfilling positions if needed. */
async function orderedCardsForList(
  boardId: Types.ObjectId,
  listId: Types.ObjectId,
  session: ProductSession,
  listDoc?: {cardOrder?: Types.ObjectId[]}
): Promise<CardDocument[]> {
  const list = listDoc ?? (await listRepository.findByIdForBoard(listId.toString(), boardId, session));
  const cards = (await cardRepository.listOrderedForList(listId, boardId, session)) ?? [];
  if (cards.every(card => typeof card.position === 'number')) {
    return cards;
  }

  // Legacy cards without a position: space them out from the stored order
  // (or, failing that, creation order) so the next read is positioned.
  const ids = list
    ? (list.cardOrder ?? []).map(id => id.toString()).filter(id => cards.some(card => card._id.toString() === id))
    : [];
  for (const card of cards) {
    if (!ids.includes(card._id.toString())) ids.push(card._id.toString());
  }
  await cardRepository.setPositions(
    ids.map((id, index) => ({id, position: index * POSITION_GAP})),
    boardId,
    session
  );
  return cardRepository.listOrderedForList(listId, boardId, session);
}

/** Re-space a list's cards evenly. Used as a fallback when a gap is exhausted. */
async function respaceList(
  boardId: Types.ObjectId,
  listId: Types.ObjectId,
  session: ProductSession,
  listDoc?: {cardOrder?: Types.ObjectId[]}
) {
  const list = listDoc ?? (await listRepository.findByIdForBoard(listId.toString(), boardId, session));
  const cards = (await cardRepository.listOrderedForList(listId, boardId, session)) ?? [];
  const ids = list
    ? (list.cardOrder ?? []).map(id => id.toString()).filter(id => cards.some(card => card._id.toString() === id))
    : [];
  for (const card of cards) {
    if (!ids.includes(card._id.toString())) ids.push(card._id.toString());
  }
  await cardRepository.setPositions(
    ids.map((id, index) => ({id, position: index * POSITION_GAP})),
    boardId,
    session
  );
}

type SetCardMemberInput = {
  userId: string;
  action: 'add' | 'remove';
  expectedRevision?: number;
};

function isBoardOwner(actor: Actor, board: BoardDocument): boolean {
  return board.ownerId.equals(actor.actorId);
}

async function serializeCard(card: CardDocument) {
  const ids = [
    ...(card.coverMediaId ? [card.coverMediaId.toString()] : []),
    ...card.mediaIds.map(id => id.toString())
  ];
  const mediaDocs = await mediaRepository.findByIds(ids);
  const coverMedia = card.coverMediaId
    ? mediaDocs.find(doc => doc._id.equals(card.coverMediaId))
    : undefined;
  const cardMedia = card.mediaIds
    .map(id => mediaDocs.find(doc => doc._id.equals(id)))
    .filter((doc): doc is NonNullable<typeof doc> => Boolean(doc));

  const imageUrl = coverMedia?.url ?? null;

  return {
    id: card._id.toString(),
    boardId: card.boardId.toString(),
    listId: card.listId.toString(),
    position: card.position,
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
    comments: (card.comments ?? []).map(c => ({
      id: c.id,
      authorId: c.authorId ? c.authorId.toString() : null,
      text: c.text,
      reactions: c.reactions ?? {},
      createdAt: c.createdAt
    })) as any,
    archived: card.archived,
    done: card.done,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
    // Consistent image field across REST and realtime payloads.
    imageUrl,
    image: imageUrl ? {url: imageUrl} : null,
    coverImageUrl: imageUrl,
    media: cardMedia.map(doc => ({
      id: doc._id.toString(),
      url: doc.url,
      name: doc.originalName,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes,
      kind: doc.kind,
      createdAt: doc.createdAt
    }))
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
    return Promise.all(cards.map(serializeCard));
  },

  async create(actor: Actor, board: BoardDocument, input: CreateCardInput) {
    // Assignees are owner-managed, including on the initial create. Otherwise
    // an editor could bypass the dedicated assignment route by creating a card
    // that already names people.
    if ((input.memberIds?.length ?? 0) > 0 && !isBoardOwner(actor, board)) {
      throw new ApiError(
        403,
        ErrorCodes.FORBIDDEN,
        'Only the board owner can assign members'
      );
    }

    const result = await withProductTransaction(async session => {
      // A card may only be filed under a list on its own board, so the target list
      // is proven before anything is written.
      const targetList = await requireListForBoard(input.listId, board._id, session);
      const revision = await bumpBoardRevision(board._id, input.expectedRevision, session);

      const siblings = await orderedCardsForList(board._id, new Types.ObjectId(input.listId), session, targetList);
      const position =
        siblings.length === 0
          ? 0
          : siblings[siblings.length - 1].position == null
            ? siblings.length * POSITION_GAP
            : siblings[siblings.length - 1].position! + POSITION_GAP;

      const card = await cardRepository.create(
        {
          boardId: board._id,
          listId: new Types.ObjectId(input.listId),
          position,
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
          mediaIds: (input.mediaIds ?? []).map(id => new Types.ObjectId(id)),
          comments: (input.comments ?? []).map(c => ({
            id: c.id,
            authorId: c.authorId ? new Types.ObjectId(c.authorId) : null,
            text: c.text,
            reactions: c.reactions ?? {},
            createdAt: c.createdAt ? new Date(c.createdAt) : new Date()
          }))
        },
        session
      );

      // Keep the legacy array in sync for boards that have never been written
      // since the position field landed, so a read that falls back to it still
      // sees the new card.
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
        metadata: {title: card.title, listId: input.listId},
        revision
      });

      return {card, revision, activity};
    });

    const body = {card: await serializeCard(result.card), revision: result.revision};
    return body;
  },

  async update(actor: Actor, board: BoardDocument, cardId: string, input: CardInput) {
    // The general card PATCH accepts memberIds for local imports and older
    // clients, but assignment itself is an owner-only action. Editors keep
    // their write access for everything else on the card.
    if (input.memberIds !== undefined && !isBoardOwner(actor, board)) {
      throw new ApiError(
        403,
        ErrorCodes.FORBIDDEN,
        'Only the board owner can assign members'
      );
    }

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
      if (input.comments !== undefined) {
        patch.comments = input.comments.map(c => ({
          id: c.id,
          authorId: c.authorId ? new Types.ObjectId(c.authorId) : null,
          text: c.text,
          reactions: c.reactions ?? {},
          createdAt: c.createdAt ? new Date(c.createdAt) : new Date()
        }));
      }

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
        metadata,
        revision
      });

      return {updated, revision, activity};
    });

    const body = {card: await serializeCard(result.updated), revision: result.revision};
    return body;
  },

  /**
   * Assigns or unassigns one board member. The route already requires the
   * owner; the check here keeps the rule with the data write too. The target
   * must be the owner or an accepted collaborator, never a pending invite or
   * an arbitrary account id.
   */
  async setMember(
    actor: Actor,
    board: BoardDocument,
    cardId: string,
    input: SetCardMemberInput
  ) {
    if (!isBoardOwner(actor, board)) {
      throw new ApiError(
        403,
        ErrorCodes.FORBIDDEN,
        'Only the board owner can assign members'
      );
    }

    // Removing stays allowed for a stale assignee (someone who has since left
    // the board), so the owner can clean up a card. Adding must name a current
    // owner or accepted collaborator.
    if (
      input.action === 'add' &&
      !(await boardMemberService.isMember(board, input.userId))
    ) {
      throw new ApiError(
        400,
        ErrorCodes.VALIDATION_ERROR,
        'That person is not a member of this board'
      );
    }

    const memberId = new Types.ObjectId(input.userId);
    const result = await withProductTransaction(async session => {
      const before = await requireCardForBoard(cardId, board._id, session);
      const revision = await bumpBoardRevision(
        board._id,
        input.expectedRevision,
        session
      );

      const currentIds = before.memberIds.map(id => id.toString());
      const memberIds =
        input.action === 'add'
          ? [...new Set([...currentIds, input.userId])].map(
              id => new Types.ObjectId(id)
            )
          : currentIds
              .filter(id => id !== input.userId)
              .map(id => new Types.ObjectId(id));

      await cardRepository.update(
        cardId,
        board._id,
        {memberIds},
        session
      );
      const updated = await requireCardForBoard(cardId, board._id, session);

      const activity = await activityService.log(session, {
        boardId: board._id,
        actor,
        actionType: 'card.assigned',
        targetType: 'card',
        targetId: cardId,
        metadata: {
          fields: ['memberIds'],
          title: updated.title,
          userId: memberId.toString(),
          action: input.action,
          memberIds: updated.memberIds.map(id => id.toString())
        },
        revision
      });

      return {updated, revision, activity};
    });

    return {
      card: await serializeCard(result.updated),
      revision: result.revision
    };
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

      // The move is now a single-row write: `listId` + `position`. No sibling
      // card is touched, so concurrent moves to different cards can never
      // clobber each other the way the old full-`cardOrder`-array write did.
      const siblings = (await orderedCardsForList(board._id, targetList._id, session, targetList))
        .filter(cardDoc => cardDoc._id.toString() !== cardId);

      // Prefer the fractional-indexing anchors when the client sent them: the
      // new position is computed from the neighbours' *current* positions, so
      // a concurrent move of another card between the same two neighbours never
      // reorders or reverts this one.
      let beforePos: number | null | undefined;
      let afterPos: number | null | undefined;
      let useAnchors = false;
      if (input.beforeId || input.afterId) {
        const beforeCard = input.beforeId
          ? siblings.find(cardDoc => cardDoc._id.toString() === input.beforeId)
          : undefined;
        const afterCard = input.afterId
          ? siblings.find(cardDoc => cardDoc._id.toString() === input.afterId)
          : undefined;
        if (input.beforeId && !beforeCard) useAnchors = false;
        else if (input.afterId && !afterCard) useAnchors = false;
        else {
          useAnchors = true;
          beforePos = beforeCard?.position;
          afterPos = afterCard?.position;
        }
      }

      let index: number;
      let position: number;
      if (useAnchors) {
        position = positionBetween(beforePos, afterPos);
        // Keep `index` meaningful for the legacy array sync below.
        if (input.beforeId && input.afterId) {
          const beforeIndex = siblings.findIndex(cardDoc => cardDoc._id.toString() === input.beforeId);
          index = beforeIndex === -1 ? siblings.length : beforeIndex + 1;
        } else if (input.beforeId) {
          const beforeIndex = siblings.findIndex(cardDoc => cardDoc._id.toString() === input.beforeId);
          index = beforeIndex === -1 ? siblings.length : beforeIndex + 1;
        } else if (input.afterId) {
          const afterIndex = siblings.findIndex(cardDoc => cardDoc._id.toString() === input.afterId);
          index = afterIndex === -1 ? siblings.length : afterIndex;
        } else {
          index = siblings.length;
        }
      } else {
        if (typeof input.index === 'number') {
          index = Math.min(Math.max(input.index, 0), siblings.length);
        } else if (input.cardOrder) {
          const found = input.cardOrder.indexOf(cardId);
          index = found === -1 ? siblings.length : Math.min(Math.max(found, 0), siblings.length);
        } else {
          index = siblings.length;
        }
        beforePos = index > 0 ? siblings[index - 1]?.position : undefined;
        afterPos = index < siblings.length ? siblings[index]?.position : undefined;
        position = positionBetween(beforePos, afterPos);
      }

      if (needsRespace(beforePos, afterPos)) {
        await respaceList(board._id, targetList._id, session, targetList);
        const refreshed = (await orderedCardsForList(board._id, targetList._id, session, targetList))
          .filter(cardDoc => cardDoc._id.toString() !== cardId);
        const refreshedBefore = useAnchors
          ? refreshed.find(cardDoc => cardDoc._id.toString() === input.beforeId)?.position
          : index > 0 ? refreshed[index - 1]?.position : undefined;
        const refreshedAfter = useAnchors
          ? refreshed.find(cardDoc => cardDoc._id.toString() === input.afterId)?.position
          : index < refreshed.length ? refreshed[index]?.position : undefined;
        position = positionBetween(refreshedBefore, refreshedAfter);
      }

      await cardRepository.move(cardId, board._id, targetList._id, position, session);

      // Keep the legacy array in sync for boards that have never been written
      // since the position field landed, so a read that falls back to it still
      // sees the moved card in its new place.
      if (card.listId.toString() !== targetList._id.toString()) {
        const sourceOrder = (
          await listOrderOf(card.listId.toString(), board._id, session)
        ).filter(id => id.toString() !== cardId);
        await listRepository.update(card.listId.toString(), board._id, {cardOrder: sourceOrder}, session);
      }
      const targetOrder = (await listOrderOf(targetList._id.toString(), board._id, session)).filter(
        id => id.toString() !== cardId
      );
      targetOrder.splice(index, 0, new Types.ObjectId(cardId));
      await listRepository.update(targetList._id.toString(), board._id, {cardOrder: targetOrder}, session);

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
        },
        revision
      });

      return {
        moved,
        listId: targetList._id.toString(),
        revision,
        activity
      };
    });

    const body = {
      card: await serializeCard(result.moved),
      listId: result.listId,
      revision: result.revision
    };
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
      await cardRepository.setPositions(
        cardOrder.map((id, index) => ({id, position: index * POSITION_GAP})),
        board._id,
        session
      );
      const updated = await requireListForBoard(listId, board._id, session);

      const activity = await activityService.log(session, {
        boardId: board._id,
        actor,
        actionType: 'list.updated',
        targetType: 'list',
        targetId: listId,
        metadata: {fields: ['cardOrder'], name: updated.name},
        revision
      });

      return {updated, revision, activity};
    });

    const body = {
      cardOrder,
      list: serializeListSummary(result.updated),
      revision: result.revision
    };
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
        metadata: {title: doomed.title, listId: doomed.listId.toString()},
        revision
      });

      return {revision, activity};
    });

    const body = {message: 'Card deleted', revision: result.revision};
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
