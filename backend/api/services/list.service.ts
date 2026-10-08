import {Types} from 'mongoose';
import {listRepository} from '../repositories/list.repository';
import {boardRepository} from '../repositories/board.repository';
import {BoardDocument} from '../models/Board.model';
import {ListDocument} from '../models/List.model';
import {bumpBoardRevision} from './boardRevision';
import {assertOrderFitsList} from './card.service';
import {activityService} from './activity.service';
import {realtimeService} from './realtime.service';
import {withProductTransaction, ProductSession} from '../utils/transaction';
import {Actor} from '../utils/actor';
import {ApiError} from '../utils/error';
import {ErrorCodes} from '../constants/errorCodes';

type ListInput = {
  name?: string;
  assignee?: string | null;
  collapsed?: boolean;
  cardOrder?: string[];
  backgroundColor?: string | null;
  position?: number;
  archivedAt?: string | null;
  expectedRevision?: number;
};

type CreateListInput = {
  name: string;
  assignee?: string | null;
  backgroundColor?: string | null;
  position?: number;
  expectedRevision?: number;
};

function serializeList(list: ListDocument) {
  return {
    id: list._id.toString(),
    boardId: list.boardId.toString(),
    name: list.name,
    assignee: list.assignee ? list.assignee.toString() : null,
    collapsed: list.collapsed,
    backgroundColor: list.backgroundColor,
    position: list.position,
    cardOrder: (list.cardOrder ?? []).map(id => id.toString()),
    archivedAt: list.archivedAt,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt
  };
}

/** Throws unless the list really belongs to this board. */
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

