import {Types} from 'mongoose';
import {boardRepository} from '../repositories/board.repository';
import {boardCollaboratorRepository} from '../repositories/boardCollaborator.repository';
import {userRepository} from '../repositories/user.repository';
import {
  getBoardAccessLevel,
  isPubliclyAddressable,
  resolveAccessLevel
} from './boardAccess.service';
import {assertBoardRevision} from './boardRevision';
import {listRepository} from '../repositories/list.repository';
import {cardRepository} from '../repositories/card.repository';
import {listService} from './list.service';
import {cardService} from './card.service';
import {activityService} from './activity.service';
import {withProductTransaction} from '../utils/transaction';
import {ApiError} from '../utils/error';
import {ErrorCodes} from '../constants/errorCodes';
import {createPublicSlug} from '../utils/slug';
import {Actor} from '../utils/actor';
import {BoardDocument} from '../models/Board.model';
import {BoardAccessLevel, BoardVisibility} from '../constants/product';
import {logger} from '../logging/logger';

/**
 * The plain shape produced by `toObject()`. Deliberately not `BoardDocument`,
 * which carries the whole mongoose.Document surface that a serialized row does
 * not have.
 */
type BoardShape = {
  _id: Types.ObjectId;
  name: string;
  description: string;
  visibility: BoardVisibility;
  publicSlug: string | null;
  background: string;
  backgroundMediaId: Types.ObjectId | null;
  labels: {id: string; name: string; color: string}[];
  template: string;
  settings: {commentPermission: string; selfJoin: boolean};
  listOrder: Types.ObjectId[];
  revision: number;
  ownerId: Types.ObjectId;
  workspaceId: Types.ObjectId | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type BoardRow = BoardShape & {access: BoardAccessLevel};

function toRow(board: BoardDocument, access: BoardAccessLevel): BoardRow {
  return {...(board.toObject() as unknown as BoardShape), access};
}

type CreateBoardInput = {
  name: string;
  description?: string;
  visibility?: BoardVisibility;
  background?: string;
  settings?: {commentPermission?: string; selfJoin?: boolean};
  labels?: {id: string; name: string; color: string}[];
  template?: string;
};

type UpdateBoardInput = {
  name?: string;
  description?: string;
  background?: string;
  listOrder?: string[];
  archivedAt?: string | null;
  expectedRevision?: number;
};

function serializeBoard(board: BoardRow) {
  const isPublic = board.visibility === 'public';
  return {
    id: board._id.toString(),
    name: board.name,
    description: board.description,
    visibility: board.visibility,
    // A dormant slug is withheld, so an un-published board never leaks the
    // handle that used to work.
    publicSlug: isPublic ? board.publicSlug : null,
    background: board.background,
    backgroundMediaId: board.backgroundMediaId
      ? board.backgroundMediaId.toString()
      : null,
    labels: board.labels,
    template: board.template,
    settings: board.settings,
    listOrder: (board.listOrder ?? []).map(id => id.toString()),
    revision: board.revision,
    ownerId: board.ownerId.toString(),
    workspaceId: board.workspaceId ? board.workspaceId.toString() : null,
    access: board.access,
    archivedAt: board.archivedAt,
    createdAt: board.createdAt,
    updatedAt: board.updatedAt
  };
}

/** Rejects a stale write rather than silently clobbering a concurrent change. */
function assertRevision(board: BoardDocument, expectedRevision?: number) {
  assertBoardRevision(board, expectedRevision);
}

async function primaryWorkspaceId(actor: Actor): Promise<Types.ObjectId | null> {
  const user = await userRepository.findById(actor.actorId.toString());
  return user?.workspaceId ?? null;
}

/** Collides rarely at 12 characters, but the unique index means we must retry. */
async function allocatePublicSlug(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = createPublicSlug();
    const existing = await boardRepository.findByPublicSlug(candidate);
    if (!existing) return candidate;
  }
  throw new ApiError(
    500,
    ErrorCodes.INTERNAL_ERROR,
    'Could not allocate a public link. Try again.'
  );
}

function presentRows(
  rows: BoardRow[],
  filter: {visibility?: BoardVisibility; search?: string}
) {
  const search = filter.search?.toLowerCase();
  return rows
    .filter(row => !filter.visibility || row.visibility === filter.visibility)
    .filter(row => !search || row.name.toLowerCase().includes(search))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .map(serializeBoard);
}

