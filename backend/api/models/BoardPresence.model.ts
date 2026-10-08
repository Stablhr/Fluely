import mongoose, {Schema, Types} from 'mongoose';

export interface BoardPresenceDocument extends mongoose.Document {
  boardId: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BoardPresenceSchema = new Schema<BoardPresenceDocument>(
  {
    boardId: {
      type: Schema.Types.ObjectId,
      ref: 'Board',
      required: true,
      index: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    name: {type: String, required: true},
    lastSeenAt: {type: Date, required: true, index: true}
  },
  {timestamps: true}
);

BoardPresenceSchema.index({boardId: 1, userId: 1}, {unique: true});
BoardPresenceSchema.index({boardId: 1, lastSeenAt: -1});
BoardPresenceSchema.index(
  {lastSeenAt: 1},
  {expireAfterSeconds: 60}
);

export const BoardPresenceModel = mongoose.model<BoardPresenceDocument>(
  'BoardPresence',
  BoardPresenceSchema,
  'boardpresence'
);