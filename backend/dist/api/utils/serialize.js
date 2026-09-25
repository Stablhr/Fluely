"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serialize = serialize;
exports.serializeRecord = serializeRecord;
const mongoose_1 = require("mongoose");
function serializeValue(value) {
    if (value === null || value === undefined) {
        return value;
    }
    if (value instanceof Date) {
        return value.toISOString();
    }
    if (value instanceof mongoose_1.Types.ObjectId) {
        return value.toString();
    }
    if (Array.isArray(value)) {
        return value.map(item => serializeValue(item));
    }
    if (typeof value === 'object') {
        const record = value;
        const result = {};
        for (const [key, item] of Object.entries(record)) {
            if (key === '__v') {
                continue;
            }
            if (key === '_id') {
                result.id = serializeValue(item);
                continue;
            }
            result[key] = serializeValue(item);
        }
        return result;
    }
    return value;
}
function serialize(value) {
    return serializeValue(value);
}
function serializeRecord(value) {
    const serialized = serialize(value);
    if (serialized && typeof serialized === 'object' && !Array.isArray(serialized)) {
        return serialized;
    }
    return {};
}
