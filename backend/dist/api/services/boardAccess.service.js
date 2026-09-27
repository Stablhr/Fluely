"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAccessLevel = resolveAccessLevel;
exports.canRead = canRead;
exports.canWrite = canWrite;
exports.isOwnerLevel = isOwnerLevel;
exports.getBoardAccessLevel = getBoardAccessLevel;
exports.isPubliclyAddressable = isPubliclyAddressable;
const boardCollaborator_repository_1 = require("../repositories/boardCollaborator.repository");
const workspace_repository_1 = require("../repositories/workspace.repository");
const product_1 = require("../constants/product");
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
function resolveAccessLevel(actor, board, context = {}) {
    const { collaboration, sharesWorkspace } = context;
    if (board.ownerId.equals(actor.actorId))
        return 'owner';
    if (collaboration?.status === 'accepted') {
        return collaboration.role === 'editor' ? 'editor' : 'viewer';
    }
    // Both conditions are required. A board that is still marked 'workspace' but
    // has lost its workspaceId (removed workspace, backfill gap) must not become
    // visible to anyone who happens to share some other workspace.
    if (board.visibility === 'workspace' && board.workspaceId && sharesWorkspace) {
        return 'workspace-view';
    }
    if (board.visibility === 'public' && board.publicSlug)
        return 'public-view';
    return 'none';
}
function canRead(level) {
    return level !== 'none';
}
function canWrite(level) {
    return product_1.WRITE_ACCESS_LEVELS.includes(level);
}
/** Only the owner may change visibility, manage collaborators, or delete. */
function isOwnerLevel(level) {
    return level === 'owner';
}
/**
 * Full resolve for one board: loads the actor's collaboration row and their
 * workspace membership, then defers to the pure resolver above.
 */
async function getBoardAccessLevel(actor, board) {
    const collaboration = await boardCollaborator_repository_1.boardCollaboratorRepository.find(board._id, actor.actorId);
    let sharesWorkspace = false;
    if (board.workspaceId) {
        const membership = await workspace_repository_1.workspaceRepository.findMembership(board.workspaceId, actor.actorId);
        sharesWorkspace = Boolean(membership);
    }
    return resolveAccessLevel(actor, board, { collaboration, sharesWorkspace });
}
/**
 * The public-by-slug path. A slug is only honoured while the board is actually
 * public, which is what makes un-publishing revoke links that already exist.
 */
function isPubliclyAddressable(board) {
    return board.visibility === 'public' && Boolean(board.publicSlug);
}
