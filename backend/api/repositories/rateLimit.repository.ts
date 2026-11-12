import {RateLimitCounterModel} from '../models/RateLimitCounter.model';

export type RateLimitWindow = {hits: number; resetAt: Date};

export const rateLimitRepository = {
  /**
   * Counts one hit and returns the window it landed in, atomically.
   *
   * A single pipeline update either bumps a live window or starts a fresh one
   * (new key, or `resetAt` already passed), so concurrent requests on different
   * instances can never both see "first hit". Time comes from the database
   * (`$$NOW`), not the instance clock, so windows agree across instances.
   */
  increment: async (key: string, windowMs: number): Promise<RateLimitWindow> => {
    const live = {$gt: ['$resetAt', '$$NOW']};
    const row = await RateLimitCounterModel.findOneAndUpdate(
      {_id: key},
      [
        {
          $set: {
            hits: {$cond: [live, {$add: ['$hits', 1]}, 1]},
            resetAt: {$cond: [live, '$resetAt', {$add: ['$$NOW', windowMs]}]}
          }
        }
      ],
      {upsert: true, new: true}
    )
      .lean()
      .exec();

    if (!row) throw new Error('Rate limit counter write returned no document');
    return {hits: row.hits, resetAt: row.resetAt};
  },

  /** Gives back one hit in a live window (used when a counted request is skipped). */
  decrement: async (key: string): Promise<void> => {
    await RateLimitCounterModel.updateOne(
      {_id: key, resetAt: {$gt: new Date()}, hits: {$gt: 0}},
      {$inc: {hits: -1}}
    ).exec();
  },

  reset: async (key: string): Promise<void> => {
    await RateLimitCounterModel.deleteOne({_id: key}).exec();
  }
};
