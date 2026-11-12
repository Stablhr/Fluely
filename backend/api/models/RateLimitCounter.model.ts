import mongoose, {Schema} from 'mongoose';

/**
 * One rate-limit window for one client key (e.g. `auth:ip:1.2.3.4`).
 *
 * Shared through MongoDB so every serverless instance counts against the same
 * budget; an in-memory counter gave each instance its own allowance. The TTL
 * index on `resetAt` sweeps finished windows. The sweep runs about once a
 * minute, so the increment in the repository also restarts a window whose
 * `resetAt` has passed instead of relying on the row being gone.
 */
export interface RateLimitCounterDocument {
  _id: string;
  hits: number;
  resetAt: Date;
}

const RateLimitCounterSchema = new Schema<RateLimitCounterDocument>(
  {
    _id: {type: String, required: true},
    hits: {type: Number, required: true},
    resetAt: {type: Date, required: true}
  },
  {versionKey: false}
);

RateLimitCounterSchema.index({resetAt: 1}, {expireAfterSeconds: 0});

export const RateLimitCounterModel = mongoose.model<RateLimitCounterDocument>(
  'RateLimitCounter',
  RateLimitCounterSchema,
  'ratelimitcounters'
);