export const boardService = {
  async create(actor: Actor, input: CreateBoardInput) {
    const visibility = input.visibility ?? 'private';
    const workspaceId = await primaryWorkspaceId(actor);

    // A board not attached to a workspace can never be shared with one, so
    // refuse rather than silently creating something unreachable.
    if (visibility === 'workspace' && !workspaceId) {
      throw new ApiError(
        400,
        ErrorCodes.VALIDATION_ERROR,
        'Create or join a workspace before sharing a board with one'
      );
    }

    const board = await boardRepository.create({
      name: input.name,
      description: input.description ?? '',
      ownerId: actor.actorId,
      workspaceId,
      visibility,
      publicSlug: visibility === 'public' ? await allocatePublicSlug() : null,
      background: input.background ?? 'default',
      template: input.template ?? 'blank',
      labels: input.labels ?? [],
      settings: {
        commentPermission: (input.settings?.commentPermission ??
          'members') as 'everyone' | 'members' | 'editors',
        selfJoin: input.settings?.selfJoin ?? false
      }
    });

    logger.info(
      {boardId: board._id.toString(), ownerId: actor.actorId.toString()},
      'Board created'
    );

    return serializeBoard(toRow(board, 'owner'));
  },

  /**
   * `scope=accessible` is the explicit slice: boards you own or were invited to.
   * `scope=discoverable` is the passive slice: workspace and public boards. They
   * are kept apart because the sidebar and the dashboard stats want different
   * ones.
   */
  async list(
    actor: Actor,
    scope: 'accessible' | 'discoverable',
    filter: {visibility?: BoardVisibility; search?: string}
  ) {
    if (scope === 'accessible') {
      const [owned, collaborations] = await Promise.all([
        boardRepository.listOwnedBy(actor.actorId),
        boardCollaboratorRepository.listAcceptedForUser(actor.actorId)
      ]);

      const roleByBoard = new Map<string, 'editor' | 'viewer'>();
      for (const row of collaborations) {
        roleByBoard.set(
          row.boardId.toString(),
          row.role as 'editor' | 'viewer'
        );
      }

      const shared = await boardRepository.listByIds(
        collaborations.map(row => row.boardId)
      );

      const rows: BoardRow[] = [
        ...owned.map(board => toRow(board, 'owner')),
        ...shared.flatMap(board => {
          const role = roleByBoard.get(board._id.toString());
          return role
            ? [
                toRow(
                  board,
                  resolveAccessLevel(actor, board, {
                    collaboration: {role, status: 'accepted'}
                  })
                )
              ]
            : [];
        })
      ];

      return presentRows(rows, filter);
    }

    const workspaceId = await primaryWorkspaceId(actor);
    const [workspaceBoards, publicBoards] = await Promise.all([
      workspaceId
        ? boardRepository.listWorkspaceVisible(workspaceId, actor.actorId)
        : Promise.resolve([]),
      boardRepository.listPublic()
    ]);

    const rows: BoardRow[] = [
      ...workspaceBoards.map(board => toRow(board, 'workspace-view')),
      ...publicBoards
        .filter(board => !board.ownerId.equals(actor.actorId))
        .map(board => toRow(board, 'public-view'))
    ];

    return presentRows(rows, filter);
  },

  async get(board: BoardDocument, level: BoardAccessLevel) {
    return serializeBoard(toRow(board, level));
  },

  /**
   * The board's children in one response.
   *
   * Separate from `get` on purpose: a rename should not drag every card with it,
   * and the client can refresh the shell and the children independently. The
   * board's `listOrder` is authoritative for lists, so the lists come back in
   * that order rather than by their own `position`.
   */
  async structure(board: BoardDocument) {
    const [lists, cards] = await Promise.all([
      listRepository.listByBoard(board._id),
      cardRepository.listByBoard(board._id)
    ]);

    const byPosition = new Map(lists.map(list => [list._id.toString(), list]));
    const ordered = (board.listOrder ?? [])
      .map(id => byPosition.get(id.toString()))
      .filter((list): list is NonNullable<typeof list> => Boolean(list));

    // Anything the order array does not mention still belongs to the board;
    // dropping it would hide real work.
    const orphans = lists.filter(list => !board.listOrder.some(id => id.equals(list._id)));

    return {
      lists: [...ordered, ...orphans].map(listService.serialize),
      cards: cards.map(cardService.serialize)
    };
  },

  async update(
    actor: Actor,
    board: BoardDocument,
    input: UpdateBoardInput,
    level: BoardAccessLevel
  ) {
    assertRevision(board, input.expectedRevision);

    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.description !== undefined) patch.description = input.description;
    if (input.background !== undefined) patch.background = input.background;
    if (input.archivedAt !== undefined) {
      patch.archivedAt = input.archivedAt ? new Date(input.archivedAt) : null;
    }
    if (input.listOrder !== undefined) {
      patch.listOrder = input.listOrder.map(id => new Types.ObjectId(id));
    }

    if (Object.keys(patch).length === 0) {
      const current = await boardRepository.findById(board._id.toString());
      return serializeBoard(toRow(current!, level));
    }

    const result = await withProductTransaction(async session => {
      await boardRepository.update(board._id.toString(), patch, true, session);
      const updated = await boardRepository.findById(board._id.toString(), session);

      const activity = await activityService.log(session, {
        boardId: board._id,
        actor,
        actionType: 'board.updated',
        targetType: 'board',
        targetId: board._id.toString(),
        metadata: {
          fields: Object.keys(patch),
          name: updated!.name,
          ...(input.name !== undefined && input.name !== board.name
            ? {before: {name: board.name}}
            : {})
        },
        revision: result.updated.revision
      });

      return {updated: updated!, activity};
    });

    const serialized = serializeBoard(toRow(result.updated, level));
    return serialized;
  },

  /**
   * Owner-only, enforced by the route. A slug is minted the first time a board
   * goes public and then kept, so re-publishing restores the links people already
   * have instead of orphaning them. The read path ignores the slug unless
   * visibility is still 'public', which is what revokes them.
   */
  async setVisibility(
    actor: Actor,
    board: BoardDocument,
    visibility: BoardVisibility,
    expectedRevision?: number
  ) {
    assertRevision(board, expectedRevision);

    if (visibility === 'workspace' && !board.workspaceId) {
      throw new ApiError(
        400,
        ErrorCodes.VALIDATION_ERROR,
        'This board is not in a workspace, so it cannot be shared with one'
      );
    }

    const patch: Record<string, unknown> = {visibility};
    if (visibility === 'public' && !board.publicSlug) {
      patch.publicSlug = await allocatePublicSlug();
    }

    const result = await withProductTransaction(async session => {
      // One update, so the revision only moves once.
      await boardRepository.update(board._id.toString(), patch, true, session);
      const updated = await boardRepository.findById(board._id.toString(), session);

      const activity = await activityService.log(session, {
        boardId: board._id,
        actor,
        actionType: 'board.visibility_changed',
        targetType: 'board',
        targetId: board._id.toString(),
        metadata: {from: board.visibility, to: visibility},
        revision: result.updated.revision
      });

      return {updated: updated!, activity};
    });

    const serialized = serializeBoard(toRow(result.updated, 'owner'));
    return serialized;
  },

  async remove(actor: Actor, board: BoardDocument) {
    const result = await withProductTransaction(async session => {
      await boardCollaboratorRepository.deleteForBoard(board._id, session);
      await boardRepository.delete(board._id.toString(), session);

      const activity = await activityService.log(session, {
        boardId: board._id,
        actor,
        actionType: 'board.deleted',
        targetType: 'board',
        targetId: board._id.toString(),
        metadata: {name: board.name},
        revision: board.revision
      });

      return {activity};
    });

    logger.info({boardId: board._id.toString()}, 'Board deleted');
    return {message: 'Board deleted'};
  },

  /**
   * Public-by-slug read. Still requires a signed-in user account, per the product
   * default. Reports the viewer's real level when they happen to own or
   * collaborate on the board, so the UI can enable editing.
   */
  async getPublicBySlug(actor: Actor, slug: string) {
    const board = await boardRepository.findByPublicSlug(slug);
    if (!board || !isPubliclyAddressable(board)) {
      throw new ApiError(404, ErrorCodes.BOARD_NOT_FOUND, 'Board not found');
    }

    const level = await getBoardAccessLevel(actor, board);
    return serializeBoard(toRow(board, level));
  }
};
