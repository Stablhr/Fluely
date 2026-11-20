import {createCipheriv, createDecipheriv, createHash, randomBytes} from 'crypto';
import {env} from '../config/env';
import {logger} from '../logging/logger';

/**
 * Encryption for the platform tokens stored on social accounts.
 *
 * AES-256-GCM with a random 12-byte IV per value, stored as
 * `v1.<iv>.<tag>.<ciphertext>` (base64url). The key comes from
 * `SOCIAL_TOKEN_KEY`. Without it -- local development, tests -- a key is
 * derived from `JWT_SECRET` so the feature still works, with a warning,
 * because a token at rest must never be stored in the clear.
 */

let cachedKey: Buffer | null = null;
let warned = false;

function key(): Buffer {
  if (cachedKey) return cachedKey;
  if (env.SOCIAL_TOKEN_KEY) {
    const decoded = Buffer.from(env.SOCIAL_TOKEN_KEY, 'base64');
    if (decoded.length !== 32) {
      throw new Error('SOCIAL_TOKEN_KEY must be 32 bytes, base64-encoded');
    }
    cachedKey = decoded;
  } else {
    if (!warned && env.NODE_ENV === 'production') {
      logger.warn('SOCIAL_TOKEN_KEY is not set; deriving the token key from JWT_SECRET');
    }
    warned = true;
    cachedKey = createHash('sha256').update(`social-token:${env.JWT_SECRET}`).digest();
  }
  return cachedKey;
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv, tag, data].map(part => (typeof part === 'string' ? part : part.toString('base64url'))).join('.');
}

export function decryptToken(stored: string): string {
  const [version, iv, tag, data] = stored.split('.');
  if (version !== 'v1' || !iv || !tag || data === undefined) {
    throw new Error('Unrecognised token format');
  }
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString(
    'utf8'
  );
}
