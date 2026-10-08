import {Types} from 'mongoose';
import {ListDocument, ListModel} from '../models/List.model';
import {ProductSession} from '../utils/transaction';

type CreateListInput = Pick<ListDocument, 'boardId' | 'name'> &
  Partial<
    Pick<ListDocument, 'assignee' | 'collapsed' | 'backgroundColor' | 'position' | 'archivedAt'>
  >;

/**
 * Every write (and the reads that answer them inside a transaction) carries an
 * optional session so the change and its audit entry commit together. Reads
 * that only validate before writing may omit it — they never need to observe
 * uncommitted state.
 */
export const listRepository = {
  create: (data: CreateListInput, session?: ProductSession) =>
    ListModel.create([data], {session}).then(([created]) => created),

  /**
   * Always scoped by board. A list id on its own is not proof of membership:
   * without the board in the filter, an id belonging to another board would be
   * accepted by whichever board the request happened to name.
   */
  findByIdForBoard: (id: string, boardId: Types.ObjectId, session?: ProductSession) =>
    session
      ? ListModel.findOne({_id: id, boardId}).session(session).exec()
      : ListModel.findOne({_id: id, boardId}).exec(),

  listByBoard: (boardId: Types.ObjectId, includeArchived = false) =>
    ListModel.find({
      boardId,
      ...(includeArchived ? {} : {archivedAt: null})
    })
      .sort({position: 1, createdAt: 1})
      .exec(),

  update: (
    id: string,
    boardId: Types.ObjectId,
    data: Partial<ListDocument>,
    session?: ProductSession
  ) => ListModel.updateOne({_id: id, boardId}, data, {session}).exec(),

  delete: (id: string, boardId: Types.ObjectId, session?: ProductSession) =>
    ListModel.deleteOne({_id: id, boardId}, {session}).exec()
};
