"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mediaConfig = void 0;
exports.ensureUploadDir = ensureUploadDir;
exports.extensionForMimeType = extensionForMimeType;
exports.kindForMimeType = kindForMimeType;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const env_1 = require("./env");
const isServerless = Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
    Boolean(process.env.LAMBDA_TASK_ROOT) ||
    Boolean(process.env.AWS_EXECUTION_ENV) ||
    Boolean(process.env.VERCEL) ||
    Boolean(process.env.VERCEL_ENV) ||
    Boolean(process.env.SERVERLESS) ||
    process.env.NODE_ENV === 'production' && process.platform !== 'win32';
const defaultUploadDir = isServerless
    ? path_1.default.join(os_1.default.tmpdir(), 'uploads')
    : path_1.default.resolve(process.cwd(), env_1.env.MEDIA_UPLOAD_DIR);
const uploadDirAbs = env_1.env.MEDIA_UPLOAD_DIR
    ? (path_1.default.isAbsolute(env_1.env.MEDIA_UPLOAD_DIR)
        ? env_1.env.MEDIA_UPLOAD_DIR
        : path_1.default.resolve(process.cwd(), env_1.env.MEDIA_UPLOAD_DIR))
    : defaultUploadDir;
exports.mediaConfig = {
    uploadDirAbs,
    publicPath: '/uploads',
    allowedMimeTypes: env_1.env.MEDIA_ALLOWED_MIME_TYPES,
    maxFileSizeBytes: env_1.env.MEDIA_MAX_FILE_SIZE_BYTES,
    quotaBytes: env_1.env.MEDIA_QUOTA_BYTES
};
/**
 * Idempotent. Called on boot so the upload target always exists before multer
 * writes to it, and again from tests that build a fresh temp directory.
 */
function ensureUploadDir(dir = uploadDirAbs) {
    fs_1.default.mkdirSync(dir, { recursive: true });
}
/**
 * Extensions are derived from the allow-list rather than the client-supplied
 * filename, so a hostile `originalname` cannot introduce an executable
 * extension on disk.
 */
function extensionForMimeType(mimeType) {
    const map = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'image/webp': '.webp',
        'video/mp4': '.mp4',
        'video/webm': '.webm',
        'audio/mpeg': '.mp3',
        'audio/ogg': '.ogg',
        'audio/wav': '.wav',
        'application/pdf': '.pdf',
        'text/plain': '.txt'
    };
    return map[mimeType.toLowerCase()] ?? '.bin';
}
function kindForMimeType(mimeType) {
    const type = mimeType.toLowerCase();
    if (type.startsWith('image/'))
        return 'image';
    if (type.startsWith('video/'))
        return 'video';
    if (type.startsWith('audio/'))
        return 'audio';
    return 'document';
}