export const listService = {
  serialize: serializeList,

  async list(board: BoardDocument) {
    const lists = await listRepository.listByBoard(board._id);
    return lists.map(serializeList);
  },

  async create(actor: Actor, board: BoardDocument, input: CreateListInput) {
    // The whole change — revision claim, the list, the board's order, and its
    // audit entry — commits or rolls back as one unit.
    const result = await withProductTransaction(async session => {
      // Claim the board's revision before writing anything, so a losing writer
      // leaves no trace. Bumping first is safe: an over-advanced revision only
      // costs the next client a refresh, whereas the reverse order would leave a
      // list created against a revision nobody holds.
      const revision = await bumpBoardRevision(board._id, input.expectedRevision, session);

      const list = await listRepository.create(
        {
          boardId: board._id,
          name: input.name,
          assignee: input.assignee ? new Types.ObjectId(input.assignee) : null,
          backgroundColor: input.backgroundColor ?? null,
          position: input.position ?? board.listOrder.length
        },
        session
      );

      // `listOrder` on the board is the authoritative order, so a new list has to
      // be appended there or it would exist without a place in the sequence.
      await boardRepository.update(
        board._id.toString(),
        {listOrder: [...board.listOrder, list._id]},
        false,
        session
      );

      const activity = await activityService.log(session, {
        boardId: board._id,
        actor,
        actionType: 'list.created',
        targetType: 'list',
        targetId: list._id.toString(),
        metadata: {name: list.name}
      });

      return {list, revision, activity};
    });

    const body = {list: serializeList(result.list), revision: result.revision};
    await realtimeService.broadcast({
      boardId: board._id.toString(),
      revision: result.revision,
      type: 'list.created',
      payload: body,
      activity: result.activity
    });

    return body;
  },

  async update(
    actor: Actor,
    board: BoardDocument,
    listId: string,
    input: ListInput
  ) {
    const result = await withProductTransaction(async session => {
      const before = await requireListForBoard(listId, board._id, session);
      const revision = await bumpBoardRevision(board._id, input.expectedRevision, session);

      const patch: Record<string, unknown> = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.collapsed !== undefined) patch.collapsed = input.collapsed;
      if (input.position !== undefined) patch.position = input.position;
      if (input.backgroundColor !== undefined) patch.backgroundColor = input.backgroundColor;
      if (input.archivedAt !== undefined) {
        patch.archivedAt = input.archivedAt ? new Date(input.archivedAt) : null;
      }
      if (input.assignee !== undefined) {
        patch.assignee = input.assignee ? new Types.ObjectId(input.assignee) : null;
      }
      if (input.cardOrder !== undefined) {
        // Reordering is a list-level concern, but the ids in it have to be checked
        // against this list. An order is untrusted input like any other: without
        // this, a PATCH could seed `cardOrder` with any ObjectId at all, including
        // a card id belonging to a different board.
        await assertOrderFitsList(board._id, listId, input.cardOrder);
        patch.cardOrder = input.cardOrder.map(id => new Types.ObjectId(id));
      }

      await listRepository.update(listId, board._id, patch, session);
      const updated = await requireListForBoard(listId, board._id, session);

      const archived =
        input.archivedAt !== undefined &&
        Boolean(input.archivedAt) !== Boolean(before.archivedAt);

      const activity = await activityService.log(session, {
        boardId: board._id,
        actor,
        actionType: archived ? 'list.archived' : 'list.updated',
        targetType: 'list',
        targetId: listId,
        metadata: {
          fields: Object.keys(patch),
          name: updated.name,
          ...(input.name !== undefined && input.name !== before.name
            ? {before: {name: before.name}}
            : {})
        }
      });

      return {updated, revision, activity};
    });

    const body = {
      list: serializeList(result.updated),
      revision: result.revision
    };
    await realtimeService.broadcast({
      boardId: board._id.toString(),
      revision: result.revision,
      type: result.activity.actionType,
      payload: body,
      activity: result.activity
    });

    return body;
  },

  /** Replaces the board's list order wholesale, after proving every id is ours. */
  async reorder(
    actor: Actor,
    board: BoardDocument,
    listOrder: string[],
    expectedRevision?: number
  ) {
    const ids = listOrder.map(id => new Types.ObjectId(id));
    const found = await listRepository.listByBoard(board._id, true);
    const owned = new Set(found.map(list => list._id.toString()));

    const foreign = listOrder.filter(id => !owned.has(id));
    if (foreign.length > 0) {
      // Accepting an unknown id would write a board whose order points at a list
      // that does not exist, or worse at one belonging to someone else.
      throw new ApiError(
        404,
        ErrorCodes.LIST_NOT_FOUND,
        'One or more lists in that order do not belong to this board'
      );
    }

    const result = await withProductTransaction(async session => {
      const revision = await bumpBoardRevision(board._id, expectedRevision, session);
      await boardRepository.update(
        board._id.toString(),
        {listOrder: ids},
        false,
        session
      );

      const activity = await activityService.log(session, {
        boardId: board._id,
        actor,
        actionType: 'list.updated',
        targetType: 'board',
        targetId: board._id.toString(),
        metadata: {fields: ['listOrder']}
      });

      return {revision, activity};
    });

    const body = {listOrder: ids.map(id => id.toString()), revision: result.revision};
    await realtimeService.broadcast({
      boardId: board._id.toString(),
      revision: result.revision,
      type: 'board.updated',
      payload: body,
      activity: result.activity
    });

    return body;
  },

  async remove(
    actor: Actor,
    board: BoardDocument,
    listId: string,
    expectedRevision?: number
  ) {
    const result = await withProductTransaction(async session => {
      const doomed = await requireListForBoard(listId, board._id, session);
      const revision = await bumpBoardRevision(board._id, expectedRevision, session);

      // Drop the list from the board's order, or the board keeps pointing at a
      // list that no longer exists.
      const remaining = board.listOrder.filter(id => id.toString() !== listId);
      await boardRepository.update(
        board._id.toString(),
        {listOrder: remaining},
        false,
        session
      );

      await listRepository.delete(listId, board._id, session);

      const activity = await activityService.log(session, {
        boardId: board._id,
        actor,
        actionType: 'list.deleted',
        targetType: 'list',
        targetId: listId,
        metadata: {name: doomed.name}
      });

      return {revision, activity};
    });

    const body = {message: 'List deleted', revision: result.revision};
    await realtimeService.broadcast({
      boardId: board._id.toString(),
      revision: result.revision,
      type: 'list.deleted',
      payload: {listId, revision: result.revision},
      activity: result.activity
    });

    return body;
  }
};
