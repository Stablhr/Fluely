import jwt from 'jsonwebtoken';
import {REFRESH_TOKEN_TTL_SECONDS} from '../config/session';
import {revokedTokenRepository} from '../repositories/revokedToken.repository';
import {hashToken} from '../utils/crypto';

/**
 * When a revoked token stops mattering: its own `exp`, or a full refresh-token
 * lifetime from now when the token carries none (or cannot be decoded).
 */
function expiryOf(token: string): Date {
  const decoded = jwt.decode(token);
  if (decoded && typeof decoded === 'object' && typeof decoded.exp === 'number') {
    return new Date(decoded.exp * 1000);
  }
  return new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);
}

/**
 * Refresh-token revocation, shared by every server instance through MongoDB.
 * Rows remove themselves (TTL index) once the token would have expired anyway.
 */
export const blocklistService = {
  async revoke(token: string): Promise<void> {
    await revokedTokenRepository.add(hashToken(token), expiryOf(token));
  },

  async isRevoked(token: string): Promise<boolean> {
    return revokedTokenRepository.exists(hashToken(token));
  }
};
