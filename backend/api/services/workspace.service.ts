import {Types} from 'mongoose';
import {workspaceRepository} from '../repositories/workspace.repository';
import {userRepository} from '../repositories/user.repository';
import {ApiError} from '../utils/error';
import {ErrorCodes} from '../constants/errorCodes';
import {createSecureToken, hashToken} from '../utils/crypto';
import {parseObjectId} from '../utils/actor';
import {withProductTransaction} from '../utils/transaction';
import {WorkspaceMemberRole} from '../models/Workspace.model';
import {logger} from '../logging/logger';

type WorkspaceRow = {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  ownerId: Types.ObjectId;
  createdAt: Date;
  role: WorkspaceMemberRole;
};

function slugify(name: string): string {
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
async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${createSecureToken(3).toLowerCase()}`;
    const existing = await workspaceRepository.findBySlug(candidate);
    if (!existing) return candidate;
  }
  return `${base}-${createSecureToken(6).toLowerCase()}`;
}

function assertMembership(role: WorkspaceMemberRole | undefined) {
  if (!role) {
    throw new ApiError(404, ErrorCodes.WORKSPACE_NOT_FOUND, 'Workspace not found');
  }
}

function serializeWorkspace(workspace: WorkspaceRow) {
  return {
    id: workspace._id.toString(),
    name: workspace.name,
    slug: workspace.slug,
    ownerId: workspace.ownerId.toString(),
    role: workspace.role,
    createdAt: workspace.createdAt
  };
}

async function createWorkspace(ownerId: Types.ObjectId, name: string) {
  const joinCode = createSecureToken(12);
  const slug = await uniqueSlug(name);

  const workspace = await withProductTransaction(async session => {
    const created = await workspaceRepository.create(
      {name, slug, ownerId, joinCodeHash: hashToken(joinCode)},
      session
    );
    await workspaceRepository.addMember(
      {workspaceId: created._id, userId: ownerId, role: 'owner'},
      session
    );
    await userRepository.setPrimaryWorkspace(ownerId.toString(), created._id);
    return created;
  });

  logger.info({workspaceId: workspace._id.toString()}, 'Workspace created');

  // The raw code is returned exactly once; only its hash is stored.
  return {...serializeWorkspace({...workspace.toObject(), role: 'owner'}), joinCode};
}

async function assertWorkspaceOwner(userId: Types.ObjectId, workspaceId: string) {
  const id = parseObjectId(workspaceId, 'workspaceId');
  const membership = await workspaceRepository.findMembership(id, userId);
  if (!membership) {
    throw new ApiError(404, ErrorCodes.WORKSPACE_NOT_FOUND, 'Workspace not found');
  }
  if (membership.role !== 'owner') {
    throw new ApiError(403, ErrorCodes.FORBIDDEN, 'Only the workspace owner can do that');
  }
  const workspace = await workspaceRepository.findById(workspaceId);
  if (!workspace) {
    throw new ApiError(404, ErrorCodes.WORKSPACE_NOT_FOUND, 'Workspace not found');
  }
  return {workspace, membership};
}

export const workspaceService = {
  /**
   * Called on registration so every account lands in a workspace. The caller
   * logs and swallows failures: a missing workspace degrades board visibility,
   * but it must not block someone from signing up.
   */
  async provisionForUser(userId: Types.ObjectId, displayName: string) {
    return createWorkspace(userId, `${displayName}'s Workspace`);
  },

  async create(ownerId: Types.ObjectId, name: string) {
    return createWorkspace(ownerId, name);
  },

  async listForUser(userId: Types.ObjectId) {
    const rows = await workspaceRepository.listForUser(userId);
    return rows.map(serializeWorkspace);
  },

  async detail(userId: Types.ObjectId, workspaceId: string) {
    const id = parseObjectId(workspaceId, 'workspaceId');
    const membership = await workspaceRepository.findMembership(id, userId);
    assertMembership(membership?.role);

    const workspace = await workspaceRepository.findById(workspaceId);
    if (!workspace) {
      throw new ApiError(404, ErrorCodes.WORKSPACE_NOT_FOUND, 'Workspace not found');
    }
    return serializeWorkspace({...workspace.toObject(), role: membership!.role});
  },

  async rename(userId: Types.ObjectId, workspaceId: string, name: string) {
    const {workspace} = await assertWorkspaceOwner(userId, workspaceId);
    await workspaceRepository.update(workspace._id.toString(), {name});
    return {id: workspace._id.toString(), name};
  },

  async listMembers(userId: Types.ObjectId, workspaceId: string) {
    const id = parseObjectId(workspaceId, 'workspaceId');
    const membership = await workspaceRepository.findMembership(id, userId);
    assertMembership(membership?.role);

    const rows = await workspaceRepository.listMembers(id);
    const users = await Promise.all(
      rows.map(row => userRepository.findById(row.userId.toString()))
    );

    return rows
      .map((row, index) => {
        const user = users[index];
        if (!user) return null;
        return {
          userId: row.userId.toString(),
          role: row.role as WorkspaceMemberRole,
          joinedAt: row.joinedAt,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          username: user.username
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
  },

  async addMember(userId: Types.ObjectId, workspaceId: string, email: string) {
    const {workspace} = await assertWorkspaceOwner(userId, workspaceId);

    const invitee = await userRepository.findByEmail(email);
    if (!invitee) {
      // Deliberately vague: do not confirm whether an address is registered.
      throw new ApiError(404, ErrorCodes.USER_NOT_FOUND, 'No account matches that email');
    }

    const existing = await workspaceRepository.findMembership(workspace._id, invitee._id);
    if (existing) {
      throw new ApiError(
        409,
        ErrorCodes.WORKSPACE_MEMBER_EXISTS,
        'That person is already in this workspace'
      );
    }

    const membership = await workspaceRepository.addMember({
      workspaceId: workspace._id,
      userId: invitee._id
    });

    // First workspace for this person becomes their primary.
    if (!invitee.workspaceId) {
      await userRepository.setPrimaryWorkspace(invitee._id.toString(), workspace._id);
    }

    return {
      userId: membership.userId.toString(),
      role: membership.role,
      email: invitee.email,
      firstName: invitee.firstName,
      lastName: invitee.lastName
    };
  },

  async removeMember(userId: Types.ObjectId, workspaceId: string, memberId: string) {
    const {workspace} = await assertWorkspaceOwner(userId, workspaceId);
    const memberObjectId = parseObjectId(memberId, 'userId');

    if (memberObjectId.equals(workspace.ownerId)) {
      throw new ApiError(
        400,
        ErrorCodes.VALIDATION_ERROR,
        'The workspace owner cannot be removed'
      );
    }

    const membership = await workspaceRepository.findMemberById(workspace._id, memberObjectId);
    if (!membership) {
      throw new ApiError(
        404,
        ErrorCodes.WORKSPACE_NOT_FOUND,
        'That person is not in this workspace'
      );
    }

    await workspaceRepository.removeMember(workspace._id, memberObjectId);

    // If the person we removed was pointing here as their primary workspace,
    // fall back to whatever workspace they still belong to.
    const removed = await userRepository.findById(memberId);
    if (removed?.workspaceId?.equals(workspace._id)) {
      const remaining = await workspaceRepository.listForUser(memberObjectId);
      await userRepository.setPrimaryWorkspace(
        memberId,
        remaining[0]?._id ?? null
      );
    }

    return {message: 'Member removed'};
  },

  async join(userId: Types.ObjectId, code: string) {
    const workspace = await workspaceRepository.findByJoinCodeHash(hashToken(code));
    if (!workspace) {
      throw new ApiError(404, ErrorCodes.WORKSPACE_NOT_FOUND, 'That join code is not valid');
    }

    const existing = await workspaceRepository.findMembership(workspace._id, userId);
    if (!existing) {
      await workspaceRepository.addMember({workspaceId: workspace._id, userId});
    }

    if (!existing) {
      const me = await userRepository.findById(userId.toString());
      if (!me?.workspaceId) {
        await userRepository.setPrimaryWorkspace(userId.toString(), workspace._id);
      }
    }

    return serializeWorkspace({...workspace.toObject(), role: existing?.role ?? 'member'});
  },

};