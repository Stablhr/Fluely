"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSecureToken = createSecureToken;
exports.hashToken = hashToken;
exports.deterministicHash = deterministicHash;
exports.constantTimeEqual = constantTimeEqual;
const crypto_1 = require("crypto");
function createSecureToken(bytes = 32) {
    return (0, crypto_1.randomBytes)(bytes).toString('base64url');
}
function hashToken(token) {
    return (0, crypto_1.createHash)('sha256').update(token).digest('hex');
}
function deterministicHash(value) {
    return (0, crypto_1.createHash)('sha256').update(value).digest('hex');
}
function constantTimeEqual(left, right) {
    if (left.length !== right.length) {
        return false;
    }
    let result = 0;
    for (let index = 0; index < left.length; index += 1) {
        result |= left.charCodeAt(index) ^ right.charCodeAt(index);
    }
    return result === 0;
}
