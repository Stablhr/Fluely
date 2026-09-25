import dotenv from 'dotenv';
import {z} from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.string().optional(),
  PORT: z.string().optional(),
  MONGO_URI: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  COOKIE_SECURE: z.string().optional(),
  COOKIE_SAMESITE: z.enum(['strict', 'lax', 'none']).optional(),
  CORS_ORIGINS: z.string().optional(),
  FRONTEND_URL: z.string().url().optional(),
  MEDIA_MAX_FILE_SIZE_MB: z.coerce.number().positive().max(500).optional(),
  MEDIA_QUOTA_MB: z.coerce.number().positive().max(100000).optional(),
  MEDIA_ALLOWED_MIME_TYPES: z.string().optional(),
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
    (parsed.data.MEDIA_MAX_FILE_SIZE_MB ?? 50) * 1024 * 1024
  ),
  MEDIA_QUOTA_BYTES: Math.round(
    (parsed.data.MEDIA_QUOTA_MB ?? 500) * 1024 * 1024
  ),
  MEDIA_ALLOWED_MIME_TYPES: (
    parsed.data.MEDIA_ALLOWED_MIME_TYPES ??
    'image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,audio/mpeg,audio/ogg,audio/wav,application/pdf,text/plain'
  )
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean),
  SOCIAL_SIMULATION_FAILURE_RATE:
    parsed.data.SOCIAL_SIMULATION_FAILURE_RATE ?? 0
};