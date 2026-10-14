import {env} from './env';

/**
 * Upload policy only. Files are streamed to Cloudinary (see
 * `config/cloudinary.ts`), so this module no longer owns a local directory --
 * nothing is ever written to the server's disk.
 */
export const mediaConfig = {
  allowedMimeTypes: env.MEDIA_ALLOWED_MIME_TYPES,
  maxFileSizeBytes: env.MEDIA_MAX_FILE_SIZE_BYTES,
  quotaBytes: env.MEDIA_QUOTA_BYTES
};

export function kindForMimeType(mimeType: string): 'image' | 'video' | 'audio' | 'document' {
  const type = mimeType.toLowerCase();
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  return 'document';
}

/**
 * A tighter cap for profile pictures, which render at ~64px and never need to be
 * anything close to the general attachment limit.
 */
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
