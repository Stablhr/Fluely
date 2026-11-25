import {RevokedTokenModel} from '../models/RevokedToken.model';

export const revokedTokenRepository = {
  /**
   * Upsert, so revoking an already-revoked token is a harmless no-op. Returns
   * true only for the call that revoked it, so a refresh can use each token once.
   */
  add: async (tokenHash: string, expiresAt: Date): Promise<boolean> => {
    try {
      const result = await RevokedTokenModel.updateOne(
        {_id: tokenHash},
        {$setOnInsert: {expiresAt}},
        {upsert: true}
      ).exec();
      return result.upsertedCount === 1;
    } catch (error) {
      // Two upserts racing on one _id: the loser gets a duplicate key error.
      if ((error as {code?: number}).code === 11000) return false;
      throw error;
    }
  },

  exists: async (tokenHash: string): Promise<boolean> => {
    const row = await RevokedTokenModel.exists({_id: tokenHash}).exec();
    return row !== null;
  }
};
