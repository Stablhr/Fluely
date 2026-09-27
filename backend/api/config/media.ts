import fs from 'fs';
import path from 'path';
import {env} from './env';

const uploadDirAbs = path.resolve(process.cwd(), env.MEDIA_UPLOAD_DIR);

export const mediaConfig = {
  uploadDirAbs,
  publicPath: '/uploads',
  allowedMimeTypes: env.MEDIA_ALLOWED_MIME_TYPES,
  maxFileSizeBytes: env.MEDIA_MAX_FILE_SIZE_BYTES,
  quotaBytes: env.MEDIA_QUOTA_BYTES
};

/**
 * Idempotent. Called on boot so the upload target always exists before multer
 * writes to it, and again from tests that build a fresh temp directory.
 */
export function ensureUploadDir(dir: string = uploadDirAbs): void {
  fs.mkdirSync(dir, {recursive: true});
}

/**
 * Extensions are derived from the allow-list rather than the client-supplied
 * filename, so a hostile `originalname` cannot introduce an executable
 * extension on disk.
 */
export function extensionForMimeType(mimeType: string): string {
  const map: Record<string, string> = {
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

export function kindForMimeType(mimeType: string): 'image' | 'video' | 'audio' | 'document' {
  const type = mimeType.toLowerCase();
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  return 'document';
}
