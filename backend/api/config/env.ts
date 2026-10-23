import dotenv from 'dotenv';
import {z} from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.string().optional(),
  PORT: z.string().optional(),
  MONGO_URI: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  /** Rolling session length in days; see `config/session.ts`. Defaults to 30. */
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().max(3650).optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  COOKIE_SECURE: z.string().optional(),
  COOKIE_SAMESITE: z.enum(['strict', 'lax', 'none']).optional(),
  CORS_ORIGINS: z.string().optional(),
  FRONTEND_URL: z.string().url().optional(),
  MEDIA_MAX_FILE_SIZE_MB: z.coerce.number().positive().max(2000).optional(),
  MEDIA_QUOTA_MB: z.coerce.number().positive().max(100000).optional(),
  MEDIA_ALLOWED_MIME_TYPES: z.string().optional(),
  /**
   * Cloudinary credentials. Optional here so the app boots (and the test suite
   * runs) without them, but every upload path requires all three; see
   * `config/cloudinary.ts`.
   */
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  /** Root folder every asset is stored under. Defaults to `fluely`. */
  CLOUDINARY_FOLDER: z.string().optional(),
  SOCIAL_SIMULATION_FAILURE_RATE: z.coerce.number().min(0).max(1).optional()
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const message = parsed.error.errors
    .map(e => `${e.path.join('.')}: ${e.message}`)
    .join(', ');
  throw new Error(`Invalid environment configuration: ${message}`);
}

export const env = {
  ...parsed.data,
  PORT: parsed.data.PORT ? Number(parsed.data.PORT) : 5000,
  FRONTEND_URL: parsed.data.FRONTEND_URL ?? 'http://localhost:3000',
  MEDIA_MAX_FILE_SIZE_BYTES: Math.round(
    (parsed.data.MEDIA_MAX_FILE_SIZE_MB ?? 500) * 1024 * 1024
  ),
  MEDIA_QUOTA_BYTES: Math.round(
    (parsed.data.MEDIA_QUOTA_MB ?? 2048) * 1024 * 1024
  ),
  MEDIA_ALLOWED_MIME_TYPES: (
    parsed.data.MEDIA_ALLOWED_MIME_TYPES ??
    'image/jpeg,image/png,image/gif,image/webp,image/avif,image/heic,image/svg+xml,video/mp4,video/webm,video/quicktime,video/x-m4v,video/3gpp,video/mpeg,video/ogg,audio/mpeg,audio/ogg,audio/wav,audio/mp4,application/pdf,text/plain'
  )
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean),
  SOCIAL_SIMULATION_FAILURE_RATE:
    parsed.data.SOCIAL_SIMULATION_FAILURE_RATE ?? 0
};