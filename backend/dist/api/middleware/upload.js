"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadMedia = void 0;
exports.handleUploadErrors = handleUploadErrors;
const multer_1 = __importDefault(require("multer"));
const error_1 = require("../utils/error");
const errorCodes_1 = require("../constants/errorCodes");
const crypto_1 = require("../utils/crypto");
const media_1 = require("../config/media");
(0, media_1.ensureUploadDir)();
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => {
        (0, media_1.ensureUploadDir)();
        cb(null, media_1.mediaConfig.uploadDirAbs);
    },
    filename: (_req, file, cb) => {
        const ext = (0, media_1.extensionForMimeType)(file.mimetype);
        cb(null, `${(0, crypto_1.createSecureToken)(16)}${ext}`);
    }
});
function fileFilter(_req, file, cb) {
    if (media_1.mediaConfig.allowedMimeTypes.includes(file.mimetype.toLowerCase())) {
        cb(null, true);
        return;
    }
    cb(new error_1.ApiError(415, errorCodes_1.ErrorCodes.UNSUPPORTED_MEDIA_TYPE, `Unsupported file type: ${file.mimetype}`));
}
exports.uploadMedia = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: { fileSize: media_1.mediaConfig.maxFileSizeBytes, files: 10 }
});
/**
 * Multer reports its own failure modes through `MulterError`. Translate them so
 * the client sees the standard error envelope rather than a 500.
 */
function handleUploadErrors(err, _req, _res, next) {
    if (err instanceof multer_1.default.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            next(new error_1.ApiError(413, errorCodes_1.ErrorCodes.FILE_TOO_LARGE, `File exceeds the ${Math.round(media_1.mediaConfig.maxFileSizeBytes / 1024 / 1024)}MB limit`));
            return;
        }
        if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
            next(new error_1.ApiError(400, errorCodes_1.ErrorCodes.VALIDATION_ERROR, 'Too many files, or an unexpected file field was sent'));
            return;
        }
    }
    next(err);
}
