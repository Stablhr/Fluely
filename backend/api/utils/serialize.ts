import {Types} from 'mongoose';

export type SerializedRecord = Record<string, unknown>;

function serializeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value instanceof Types.ObjectId) {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(item => serializeValue(item));
  }
  if (typeof value === 'object') {
    const record = value as SerializedRecord;
    const result: SerializedRecord = {};
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

export function serialize(value: unknown): unknown {
  return serializeValue(value);
}

export function serializeRecord(value: unknown): SerializedRecord {
  const serialized = serialize(value);
  if (serialized && typeof serialized === 'object' && !Array.isArray(serialized)) {
    return serialized as SerializedRecord;
  }
  return {};
}
