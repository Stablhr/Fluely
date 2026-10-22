import {Types} from 'mongoose';
import {MentionDocument, MentionModel} from '../models/Mention.model';

export const mentionRepository = {
  create: (data: {
    boardId: Types.ObjectId;
    cardId: Types.ObjectId;
    commentId: string | null;
    mentionedUserId: Types.ObjectId;
    mentionedBy: Types.ObjectId;
  }) => MentionModel.create(data),

  /** Upsert-style: avoid duplicate mention rows for the same (comment, user). */
  upsert: async (data: {
    boardId: Types.ObjectId;
    cardId: Types.ObjectId;
    commentId: string | null;
    mentionedUserId: Types.ObjectId;
    mentionedBy: Types.ObjectId;
  }) => {
    await MentionModel.updateOne(
      {cardId: data.cardId, commentId: data.commentId, mentionedUserId: data.mentionedUserId},
      {$setOnInsert: data},
      {upsert: true}
    ).exec();
  },

  deleteByComment: (cardId: Types.ObjectId, commentId: string) =>
    MentionModel.deleteMany({cardId, commentId}).exec(),

  /** Mentioned users of a given comment (for diffing on edit). */
  listForComment: (cardId: Types.ObjectId, commentId: string) =>
    MentionModel.find({cardId, commentId}).exec()
};
