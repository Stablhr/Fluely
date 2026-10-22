import mongoose, {Schema, Types} from 'mongoose';

/**
 * A structured mention of a board member inside a card comment (or, later, a
 * card description). Stored separately from the comment text so a mention can
 * be queried, counted, and cleaned up independently of the prose it sits in.
 */
export interface MentionDocument extends mongoose.Document {
  boardId: Types.ObjectId;
  cardId: Types.ObjectId;
  /** Null when the mention lives in a card description rather than a comment. */
  commentId: string | null;
  mentionedUserId: Types.ObjectId;
  mentionedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const MentionSchema = new Schema<MentionDocument>(
  {
    boardId: {type: Schema.Types.ObjectId, ref: 'Board', required: true, index: true},
    cardId: {type: Schema.Types.ObjectId, ref: 'Card', required: true, index: true},
    commentId: {type: String, default: null},
    mentionedUserId: {type: Schema.Types.ObjectId, ref: 'User', required: true, index: true},
    mentionedBy: {type: Schema.Types.ObjectId, ref: 'User', required: true}
  },
  {timestamps: true}
);

// One row per (comment, mentioned user) so a duplicate mention in the same
// comment never creates two notifications.
MentionSchema.index({cardId: 1, commentId: 1, mentionedUserId: 1}, {unique: true});

export const MentionModel = mongoose.model<MentionDocument>('Mention', MentionSchema, 'mentions');
