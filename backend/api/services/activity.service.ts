import {Types} from 'mongoose';
import {activityLogRepository} from '../repositories/activityLog.repository';
import {userRepository} from '../repositories/user.repository';
import {ActivityLogDocument} from '../models/ActivityLog.model';
import {Actor} from '../utils/actor';
import {ActivityActionType, ActivityTargetType} from '../constants/product';
import {ProductSession} from '../utils/transaction';

/**
 * Who did an entry, already resolved to the words the feed renders. The name is
 * denormalised at write time so the feed never has to chase a user record for
 * every line — and so an entry still reads correctly for a collaborator who
 * cannot see the actor's profile.
 */
export type SerializedActivity = {
  id: string;
  boardId: string;
  userId: string;
  actionType: ActivityActionType;
  targetType: ActivityTargetType;
  targetId: string | null;
  metadata: Record<string, unknown>;
  actor: {id: string; name: string};
  createdAt: Date;
};

function displayName(
  user: {firstName: string; lastName: string} | null | undefined
) {
  return user ? `${user.firstName} ${user.lastName}`.trim() : '';
}

function serialize(entry: ActivityLogDocument, actorName: string): SerializedActivity {
  return {
    id: entry._id.toString(),
    boardId: entry.boardId.toString(),
    userId: entry.userId.toString(),
    actionType: entry.actionType,
    targetType: entry.targetType,
    targetId: entry.targetId ?? null,
    metadata: (entry.metadata ?? {}) as Record<string, unknown>,
    actor: {id: entry.userId.toString(), name: actorName},
    createdAt: entry.createdAt
  };
}

async function actorName(userId: Types.ObjectId): Promise<string> {
  const user = await userRepository.findById(userId.toString());
  return displayName(user);
}

type ListOptions = {
  page: number;
  limit: number;
  actionType?: string;
};

export const activityService = {
  serialize,

  /**
   * Records one entry. Runs inside the caller's transaction: the log and the
   * change it describes share a fate.
   *
   * The actor's name is resolved here rather than deferred to read time so a
   * removed collaborator's past actions still name them correctly.
   */
  async log(
    session: ProductSession,
    params: {
      boardId: Types.ObjectId;
      actor: Actor;
      actionType: ActivityActionType;
      targetType: ActivityTargetType;
      targetId?: string | null;
      metadata?: Record<string, unknown>;
    }
  ): Promise<SerializedActivity> {
    const entry = await activityLogRepository.create(
      {
        boardId: params.boardId,
        userId: params.actor.actorId,
        actionType: params.actionType,
        targetType: params.targetType,
        targetId: params.targetId ?? null,
        metadata: params.metadata
      },
      session
    );

    return serialize(entry, await actorName(params.actor.actorId));
  },

  /** Newest-first page of a board's trail, with actor names joined in. */
  async list(boardId: Types.ObjectId, options: ListOptions) {
    const skip = (options.page - 1) * options.limit;
    const entries = await activityLogRepository.listByBoard(boardId, {
      skip,
      limit: options.limit,
      actionType: options.actionType
    });

    const actorIds = [...new Set(entries.map(entry => entry.userId.toString()))];
    const actors = await Promise.all(actorIds.map(id => userRepository.findById(id)));
    const nameById = new Map<string, string>(
      actors
        .filter((user): user is NonNullable<typeof user> => user !== null)
        .map(user => [user._id.toString(), displayName(user)])
    );

    return entries.map(entry =>
      serialize(entry, nameById.get(entry.userId.toString()) ?? '')
    );
  }
};
