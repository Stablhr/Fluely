"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireAdmin = requireAdmin;
exports.requireUser = requireUser;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const error_1 = require("../utils/error");
const cookies_1 = require("../constants/cookies");
const errorCodes_1 = require("../constants/errorCodes");
function requireAuth(req, _res, next) {
    const header = req.headers.authorization;
    let token;
    if (header) {
        const [scheme, value] = header.split(' ');
        if (scheme === 'Bearer' && value) {
            token = value;
        }
    }
    if (!token) {
        token = req.cookies?.[cookies_1.ACCESS_TOKEN_COOKIE];
    }
    if (!token) {
        return next(new error_1.ApiError(401, errorCodes_1.ErrorCodes.UNAUTHORIZED, 'Missing access token'));
    }
    try {
        const payload = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
        req.auth = payload;
        return next();
    }
    catch {
        return next(new error_1.ApiError(401, errorCodes_1.ErrorCodes.UNAUTHORIZED, 'Invalid token'));
    }
}
function requireAdmin(req, _res, next) {
    if (!req.auth) {
        return next(new error_1.ApiError(401, errorCodes_1.ErrorCodes.UNAUTHORIZED, 'Not authenticated'));
    }
    if (req.auth.type !== 'admin') {
        return next(new error_1.ApiError(403, errorCodes_1.ErrorCodes.FORBIDDEN, 'Admin access required'));
    }
    return next();
}
/**
 * Guards the planner surface. Admins have their own dashboard and the frontend
 * AuthGate already redirects them away from these routes, but the API has to
 * hold the line on its own rather than trusting the client.
 */
function requireUser(req, _res, next) {
    if (!req.auth) {
        return next(new error_1.ApiError(401, errorCodes_1.ErrorCodes.UNAUTHORIZED, 'Not authenticated'));
    }
    if (req.auth.type !== 'user') {
        return next(new error_1.ApiError(403, errorCodes_1.ErrorCodes.FORBIDDEN, 'This area is for user accounts'));
    }
    return next();
}
