import mongoose, {Schema, Types} from 'mongoose';

/**
 * A column on a board.
 *
 * `board.listOrder` is the authoritative order of a board's lists and
 * `cardOrder` is the authoritative order of a list's cards. Both are id arrays
 * because that is what the drag-and-drop code already mutates, and mirroring it
 * means a reorder is a single array write on the parent rather than a rewrite
 * of every sibling. `position` is only a tie-breaker for placement at creation
 * time, before the parent array has been set.
 */
export interface ListDocument extends mongoose.Document {
  boardId: Types.ObjectId;
  name: string;
  assignee: Types.ObjectId | null;
  collapsed: boolean;
  backgroundColor: string | null;
  position: number;
  cardOrder: Types.ObjectId[];
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ListSchema = new Schema<ListDocument>(
  {
    boardId: {type: Schema.Types.ObjectId, ref: 'Board', required: true, index: true},
    name: {type: String, required: true, trim: true, maxlength: 120},
    assignee: {type: Schema.Types.ObjectId, ref: 'User', default: null},
    collapsed: {type: Boolean, default: false},
    backgroundColor: {type: String, default: null, maxlength: 30},
    position: {type: Number, default: 0},
    cardOrder: {type: [Schema.Types.ObjectId], default: []},
    archivedAt: {type: Date, default: null}
  },
  {timestamps: true}
);

// Every read of a list's children is scoped by board, so the pair is indexed.
ListSchema.index({boardId: 1, position: 1});
// A board may not contain two lists with the same name while both are live.
ListSchema.index({boardId: 1, name: 1});

export const ListModel = mongoose.model<ListDocument>('List', ListSchema, 'lists');
