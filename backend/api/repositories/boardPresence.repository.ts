import {Types} from 'mongoose';
import {BoardPresenceModel, type BoardPresenceDocument} from '../models/BoardPresence.model';
import type {ProductSession} from '../utils/transaction';

export const boardPresenceRepository = {
  async upsert(
    boardId: Types.ObjectId,
    userId: Types.ObjectId,
    name: string,
    session?: ProductSession
  ): Promise<BoardPresenceDocument> {
    const now = new Date();
    return BoardPresenceModel.findOneAndUpdate(
      {boardId, userId},
      {$set: {name, lastSeenAt: now}},
      {upsert: true, new: true, session}
    ).exec() as Promise<BoardPresenceDocument>;
  },

  async pruneStale(
    boardId: Types.ObjectId,
    cutoff: Date,
    session?: ProductSession
  ): Promise<void> {
    await BoardPresenceModel.deleteMany(
      {boardId, lastSeenAt: {$lt: cutoff}},
      {session}
    ).exec();
  },

  async listActive(
    boardId: Types.ObjectId,
    since: Date,
    session?: ProductSession
  ): Promise<Pick<BoardPresenceDocument, 'userId' | 'name'>[]> {
    return BoardPresenceModel.find(
      {boardId, lastSeenAt: {$gte: since}},
      {userId: 1, name: 1, _id: 0}
    ).lean().session(session ?? null).exec() as Promise<
      Pick<BoardPresenceDocument, 'userId' | 'name'>[]
    >;
  }
};