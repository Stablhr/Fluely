"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workspaceService = void 0;
const workspace_repository_1 = require("../repositories/workspace.repository");
const user_repository_1 = require("../repositories/user.repository");
const error_1 = require("../utils/error");
const errorCodes_1 = require("../constants/errorCodes");
const crypto_1 = require("../utils/crypto");
const actor_1 = require("../utils/actor");
const transaction_1 = require("../utils/transaction");
const logger_1 = require("../logging/logger");
function slugify(name) {
    const base = name
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
    return base || 'workspace';
}
/**
 * Slugs double as a human-readable join handle, so collisions get a short
 * random suffix rather than a numeric counter.
 */
async function uniqueSlug(name) {
    const base = slugify(name);
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const candidate = attempt === 0 ? base : `${base}-${(0, crypto_1.createSecureToken)(3).toLowerCase()}`;
        const existing = await workspace_repository_1.workspaceRepository.findBySlug(candidate);
        if (!existing)
            return candidate;
    }
    return `${base}-${(0, crypto_1.createSecureToken)(6).toLowerCase()}`;
}
function assertMembership(role) {
    if (!role) {
        throw new error_1.ApiError(404, errorCodes_1.ErrorCodes.WORKSPACE_NOT_FOUND, 'Workspace not found');
    }
}
function serializeWorkspace(workspace) {
    return {
        id: workspace._id.toString(),
        name: workspace.name,
        slug: workspace.slug,
        ownerId: workspace.ownerId.toString(),
        role: workspace.role,
        createdAt: workspace.createdAt
    };
}
async function createWorkspace(ownerId, name) {
    const joinCode = (0, crypto_1.createSecureToken)(12);
    const slug = await uniqueSlug(name);
    const workspace = await (0, transaction_1.withProductTransaction)(async (session) => {
        const created = await workspace_repository_1.workspaceRepository.create({ name, slug, ownerId, joinCodeHash: (0, crypto_1.hashToken)(joinCode) }, session);
        await workspace_repository_1.workspaceRepository.addMember({ workspaceId: created._id, userId: ownerId, role: 'owner' }, session);
        await user_repository_1.userRepository.setPrimaryWorkspace(ownerId.toString(), created._id);
        return created;
    });
    logger_1.logger.info({ workspaceId: workspace._id.toString() }, 'Workspace created');
    // The raw code is returned exactly once; only its hash is stored.
    return { ...serializeWorkspace({ ...workspace.toObject(), role: 'owner' }), joinCode };
}
async function assertWorkspaceOwner(userId, workspaceId) {
    const id = (0, actor_1.parseObjectId)(workspaceId, 'workspaceId');
    const membership = await workspace_repository_1.workspaceRepository.findMembership(id, userId);
    if (!membership) {
        throw new error_1.ApiError(404, errorCodes_1.ErrorCodes.WORKSPACE_NOT_FOUND, 'Workspace not found');
    }
    if (membership.role !== 'owner') {
        throw new error_1.ApiError(403, errorCodes_1.ErrorCodes.FORBIDDEN, 'Only the workspace owner can do that');
    }
    const workspace = await workspace_repository_1.workspaceRepository.findById(workspaceId);
    if (!workspace) {
        throw new error_1.ApiError(404, errorCodes_1.ErrorCodes.WORKSPACE_NOT_FOUND, 'Workspace not found');
    }
    return { workspace, membership };
}
exports.workspaceService = {
    /**
     * Called on registration so every account lands in a workspace. The caller
     * logs and swallows failures: a missing workspace degrades board visibility,
     * but it must not block someone from signing up.
     */
    async provisionForUser(userId, displayName) {
        return createWorkspace(userId, `${displayName}'s Workspace`);
    },
    async create(ownerId, name) {
        return createWorkspace(ownerId, name);
    },
    async listForUser(userId) {
        const rows = await workspace_repository_1.workspaceRepository.listForUser(userId);
        return rows.map(serializeWorkspace);
    },
    async detail(userId, workspaceId) {
        const id = (0, actor_1.parseObjectId)(workspaceId, 'workspaceId');
        const membership = await workspace_repository_1.workspaceRepository.findMembership(id, userId);
        assertMembership(membership?.role);
        const workspace = await workspace_repository_1.workspaceRepository.findById(workspaceId);
        if (!workspace) {
            throw new error_1.ApiError(404, errorCodes_1.ErrorCodes.WORKSPACE_NOT_FOUND, 'Workspace not found');
        }
        return serializeWorkspace({ ...workspace.toObject(), role: membership.role });
    },
    async rename(userId, workspaceId, name) {
        const { workspace } = await assertWorkspaceOwner(userId, workspaceId);
        await workspace_repository_1.workspaceRepository.update(workspace._id.toString(), { name });
        return { id: workspace._id.toString(), name };
    },
    async listMembers(userId, workspaceId) {
        const id = (0, actor_1.parseObjectId)(workspaceId, 'workspaceId');
        const membership = await workspace_repository_1.workspaceRepository.findMembership(id, userId);
        assertMembership(membership?.role);
        const rows = await workspace_repository_1.workspaceRepository.listMembers(id);
        const users = await Promise.all(rows.map(row => user_repository_1.userRepository.findById(row.userId.toString())));
        return rows
            .map((row, index) => {
            const user = users[index];
            if (!user)
                return null;
            return {
                userId: row.userId.toString(),
                role: row.role,
                joinedAt: row.joinedAt,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                username: user.username
            };
        })
            .filter((row) => row !== null);
    },
    async addMember(userId, workspaceId, email) {
        const { workspace } = await assertWorkspaceOwner(userId, workspaceId);
        const invitee = await user_repository_1.userRepository.findByEmail(email);
        if (!invitee) {
            // Deliberately vague: do not confirm whether an address is registered.
            throw new error_1.ApiError(404, errorCodes_1.ErrorCodes.USER_NOT_FOUND, 'No account matches that email');
        }
        const existing = await workspace_repository_1.workspaceRepository.findMembership(workspace._id, invitee._id);
        if (existing) {
            throw new error_1.ApiError(409, errorCodes_1.ErrorCodes.WORKSPACE_MEMBER_EXISTS, 'That person is already in this workspace');
        }
        const membership = await workspace_repository_1.workspaceRepository.addMember({
            workspaceId: workspace._id,
            userId: invitee._id
        });
        // First workspace for this person becomes their primary.
        if (!invitee.workspaceId) {
            await user_repository_1.userRepository.setPrimaryWorkspace(invitee._id.toString(), workspace._id);
        }
        return {
            userId: membership.userId.toString(),
            role: membership.role,
            email: invitee.email,
            firstName: invitee.firstName,
            lastName: invitee.lastName
        };
    },
    async removeMember(userId, workspaceId, memberId) {
        const { workspace } = await assertWorkspaceOwner(userId, workspaceId);
        const memberObjectId = (0, actor_1.parseObjectId)(memberId, 'userId');
        if (memberObjectId.equals(workspace.ownerId)) {
            throw new error_1.ApiError(400, errorCodes_1.ErrorCodes.VALIDATION_ERROR, 'The workspace owner cannot be removed');
        }
        const membership = await workspace_repository_1.workspaceRepository.findMemberById(workspace._id, memberObjectId);
        if (!membership) {
            throw new error_1.ApiError(404, errorCodes_1.ErrorCodes.WORKSPACE_NOT_FOUND, 'That person is not in this workspace');
        }
        await workspace_repository_1.workspaceRepository.removeMember(workspace._id, memberObjectId);
        // If the person we removed was pointing here as their primary workspace,
        // fall back to whatever workspace they still belong to.
        const removed = await user_repository_1.userRepository.findById(memberId);
        if (removed?.workspaceId?.equals(workspace._id)) {
            const remaining = await workspace_repository_1.workspaceRepository.listForUser(memberObjectId);
            await user_repository_1.userRepository.setPrimaryWorkspace(memberId, remaining[0]?._id ?? null);
        }
        return { message: 'Member removed' };
    },
    async join(userId, code) {
        const workspace = await workspace_repository_1.workspaceRepository.findByJoinCodeHash((0, crypto_1.hashToken)(code));
        if (!workspace) {
            throw new error_1.ApiError(404, errorCodes_1.ErrorCodes.WORKSPACE_NOT_FOUND, 'That join code is not valid');
        }
        const existing = await workspace_repository_1.workspaceRepository.findMembership(workspace._id, userId);
        if (!existing) {
            await workspace_repository_1.workspaceRepository.addMember({ workspaceId: workspace._id, userId });
        }
        if (!existing) {
            const me = await user_repository_1.userRepository.findById(userId.toString());
            if (!me?.workspaceId) {
                await user_repository_1.userRepository.setPrimaryWorkspace(userId.toString(), workspace._id);
            }
        }
        return serializeWorkspace({ ...workspace.toObject(), role: existing?.role ?? 'member' });
    },
};
