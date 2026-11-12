import {RevokedTokenModel} from '../models/RevokedToken.model';

export const revokedTokenRepository = {
  /** Upsert, so revoking an already-revoked token is a harmless no-op. */
  add: async (tokenHash: string, expiresAt: Date): Promise<void> => {
    await RevokedTokenModel.updateOne(
      {_id: tokenHash},
      {$setOnInsert: {expiresAt}},
      {upsert: true}
    ).exec();
  },

  exists: async (tokenHash: string): Promise<boolean> => {
    const row = await RevokedTokenModel.exists({_id: tokenHash}).exec();
    return row !== null;
  }
};
