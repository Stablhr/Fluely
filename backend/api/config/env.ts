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
  /**
   * Prefix for the auth cookie names (default "dc"). Cookies are shared by
   * every port on a host, so two apps on localhost that use the same names
   * sign each other out; give each local app its own prefix.
   */
  COOKIE_PREFIX: z.string().regex(/^[a-z][a-z0-9_]{0,19}$/i, 'letters, digits and _ only').optional(),
  CORS_ORIGINS: z.string().optional(),
  FRONTEND_URL: z.string().url().optional(),
  MEDIA_MAX_FILE_SIZE_MB: z.coerce.number().positive().max(2000).optional(),
  MEDIA_QUOTA_MB: z.coerce.number().positive().max(100000).optional(),
  CRON_SECRET: z.string().optional(),
  DONE_CARD_RETENTION_DAYS: z.coerce.number().positive().max(365).optional(),
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
  SOCIAL_SIMULATION_FAILURE_RATE: z.coerce.number().min(0).max(1).optional(),
  /**
   * Social scheduling; see docs/SOCIAL_SCHEDULING_SETUP.md. Every value is
   * optional so the app boots without them: a platform with no credentials
   * offers a demo connection, and without QStash the local server checks for
   * due posts on a timer.
   */
  API_PUBLIC_URL: z.string().url().optional(),
  /** 32 bytes, base64. Encrypts stored platform tokens (AES-256-GCM). */
  SOCIAL_TOKEN_KEY: z.string().optional(),
  FACEBOOK_MODE: z.enum(['live', 'dryrun', 'disabled']).optional(),
  TIKTOK_MODE: z.enum(['live', 'dryrun', 'disabled']).optional(),
  YOUTUBE_MODE: z.enum(['live', 'dryrun', 'disabled']).optional(),
  LINKEDIN_MODE: z.enum(['live', 'dryrun', 'disabled']).optional(),
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_GRAPH_VERSION: z.string().optional(),
  /** Facebook Login for Business configuration id (optional; used instead of a permission list). */
  META_LOGIN_CONFIG_ID: z.string().optional(),
  TIKTOK_CLIENT_KEY: z.string().optional(),
  TIKTOK_CLIENT_SECRET: z.string().optional(),
  TIKTOK_PRIVACY: z
    .enum(['SELF_ONLY', 'PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'FOLLOWER_OF_CREATOR'])
    .optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),
  /** `true` once LinkedIn approves the Community Management API. */
  LINKEDIN_ORGANIZATIONS: z.string().optional(),
  /**
   * Pins LinkedIn's versioned API (YYYYMM). Leave unset: versions retire in
   * under a year, so by default a recent one is chosen per request.
   */
  LINKEDIN_API_VERSION: z.string().regex(/^\d{6}$/).optional(),
  QSTASH_URL: z.string().url().optional(),
  QSTASH_TOKEN: z.string().optional(),
  QSTASH_CURRENT_SIGNING_KEY: z.string().optional(),
  QSTASH_NEXT_SIGNING_KEY: z.string().optional()
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
  CRON_SECRET: parsed.data.CRON_SECRET ?? '',
  DONE_CARD_RETENTION_DAYS: parsed.data.DONE_CARD_RETENTION_DAYS ?? 2,
  MEDIA_ALLOWED_MIME_TYPES: (
    parsed.data.MEDIA_ALLOWED_MIME_TYPES ??
    'image/jpeg,image/png,image/gif,image/webp,image/avif,image/heic,image/svg+xml,video/mp4,video/webm,video/quicktime,video/x-m4v,video/3gpp,video/mpeg,video/ogg,audio/mpeg,audio/ogg,audio/wav,audio/mp4,application/pdf,text/plain'
  )
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean),
  SOCIAL_SIMULATION_FAILURE_RATE:
    parsed.data.SOCIAL_SIMULATION_FAILURE_RATE ?? 0,
  API_PUBLIC_URL: (parsed.data.API_PUBLIC_URL ?? `http://localhost:${parsed.data.PORT ?? 5000}`).replace(
    /\/+$/,
    ''
  ),
  META_GRAPH_VERSION: parsed.data.META_GRAPH_VERSION ?? 'v25.0',
  TIKTOK_PRIVACY: parsed.data.TIKTOK_PRIVACY ?? 'SELF_ONLY',
  LINKEDIN_ORGANIZATIONS: parsed.data.LINKEDIN_ORGANIZATIONS === 'true',
  QSTASH_URL: (parsed.data.QSTASH_URL ?? 'https://qstash.upstash.io').replace(/\/+$/, '')
};