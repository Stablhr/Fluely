import {Types} from 'mongoose';
import {CardDocument, CardModel} from '../models/Card.model';

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

export const cardRepository = {
  create: (data: CreateCardInput) => CardModel.create(data),

  /** Board-scoped, for the same reason as lists: see `listRepository`. */
  findByIdForBoard: (id: string, boardId: Types.ObjectId) =>
    CardModel.findOne({_id: id, boardId}).exec(),

  findByListForBoard: (listId: Types.ObjectId, boardId: Types.ObjectId) =>
    CardModel.find({listId, boardId, archived: false}).sort({createdAt: 1}).exec(),

  listByBoard: (boardId: Types.ObjectId, includeArchived = false) =>
    CardModel.find({
      boardId,
      ...(includeArchived ? {} : {archived: false})
    })
      .sort({createdAt: 1})
      .exec(),

  update: (id: string, boardId: Types.ObjectId, data: Partial<CardDocument>) =>
    CardModel.updateOne({_id: id, boardId}, data).exec(),

  /**
   * Relocating a card. `listId` and the card's own `boardId` move together, so a
   * card can never end up filed under a list on a different board.
   */
  move: (id: string, boardId: Types.ObjectId, listId: Types.ObjectId) =>
    CardModel.updateOne({_id: id, boardId}, {$set: {listId}}).exec(),

  delete: (id: string, boardId: Types.ObjectId) =>
    CardModel.deleteOne({_id: id, boardId}).exec(),

  deleteByList: (listId: Types.ObjectId, boardId: Types.ObjectId) =>
    CardModel.deleteMany({listId, boardId}).exec()
};
