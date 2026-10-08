import {Types} from 'mongoose';
import {activityService} from './activity.service';
import {boardPresenceRepository} from '../repositories/boardPresence.repository';
import {userRepository} from '../repositories/user.repository';
import {BoardDocument} from '../models/Board.model';
import {Actor} from '../utils/actor';
import {ProductSession} from '../utils/transaction';

const PRESENCE_TTL_MS = 12_000;

export type PollResult = {
  revision: number;
  presence: {id: string; name: string}[];
  activity: Awaited<ReturnType<typeof activityService.since>>;
};

export const pollService = {
  async poll(
    board: BoardDocument,
    actor: Actor,
    since: number | undefined,
    session?: ProductSession
  ): Promise<PollResult> {
    const now = new Date();
    const cutoff = new Date(now.getTime() - PRESENCE_TTL_MS);

    const name = await this.resolveName(actor.actorId);

    await boardPresenceRepository.upsert(board._id, actor.actorId, name, session);
    await boardPresenceRepository.pruneStale(board._id, cutoff, session);

    const presenceDocs = await boardPresenceRepository.listActive(board._id, cutoff, session);
    const presence = presenceDocs.map(doc => ({
      id: doc.userId.toString(),
      name: doc.name
    }));

    const sinceRevision = since ?? board.revision;
    const activity = await activityService.since(board._id, sinceRevision);

    return {
      revision: board.revision,
      presence,
      activity
    };
  },

  async resolveName(userId: Types.ObjectId): Promise<string> {
    const user = await userRepository.findById(userId.toString());
    return user ? `${user.firstName} ${user.lastName}`.trim() : 'Unknown';
  }
};