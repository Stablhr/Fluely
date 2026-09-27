import {FilterQuery, Types} from 'mongoose';
import {BoardDocument, BoardModel} from '../models/Board.model';
import {BoardVisibility} from '../constants/product';

type CreateBoardInput = Pick<
  BoardDocument,
  'name' | 'description' | 'ownerId' | 'visibility' | 'background' | 'template' | 'labels'
> & {
  workspaceId?: Types.ObjectId | null;
  publicSlug?: string | null;
  settings?: Partial<BoardDocument['settings']>;
};

export const boardRepository = {
  create: (data: CreateBoardInput) => BoardModel.create(data),

  findById: (id: string) => BoardModel.findById(id).exec(),

  findByPublicSlug: (slug: string) => BoardModel.findOne({publicSlug: slug}).exec(),

  /**
   * Board ids the actor owns, or has an accepted collaboration on. Used to build
   * the explicit ("accessible") slice of the board list.
   */
  listOwnedBy: (ownerId: Types.ObjectId) =>
    BoardModel.find({ownerId}).sort({updatedAt: -1}).exec(),

  /** Boards in a workspace that are visible to every member of it. */
  listWorkspaceVisible: (workspaceId: Types.ObjectId, excludeOwnerId?: Types.ObjectId) =>
    BoardModel.find({
      workspaceId,
      visibility: 'workspace',
      ...(excludeOwnerId ? {ownerId: {$ne: excludeOwnerId}} : {})
    })
      .sort({updatedAt: -1})
      .exec(),

  listPublic: () => BoardModel.find({visibility: 'public'}).sort({updatedAt: -1}).exec(),

  listByIds: (ids: Types.ObjectId[]) => BoardModel.find({_id: {$in: ids}}).exec(),

  listByOwnerAndVisibility: (ownerId: Types.ObjectId, visibility: BoardVisibility) =>
    BoardModel.find({ownerId, visibility}).sort({updatedAt: -1}).exec(),

  update: (id: string, data: Partial<BoardDocument>, bumpRevision = true) => {
    const update: Record<string, unknown> = {...data};
    if (bumpRevision) update.$inc = {revision: 1};
    return BoardModel.updateOne({_id: id}, update).exec();
  },

  setPublicSlug: (id: string, publicSlug: string | null) =>
    BoardModel.updateOne({_id: id}, {publicSlug, $inc: {revision: 1}}).exec(),

  findWithRevision: (id: string, expectedRevision?: number) => {
    const filter: FilterQuery<BoardDocument> = {_id: id};
    if (expectedRevision !== undefined) filter.revision = expectedRevision;
    return BoardModel.findOne(filter).exec();
  },

  delete: (id: string) => BoardModel.deleteOne({_id: id}).exec()
};
