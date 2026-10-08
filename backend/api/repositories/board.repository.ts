import {FilterQuery, Types} from 'mongoose';
import {BoardDocument, BoardModel} from '../models/Board.model';
import {BoardVisibility} from '../constants/product';
import {ProductSession} from '../utils/transaction';

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

  findById: (id: string, session?: ProductSession) =>
    session
      ? BoardModel.findById(id).session(session).exec()
      : BoardModel.findById(id).exec(),

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

  update: (
    id: string,
    data: Partial<BoardDocument>,
    bumpRevision = true,
    session?: ProductSession
  ) => {
    const update: Record<string, unknown> = {...data};
    if (bumpRevision) update.$inc = {revision: 1};
    return BoardModel.updateOne({_id: id}, update, {session}).exec();
  },

  setPublicSlug: (id: string, publicSlug: string | null) =>
    BoardModel.updateOne({_id: id}, {publicSlug, $inc: {revision: 1}}).exec(),

  /**
   * Conditional revision bump, for writes to a board's children (lists, cards).
   * Takes a filter rather than an id so the revision that was already checked
   * can be folded into the write, which is what makes the bump a compare-and-set
   * instead of a blind increment.
   *
   * `findOneAndUpdate` rather than `updateOne` so the new revision comes back in
   * the same round trip: every child write advances the counter, and a client
   * that cannot read the new value would have its next write rejected as a
   * conflict with itself. `new: true` returns the post-increment document; null
   * means the compare-and-set lost, i.e. somebody else wrote first.
   */
  bumpRevision: (filter: Record<string, unknown>, session?: ProductSession) =>
    BoardModel.findOneAndUpdate(filter, {$inc: {revision: 1}}, {new: true, session}).exec(),

  findWithRevision: (id: string, expectedRevision?: number) => {
    const filter: FilterQuery<BoardDocument> = {_id: id};
    if (expectedRevision !== undefined) filter.revision = expectedRevision;
    return BoardModel.findOne(filter).exec();
  },

  delete: (id: string, session?: ProductSession) =>
    BoardModel.deleteOne({_id: id}, {session}).exec()
};
