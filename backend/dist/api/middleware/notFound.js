"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = notFoundHandler;
const errorCodes_1 = require("../constants/errorCodes");
/**
 * Terminal handler for requests that matched no route. Mounted after all
 * routers and before `errorHandler` so every miss still returns the standard
 * JSON error envelope instead of Express's default HTML response.
 */
function notFoundHandler(req, res) {
    res.status(404).json({
        success: false,
        code: errorCodes_1.ErrorCodes.NOT_FOUND,
        message: `Route not found: ${req.method} ${req.originalUrl}`
    });
}
