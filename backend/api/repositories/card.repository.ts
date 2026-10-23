import {Types} from 'mongoose';
import {CardDocument, CardModel} from '../models/Card.model';
import {ProductSession} from '../utils/transaction';

type CreateCardInput = Pick<CardDocument, 'boardId' | 'listId' | 'title'> &
  Partial<
    Pick<
      CardDocument,
      | 'position'
      | 'desc'
      | 'coverMediaId'
      | 'coverSize'
      | 'labelIds'
      | 'memberIds'
      | 'dueDate'
      | 'startDate'
      | 'location'
      | 'watching'
      | 'mediaIds'
      | 'comments'
      | 'archived'
      | 'done'
    >
  >;

/** Optional session on every write: see the note in `list.repository`. */
export const cardRepository = {
  create: (data: CreateCardInput, session?: ProductSession) =>
    CardModel.create([data], {session}).then(([created]) => created),

  /** Board-scoped, for the same reason as lists: see `listRepository`. */
  findByIdForBoard: (id: string, boardId: Types.ObjectId, session?: ProductSession) =>
    session
      ? CardModel.findOne({_id: id, boardId}).session(session).exec()
      : CardModel.findOne({_id: id, boardId}).exec(),

  findByListForBoard: (listId: Types.ObjectId, boardId: Types.ObjectId) =>
    CardModel.find({listId, boardId, archived: false}).sort({createdAt: 1}).exec(),

  /** Every card on a board; positions are only a hint, the structure endpoint
   *  re-sorts each list's slice by fractional position. */
  listByBoard: (boardId: Types.ObjectId, includeArchived = false) =>
    CardModel.find({
      boardId,
      ...(includeArchived ? {} : {archived: false})
    })
      .sort({position: 1, createdAt: 1})
      .exec(),

  /** Every card in a list, in fractional-position order. */
  listOrderedForList: (
    listId: Types.ObjectId,
    boardId: Types.ObjectId,
    session?: ProductSession
  ) =>
    session
      ? CardModel.find({listId, boardId, archived: false})
          .session(session)
          .sort({position: 1, createdAt: 1, _id: 1})
          .exec()
      : CardModel.find({listId, boardId, archived: false})
          .sort({position: 1, createdAt: 1, _id: 1})
          .exec(),

  update: (
    id: string,
    boardId: Types.ObjectId,
    data: Partial<CardDocument>,
    session?: ProductSession
  ) => CardModel.updateOne({_id: id, boardId}, data, {session}).exec(),

  /**
   * Relocating a card. `listId` and the card's own `boardId` move together, so a
   * card can never end up filed under a list on a different board. The new
   * fractional `position` is written in the same update, so a move is a single
   * row write -- no sibling card is touched.
   */
  move: (
    id: string,
    boardId: Types.ObjectId,
    listId: Types.ObjectId,
    position: number,
    session?: ProductSession
  ) =>
    CardModel.updateOne({_id: id, boardId}, {$set: {listId, position}}, {session}).exec(),

  /** Bulk-write positions for a whole list, used by the explicit reorder and
   *  the lazy backfill/rebalance routines. */
  setPositions: (
    updates: {id: string; position: number}[],
    boardId: Types.ObjectId,
    session?: ProductSession
  ) =>
    updates.length === 0
      ? Promise.resolve()
      : CardModel.bulkWrite(
          updates.map(({id, position}) => ({
            updateOne: {
              filter: {_id: new Types.ObjectId(id), boardId},
              update: {$set: {position}}
            }
          })),
          {session}
        ).then(() => undefined),

  delete: (id: string, boardId: Types.ObjectId, session?: ProductSession) =>
    CardModel.deleteOne({_id: id, boardId}, {session}).exec(),

  deleteByList: (listId: Types.ObjectId, boardId: Types.ObjectId) =>
    CardModel.deleteMany({listId, boardId}).exec(),

  deleteForBoard: (boardId: Types.ObjectId, session?: ProductSession) =>
    CardModel.deleteMany({boardId}, {session}).exec(),

  /** Done cards that have been done longer than the retention window. */
  listDoneOlderThan: (cutoff: Date, limit = 200) =>
    CardModel.find({done: true, doneAt: {$ne: null, $lt: cutoff}})
      .sort({doneAt: 1})
      .limit(limit)
      .exec()
};
