import {Types} from 'mongoose';
import {BoardDocument} from '../models/Board.model';
import {boardCollaboratorRepository} from '../repositories/boardCollaborator.repository';
import {workspaceRepository} from '../repositories/workspace.repository';
import {Actor} from '../utils/actor';
import {BoardAccessLevel, WRITE_ACCESS_LEVELS} from '../constants/product';

/** The fields this resolver needs. Narrow on purpose so it stays unit-testable. */
export type AccessTarget = Pick<
  BoardDocument,
  '_id' | 'ownerId' | 'visibility' | 'workspaceId' | 'publicSlug'
>;

export type CollaborationRecord = {
  role: 'editor' | 'viewer';
  status: 'pending' | 'accepted' | 'declined';
};

/**
 * The single source of truth for "what may this person do with this board".
 * Pure, so the permission matrix can be tested without a database.
 *
 * Ordering matters. Ownership and explicit collaboration are checked before
 * visibility, so a private board someone was invited to reports 'editor' rather
 * than being masked by the visibility branch.
 *
 * Visibility never yields a write level: only 'owner' and 'editor' can mutate,
 * and 'editor' is reachable only through an accepted collaboration record.
 */
export function resolveAccessLevel(
  actor: Actor,
  board: AccessTarget,
  context: {collaboration?: CollaborationRecord | null; sharesWorkspace?: boolean} = {}
): BoardAccessLevel {
  const {collaboration, sharesWorkspace} = context;

  if (board.ownerId.equals(actor.actorId)) return 'owner';

  if (collaboration?.status === 'accepted') {
    return collaboration.role === 'editor' ? 'editor' : 'viewer';
  }

  // Both conditions are required. A board that is still marked 'workspace' but
  // has lost its workspaceId (removed workspace, backfill gap) must not become
  // visible to anyone who happens to share some other workspace.
  if (board.visibility === 'workspace' && board.workspaceId && sharesWorkspace) {
    return 'workspace-view';
  }

  if (board.visibility === 'public' && board.publicSlug) return 'public-view';

  return 'none';
}

export function canRead(level: BoardAccessLevel): boolean {
  return level !== 'none';
}

export function canWrite(level: BoardAccessLevel): boolean {
  return WRITE_ACCESS_LEVELS.includes(level);
}

/** Only the owner may change visibility, manage collaborators, or delete. */
export function isOwnerLevel(level: BoardAccessLevel): boolean {
  return level === 'owner';
}

/**
 * Full resolve for one board: loads the actor's collaboration row and their
 * workspace membership, then defers to the pure resolver above.
 */
export async function getBoardAccessLevel(
  actor: Actor,
  board: AccessTarget
): Promise<BoardAccessLevel> {
  const collaboration = await boardCollaboratorRepository.find(board._id, actor.actorId);

  let sharesWorkspace = false;
  if (board.workspaceId) {
    const membership = await workspaceRepository.findMembership(
      board.workspaceId as Types.ObjectId,
      actor.actorId
    );
    sharesWorkspace = Boolean(membership);
  }

  return resolveAccessLevel(actor, board, {collaboration, sharesWorkspace});
}

/**
 * The public-by-slug path. A slug is only honoured while the board is actually
 * public, which is what makes un-publishing revoke links that already exist.
 */
export function isPubliclyAddressable(
  board: Pick<AccessTarget, 'visibility' | 'publicSlug'>
): boolean {
  return board.visibility === 'public' && Boolean(board.publicSlug);
}
