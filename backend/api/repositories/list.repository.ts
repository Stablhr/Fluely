import {Types} from 'mongoose';
import {ListDocument, ListModel} from '../models/List.model';

type CreateListInput = Pick<ListDocument, 'boardId' | 'name'> &
  Partial<
    Pick<ListDocument, 'assignee' | 'collapsed' | 'backgroundColor' | 'position' | 'archivedAt'>
  >;

export const listRepository = {
  create: (data: CreateListInput) => ListModel.create(data),

  /**
   * Always scoped by board. A list id on its own is not proof of membership:
   * without the board in the filter, an id belonging to another board would be
   * accepted by whichever board the request happened to name.
   */
  findByIdForBoard: (id: string, boardId: Types.ObjectId) =>
    ListModel.findOne({_id: id, boardId}).exec(),

  listByBoard: (boardId: Types.ObjectId, includeArchived = false) =>
    ListModel.find({
      boardId,
      ...(includeArchived ? {} : {archivedAt: null})
    })
      .sort({position: 1, createdAt: 1})
      .exec(),

  update: (id: string, boardId: Types.ObjectId, data: Partial<ListDocument>) =>
    ListModel.updateOne({_id: id, boardId}, data).exec(),

  delete: (id: string, boardId: Types.ObjectId) =>
    ListModel.deleteOne({_id: id, boardId}).exec()
};
