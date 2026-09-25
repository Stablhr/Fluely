import {Request} from 'express';
import {Types} from 'mongoose';
import {ApiError} from './error';
import {ErrorCodes} from '../constants/errorCodes';
import {ActorType} from '../constants/product';

export type Actor = {
  actorType: ActorType;
  actorId: Types.ObjectId;
};

export function actorFromRequest(req: Request): Actor {
  const payload = req.auth;
  if (!payload || !payload.type || !Types.ObjectId.isValid(payload.userId)) {
    throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'A valid product actor is required');
  }
  return {
    actorType: payload.type,
    actorId: new Types.ObjectId(payload.userId)
  };
}

export function sameActor(left: Actor, right: Actor): boolean {
  return left.actorType === right.actorType && left.actorId.equals(right.actorId);
}

export function actorIdString(actor: Actor): string {
  return actor.actorId.toString();
}

export function parseObjectId(value: string, field: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, `${field} must be a valid ObjectId`);
  }
  return new Types.ObjectId(value);
}
