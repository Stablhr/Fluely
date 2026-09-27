"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPublicSlug = createPublicSlug;
const crypto_1 = require("crypto");
/**
 * Public board URLs should be guess-resistant but still typeable, so this uses
 * an unambiguous alphabet (no 0/O/1/l/I). `randomInt` is used rather than
 * mapping bytes modulo the alphabet, which would skew the distribution.
 */
const SLUG_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const SLUG_LENGTH = 12;
function createPublicSlug() {
    let slug = '';
    for (let index = 0; index < SLUG_LENGTH; index += 1) {
        slug += SLUG_ALPHABET[(0, crypto_1.randomInt)(SLUG_ALPHABET.length)];
    }
    return slug;
}
