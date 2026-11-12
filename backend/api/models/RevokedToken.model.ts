import mongoose, {Schema} from 'mongoose';

/**
 * A refresh token that may no longer be used: rotated on refresh, or ended by
 * logout.
 *
 * Kept in the database rather than in process memory because on Vercel each
 * request can land on a different, short-lived instance, so an in-memory list
 * was usually empty and a logged-out token kept working.
 *
 * `_id` is the SHA-256 of the token, so the raw token is never stored and the
 * lookup is a primary-key read. `expiresAt` is the token's own expiry and drives
 * the TTL index: once a token has expired, `jwt.verify` rejects it anyway, so
 * the row is no longer needed.
 */
export interface RevokedTokenDocument {
  _id: string;
  expiresAt: Date;
}

const RevokedTokenSchema = new Schema<RevokedTokenDocument>(
  {
    _id: {type: String, required: true},
    expiresAt: {type: Date, required: true}
  },
  {versionKey: false}
);

RevokedTokenSchema.index({expiresAt: 1}, {expireAfterSeconds: 0});

export const RevokedTokenModel = mongoose.model<RevokedTokenDocument>(
  'RevokedToken',
  RevokedTokenSchema,
  'revokedtokens'
);
