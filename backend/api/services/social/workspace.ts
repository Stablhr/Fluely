import {Types} from 'mongoose';
import {ErrorCodes} from '../../constants/errorCodes';
import {logger} from '../../logging/logger';
import {userRepository} from '../../repositories/user.repository';
import {workspaceRepository} from '../../repositories/workspace.repository';
import {Actor} from '../../utils/actor';
import {ApiError} from '../../utils/error';
import {workspaceService} from '../workspace.service';

/**
 * Social posts and accounts belong to the person's workspace (their primary
 * one), so everyone in it shares the same calendar and connected accounts.
 *
 * Registration gives every account a workspace, but older accounts (or one
 * whose provisioning failed) may have none; they get one here on first use,
 * exactly as registration would have done.
 */

const provisioning = new Map<string, Promise<unknown>>();

async function ensureWorkspace(actor: Actor): Promise<Types.ObjectId> {
  const key = actor.actorId.toString();
  let user = await userRepository.findById(key);
  if (!user) throw new ApiError(404, ErrorCodes.USER_NOT_FOUND, 'Account not found');
  if (user.workspaceId) return user.workspaceId;

  // The planner and the dashboard load posts at the same time; create once.
  let pending = provisioning.get(key);
  if (!pending) {
    pending = workspaceService
      .provisionForUser(actor.actorId, user.firstName || 'My')
      .finally(() => provisioning.delete(key));
    provisioning.set(key, pending);
  }
  try {
    await pending;
  } catch (error) {
    logger.error({err: error, userId: key}, 'Could not create a workspace for social scheduling');
  }
  user = await userRepository.findById(key);
  if (!user?.workspaceId) {
    throw new ApiError(409, ErrorCodes.NO_WORKSPACE, 'Join or create a workspace to schedule posts');
  }
  return user.workspaceId;
}

export async function socialWorkspace(actor: Actor): Promise<{workspaceId: Types.ObjectId; isOwner: boolean}> {
  const workspaceId = await ensureWorkspace(actor);
  const membership = await workspaceRepository.findMembership(workspaceId, actor.actorId);
  if (!membership) {
    throw new ApiError(404, ErrorCodes.WORKSPACE_NOT_FOUND, 'Workspace not found');
  }
  return {workspaceId, isOwner: membership.role === 'owner'};
}
