"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.boardService = void 0;
const mongoose_1 = require("mongoose");
const board_repository_1 = require("../repositories/board.repository");
const boardCollaborator_repository_1 = require("../repositories/boardCollaborator.repository");
const user_repository_1 = require("../repositories/user.repository");
const boardAccess_service_1 = require("./boardAccess.service");
const error_1 = require("../utils/error");
const errorCodes_1 = require("../constants/errorCodes");
const slug_1 = require("../utils/slug");
const logger_1 = require("../logging/logger");
function toRow(board, access) {
    return { ...board.toObject(), access };
}
function serializeBoard(board) {
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
function assertRevision(board, expectedRevision) {
    if (expectedRevision !== undefined && board.revision !== expectedRevision) {
        throw new error_1.ApiError(409, errorCodes_1.ErrorCodes.REVISION_CONFLICT, 'This board changed since you loaded it. Refresh and try again.');
    }
}
async function primaryWorkspaceId(actor) {
    const user = await user_repository_1.userRepository.findById(actor.actorId.toString());
    return user?.workspaceId ?? null;
}
/** Collides rarely at 12 characters, but the unique index means we must retry. */
async function allocatePublicSlug() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const candidate = (0, slug_1.createPublicSlug)();
        const existing = await board_repository_1.boardRepository.findByPublicSlug(candidate);
        if (!existing)
            return candidate;
    }
    throw new error_1.ApiError(500, errorCodes_1.ErrorCodes.INTERNAL_ERROR, 'Could not allocate a public link. Try again.');
}
function presentRows(rows, filter) {
    const search = filter.search?.toLowerCase();
    return rows
        .filter(row => !filter.visibility || row.visibility === filter.visibility)
        .filter(row => !search || row.name.toLowerCase().includes(search))
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .map(serializeBoard);
}
exports.boardService = {
    async create(actor, input) {
        const visibility = input.visibility ?? 'private';
        const workspaceId = await primaryWorkspaceId(actor);
        // A board not attached to a workspace can never be shared with one, so
        // refuse rather than silently creating something unreachable.
        if (visibility === 'workspace' && !workspaceId) {
            throw new error_1.ApiError(400, errorCodes_1.ErrorCodes.VALIDATION_ERROR, 'Create or join a workspace before sharing a board with one');
        }
        const board = await board_repository_1.boardRepository.create({
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
                    'members'),
                selfJoin: input.settings?.selfJoin ?? false
            }
        });
        logger_1.logger.info({ boardId: board._id.toString(), ownerId: actor.actorId.toString() }, 'Board created');
        return serializeBoard(toRow(board, 'owner'));
    },
    /**
     * `scope=accessible` is the explicit slice: boards you own or were invited to.
     * `scope=discoverable` is the passive slice: workspace and public boards. They
     * are kept apart because the sidebar and the dashboard stats want different
     * ones.
     */
    async list(actor, scope, filter) {
        if (scope === 'accessible') {
            const [owned, collaborations] = await Promise.all([
                board_repository_1.boardRepository.listOwnedBy(actor.actorId),
                boardCollaborator_repository_1.boardCollaboratorRepository.listAcceptedForUser(actor.actorId)
            ]);
            const roleByBoard = new Map();
            for (const row of collaborations) {
                roleByBoard.set(row.boardId.toString(), row.role);
            }
            const shared = await board_repository_1.boardRepository.listByIds(collaborations.map(row => row.boardId));
            const rows = [
                ...owned.map(board => toRow(board, 'owner')),
                ...shared.flatMap(board => {
                    const role = roleByBoard.get(board._id.toString());
                    return role
                        ? [
                            toRow(board, (0, boardAccess_service_1.resolveAccessLevel)(actor, board, {
                                collaboration: { role, status: 'accepted' }
                            }))
                        ]
                        : [];
                })
            ];
            return presentRows(rows, filter);
        }
        const workspaceId = await primaryWorkspaceId(actor);
        const [workspaceBoards, publicBoards] = await Promise.all([
            workspaceId
                ? board_repository_1.boardRepository.listWorkspaceVisible(workspaceId, actor.actorId)
                : Promise.resolve([]),
            board_repository_1.boardRepository.listPublic()
        ]);
        const rows = [
            ...workspaceBoards.map(board => toRow(board, 'workspace-view')),
            ...publicBoards
                .filter(board => !board.ownerId.equals(actor.actorId))
                .map(board => toRow(board, 'public-view'))
        ];
        return presentRows(rows, filter);
    },
    async get(board, level) {
        return serializeBoard(toRow(board, level));
    },
    async update(board, input, level) {
        assertRevision(board, input.expectedRevision);
        const patch = {};
        if (input.name !== undefined)
            patch.name = input.name;
        if (input.description !== undefined)
            patch.description = input.description;
        if (input.background !== undefined)
            patch.background = input.background;
        if (input.archivedAt !== undefined) {
            patch.archivedAt = input.archivedAt ? new Date(input.archivedAt) : null;
        }
        if (input.listOrder !== undefined) {
            patch.listOrder = input.listOrder.map(id => new mongoose_1.Types.ObjectId(id));
        }
        if (Object.keys(patch).length > 0) {
            await board_repository_1.boardRepository.update(board._id.toString(), patch);
        }
        const updated = await board_repository_1.boardRepository.findById(board._id.toString());
        return serializeBoard(toRow(updated, level));
    },
    /**
     * Owner-only, enforced by the route. A slug is minted the first time a board
     * goes public and then kept, so re-publishing restores the links people already
     * have instead of orphaning them. The read path ignores the slug unless
     * visibility is still 'public', which is what revokes them.
     */
    async setVisibility(board, visibility) {
        if (visibility === 'workspace' && !board.workspaceId) {
            throw new error_1.ApiError(400, errorCodes_1.ErrorCodes.VALIDATION_ERROR, 'This board is not in a workspace, so it cannot be shared with one');
        }
        const patch = { visibility };
        if (visibility === 'public' && !board.publicSlug) {
            patch.publicSlug = await allocatePublicSlug();
        }
        // One update, so the revision only moves once.
        await board_repository_1.boardRepository.update(board._id.toString(), patch);
        const updated = await board_repository_1.boardRepository.findById(board._id.toString());
        return serializeBoard(toRow(updated, 'owner'));
    },
    async remove(board) {
        await boardCollaborator_repository_1.boardCollaboratorRepository.deleteForBoard(board._id);
        await board_repository_1.boardRepository.delete(board._id.toString());
        logger_1.logger.info({ boardId: board._id.toString() }, 'Board deleted');
        return { message: 'Board deleted' };
    },
    /**
     * Public-by-slug read. Still requires a signed-in user account, per the product
     * default. Reports the viewer's real level when they happen to own or
     * collaborate on the board, so the UI can enable editing.
     */
    async getPublicBySlug(actor, slug) {
        const board = await board_repository_1.boardRepository.findByPublicSlug(slug);
        if (!board || !(0, boardAccess_service_1.isPubliclyAddressable)(board)) {
            throw new error_1.ApiError(404, errorCodes_1.ErrorCodes.BOARD_NOT_FOUND, 'Board not found');
        }
        const level = await (0, boardAccess_service_1.getBoardAccessLevel)(actor, board);
        return serializeBoard(toRow(board, level));
    }
};
