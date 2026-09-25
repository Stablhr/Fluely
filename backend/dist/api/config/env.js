"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.string().optional(),
    PORT: zod_1.z.string().optional(),
    MONGO_URI: zod_1.z.string().min(1),
    JWT_SECRET: zod_1.z.string().min(1),
    JWT_REFRESH_SECRET: zod_1.z.string().min(1),
    SMTP_HOST: zod_1.z.string().optional(),
    SMTP_PORT: zod_1.z.string().optional(),
    SMTP_USER: zod_1.z.string().optional(),
    SMTP_PASS: zod_1.z.string().optional(),
    SMTP_FROM: zod_1.z.string().optional(),
    COOKIE_SECURE: zod_1.z.string().optional(),
    COOKIE_SAMESITE: zod_1.z.enum(['strict', 'lax', 'none']).optional(),
    CORS_ORIGINS: zod_1.z.string().optional(),
    FRONTEND_URL: zod_1.z.string().url().optional(),
    MEDIA_MAX_FILE_SIZE_MB: zod_1.z.coerce.number().positive().max(500).optional(),
    MEDIA_QUOTA_MB: zod_1.z.coerce.number().positive().max(100000).optional(),
    MEDIA_ALLOWED_MIME_TYPES: zod_1.z.string().optional(),
    SOCIAL_SIMULATION_FAILURE_RATE: zod_1.z.coerce.number().min(0).max(1).optional()
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    const message = parsed.error.errors
        .map(e => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
    throw new Error(`Invalid environment configuration: ${message}`);
}
exports.env = {
    ...parsed.data,
    PORT: parsed.data.PORT ? Number(parsed.data.PORT) : 5000,
    FRONTEND_URL: parsed.data.FRONTEND_URL ?? 'http://localhost:3000',
    MEDIA_MAX_FILE_SIZE_BYTES: Math.round((parsed.data.MEDIA_MAX_FILE_SIZE_MB ?? 50) * 1024 * 1024),
    MEDIA_QUOTA_BYTES: Math.round((parsed.data.MEDIA_QUOTA_MB ?? 500) * 1024 * 1024),
    MEDIA_ALLOWED_MIME_TYPES: (parsed.data.MEDIA_ALLOWED_MIME_TYPES ??
        'image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,audio/mpeg,audio/ogg,audio/wav,application/pdf,text/plain')
        .split(',')
        .map(value => value.trim().toLowerCase())
        .filter(Boolean),
    SOCIAL_SIMULATION_FAILURE_RATE: parsed.data.SOCIAL_SIMULATION_FAILURE_RATE ?? 0
};
