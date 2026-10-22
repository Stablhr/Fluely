import mongoose, {Schema, Types} from 'mongoose';

export const CardCoverSizes = ['small', 'medium', 'large', 'full'] as const;
export type CardCoverSize = (typeof CardCoverSizes)[number];

/**
 * A card within a list.
 *
 * Deliberately narrower than the client's `Card`. Three of the client's fields
 * are absent by design:
 *
 * - `comments` are their own collection, so a card can be read without pulling
 *   every reply, and a comment permission check has something to hang off.
 * - `files` hold base64 `dataUrl`s. Those must never be stored in the database;
 *   `mediaIds` points at the upload pipeline instead.
 * - `activity` is an append-only log that belongs with the audit trail, not
 *   inline on the card.
 *
 * `boardId` is denormalised onto the card even though the list already knows its
 * board. Permission checks and "everything in this board" queries are the hot
 * path, and both would otherwise need a join through the list.
 */
export interface CardDocument extends mongoose.Document {
  boardId: Types.ObjectId;
  listId: Types.ObjectId;
  /**
   * Fractional order within the list. A card sits between its neighbours by
   * value, so moving it is a one-row write that never touches a sibling --
   * concurrent moves therefore cannot clobber each other. `null` on cards that
   * predate the field; those lists fall back to `List.cardOrder` until the
   * first write re-spaces them.
   */
  position: number | null;
  title: string;
  desc: string;
  coverMediaId: Types.ObjectId | null;
  coverSize: CardCoverSize;
  labelIds: string[];
  memberIds: Types.ObjectId[];
  dueDate: Date | null;
  startDate: Date | null;
  location: string | null;
  watching: boolean;
  mediaIds: Types.ObjectId[];
  comments: {id: string; authorId: Types.ObjectId | null; parentId: string | null; text: string; reactions: Record<string, number>; createdAt: Date}[];
  archived: boolean;
  done: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CardSchema = new Schema<CardDocument>(
  {
    boardId: {type: Schema.Types.ObjectId, ref: 'Board', required: true, index: true},
    listId: {type: Schema.Types.ObjectId, ref: 'List', required: true, index: true},
    position: {type: Number, default: null},
    title: {type: String, required: true, trim: true, maxlength: 300},
    desc: {type: String, default: '', maxlength: 20000},
    coverMediaId: {type: Schema.Types.ObjectId, ref: 'MediaAttachment', default: null},
    coverSize: {type: String, enum: CardCoverSizes, default: 'medium'},
    labelIds: {type: [String], default: []},
    memberIds: {type: [Schema.Types.ObjectId], default: []},
    dueDate: {type: Date, default: null},
    startDate: {type: Date, default: null},
    location: {type: String, default: null, maxlength: 500},
    watching: {type: Boolean, default: false},
    mediaIds: {type: [Schema.Types.ObjectId], default: []},
    comments: {
      type: [
        {
          id: {type: String, required: true},
          authorId: {type: Schema.Types.ObjectId, default: null},
          parentId: {type: String, default: null},
          text: {type: String, default: ''},
          reactions: {type: Schema.Types.Mixed, default: {}},
          createdAt: {type: Date, default: Date.now}
        }
      ],
      default: []
    },
    archived: {type: Boolean, default: false},
    done: {type: Boolean, default: false}
  },
  {timestamps: true}
);

// Serves both "cards in this list" and "cards in this board".
CardSchema.index({listId: 1, createdAt: 1});
// The board structure reads every card of a board, then orders each list's
// slice by this field.
CardSchema.index({boardId: 1, position: 1});
// Drives the calendar and schedule views, which scan by due date.
CardSchema.index({boardId: 1, dueDate: 1});

export const CardModel = mongoose.model<CardDocument>('Card', CardSchema, 'cards');
