import {v2 as cloudinary} from 'cloudinary';
import {env} from './env';

/**
 * Central Cloudinary client.
 *
 * The SDK is configured exactly once, here, on first import. Every upload and
 * delete goes through this module (via `services/cloudinary.service.ts`) rather
 * than calling the SDK directly, so credentials, the folder layout, and error
 * handling stay in one place.
 */

const root = (env.CLOUDINARY_FOLDER ?? 'fluely').replace(/^\/+|\/+$/g, '');

/**
 * One folder per upload surface. Keeping them apart in the Cloudinary media
 * library makes assets easy to audit and clean up by feature.
 */
export const CLOUDINARY_FOLDERS = {
  /** Profile images. */
  avatars: `${root}/avatars`,
  /** Board backgrounds/cover images. */
  boards: `${root}/boards`,
  /** Card attachments (images, video, audio, documents). */
  tasks: `${root}/tasks`,
  /** Content-planner and social-post media. */
  contentPlanner: `${root}/content-planner`
} as const;

export const isCloudinaryConfigured = Boolean(
  env.CLOUDINARY_CLOUD_NAME &&
    env.CLOUDINARY_API_KEY &&
    env.CLOUDINARY_API_SECRET
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true
  });
}

export {cloudinary};
