import {Types} from 'mongoose';
import {CardDocument, CardModel} from '../models/Card.model';
import {ProductSession} from '../utils/transaction';

type CreateCardInput = Pick<CardDocument, 'boardId' | 'listId' | 'title'> &
  Partial<
    Pick<
      CardDocument,
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

  listByBoard: (boardId: Types.ObjectId, includeArchived = false) =>
    CardModel.find({
      boardId,
      ...(includeArchived ? {} : {archived: false})
    })
      .sort({createdAt: 1})
      .exec(),

  update: (
    id: string,
    boardId: Types.ObjectId,
    data: Partial<CardDocument>,
    session?: ProductSession
  ) => CardModel.updateOne({_id: id, boardId}, data, {session}).exec(),

  /**
   * Relocating a card. `listId` and the card's own `boardId` move together, so a
   * card can never end up filed under a list on a different board.
   */
  move: (
    id: string,
    boardId: Types.ObjectId,
    listId: Types.ObjectId,
    session?: ProductSession
  ) => CardModel.updateOne({_id: id, boardId}, {$set: {listId}}, {session}).exec(),

  delete: (id: string, boardId: Types.ObjectId, session?: ProductSession) =>
    CardModel.deleteOne({_id: id, boardId}, {session}).exec(),

  deleteByList: (listId: Types.ObjectId, boardId: Types.ObjectId) =>
    CardModel.deleteMany({listId, boardId}).exec()
};
