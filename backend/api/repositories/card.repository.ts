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
      .exec(),

  deleteForBoards: (boardIds: Types.ObjectId[], session?: ProductSession) =>
    CardModel.deleteMany({boardId: {$in: boardIds}}, {session}).exec(),

  // ── Comment reactions ───────────────────────────────────────────
  //
  // Each of these is one conditional update on a single comment, addressed by
  // the array filter `c`. The emoji is a field name inside `reactions`; the DTO
  // only admits non-ASCII keys, so it can never hold `.` or `$`. A write that
  // matches nothing reports `modifiedCount: 0` and the service re-reads.

  /** Replaces a missing or malformed `reactions` value with `{}`, so the
   *  emoji paths below have an object to land in. */
  resetMalformedReactions: (
    id: string,
    boardId: Types.ObjectId,
    commentId: string,
    session?: ProductSession
  ) =>
    CardModel.updateOne(
      {_id: id, boardId},
      {$set: {'comments.$[c].reactions': {}}},
      {session, arrayFilters: [{'c.id': commentId, 'c.reactions': {$not: {$type: 'object'}}}]}
    ).exec(),

  /** Rewrites a legacy bare count into `{userIds: [], legacy: n}`. Only
   *  matches while the value is still that number. */
  convertLegacyReaction: (
    id: string,
    boardId: Types.ObjectId,
    commentId: string,
    emoji: string,
    legacy: number,
    session?: ProductSession
  ) =>
    CardModel.updateOne(
      {_id: id, boardId},
      {$set: {[`comments.$[c].reactions.${emoji}`]: {userIds: [], legacy}}},
      {session, arrayFilters: [{'c.id': commentId, [`c.reactions.${emoji}`]: legacy}]}
    ).exec(),

  /**
   * Adds one person to an emoji. Matches only when they are not already there,
   * the emoji is not a legacy number, and -- if the emoji is new to the comment
   * -- the comment holds fewer than `maxEmojis` emojis. The cap is part of the
   * filter, so two people adding different emojis at once cannot both pass it.
   */
  addReaction: (
    id: string,
    boardId: Types.ObjectId,
    commentId: string,
    emoji: string,
    userId: Types.ObjectId,
    maxEmojis: number,
    session?: ProductSession
  ) =>
    CardModel.updateOne(
      {
        _id: id,
        boardId,
        comments: {
          $elemMatch: {
            id: commentId,
            [`reactions.${emoji}`]: {$not: {$type: 'number'}},
            [`reactions.${emoji}.userIds`]: {$ne: userId}
          }
        },
        $or: [
          {comments: {$elemMatch: {id: commentId, [`reactions.${emoji}`]: {$exists: true}}}},
          {
            $expr: {
              $lt: [
                {
                  $size: {
                    $objectToArray: {
                      $ifNull: [
                        {
                          $let: {
                            vars: {
                              comment: {
                                $arrayElemAt: [
                                  {
                                    $filter: {
                                      input: '$comments',
                                      // $literal: an id starting with `$`
                                      // must not read as a field path.
                                      cond: {$eq: ['$$this.id', {$literal: commentId}]}
                                    }
                                  },
                                  0
                                ]
                              }
                            },
                            in: '$$comment.reactions'
                          }
                        },
                        {}
                      ]
                    }
                  }
                },
                maxEmojis
              ]
            }
          }
        ]
      },
      {$addToSet: {[`comments.$[c].reactions.${emoji}.userIds`]: userId}},
      {session, arrayFilters: [{'c.id': commentId}]}
    ).exec(),

  /** Removes one person from an emoji; never touches its `legacy` count. */
  removeReaction: (
    id: string,
    boardId: Types.ObjectId,
    commentId: string,
    emoji: string,
    userId: Types.ObjectId,
    session?: ProductSession
  ) =>
    CardModel.updateOne(
      {
        _id: id,
        boardId,
        comments: {$elemMatch: {id: commentId, [`reactions.${emoji}.userIds`]: userId}}
      },
      {$pull: {[`comments.$[c].reactions.${emoji}.userIds`]: userId}},
      {session, arrayFilters: [{'c.id': commentId}]}
    ).exec(),

  /** Drops an emoji that has no people and no legacy count left. */
  unsetEmptyReaction: (
    id: string,
    boardId: Types.ObjectId,
    commentId: string,
    emoji: string,
    session?: ProductSession
  ) =>
    CardModel.updateOne(
      {_id: id, boardId},
      {$unset: {[`comments.$[c].reactions.${emoji}`]: ''}},
      {
        session,
        arrayFilters: [
          {
            'c.id': commentId,
            [`c.reactions.${emoji}.userIds`]: {$size: 0},
            [`c.reactions.${emoji}.legacy`]: {$in: [0, null]}
          }
        ]
      }
    ).exec(),

  /** Unassigns an account from every card it is a member of. */
  pullMember: (userId: Types.ObjectId, session?: ProductSession) =>
    CardModel.updateMany({memberIds: userId}, {$pull: {memberIds: userId}}, {session}).exec()
};
