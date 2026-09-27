import {randomInt} from 'crypto';

/**
 * Public board URLs should be guess-resistant but still typeable, so this uses
 * an unambiguous alphabet (no 0/O/1/l/I). `randomInt` is used rather than
 * mapping bytes modulo the alphabet, which would skew the distribution.
 */
const SLUG_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const SLUG_LENGTH = 12;

export function createPublicSlug(): string {
  let slug = '';
  for (let index = 0; index < SLUG_LENGTH; index += 1) {
    slug += SLUG_ALPHABET[randomInt(SLUG_ALPHABET.length)];
  }
  return slug;
}
