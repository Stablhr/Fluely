"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.actorFromRequest = actorFromRequest;
exports.sameActor = sameActor;
exports.actorIdString = actorIdString;
exports.parseObjectId = parseObjectId;
const mongoose_1 = require("mongoose");
const error_1 = require("./error");
const errorCodes_1 = require("../constants/errorCodes");
function actorFromRequest(req) {
    const payload = req.auth;
    if (!payload || !payload.type || !mongoose_1.Types.ObjectId.isValid(payload.userId)) {
        throw new error_1.ApiError(401, errorCodes_1.ErrorCodes.UNAUTHORIZED, 'A valid product actor is required');
    }
    return {
        actorType: payload.type,
        actorId: new mongoose_1.Types.ObjectId(payload.userId)
    };
}
function sameActor(left, right) {
    return left.actorType === right.actorType && left.actorId.equals(right.actorId);
}
function actorIdString(actor) {
    return actor.actorId.toString();
}
function parseObjectId(value, field) {
    if (!mongoose_1.Types.ObjectId.isValid(value)) {
        throw new error_1.ApiError(400, errorCodes_1.ErrorCodes.VALIDATION_ERROR, `${field} must be a valid ObjectId`);
    }
    return new mongoose_1.Types.ObjectId(value);
}
