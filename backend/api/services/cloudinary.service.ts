import type {UploadApiOptions, UploadApiResponse} from 'cloudinary';
import {CLOUDINARY_FOLDERS, cloudinary, isCloudinaryConfigured} from '../config/cloudinary';
import {ApiError} from '../utils/error';
import {ErrorCodes} from '../constants/errorCodes';
import type {CloudinaryResourceType} from '../constants/product';

export type {CloudinaryResourceType};

export interface UploadScope {
  boardId?: string | null;
  cardId?: string | null;
}

/**
 * Which Cloudinary folder a file belongs in, decided from where it was
 * attached. A card attachment is the common case (`tasks`), a board-level asset
 * (background/cover) is `boards`, and media uploaded on its own -- e.g. from the
 * content planner's media library -- lands in `contentPlanner`. The `avatars`
 * folder is reserved for profile images.
 */
export function folderForMedia(scope: UploadScope = {}): string {
  if (scope.cardId) return CLOUDINARY_FOLDERS.tasks;
  if (scope.boardId) return CLOUDINARY_FOLDERS.boards;
  return CLOUDINARY_FOLDERS.contentPlanner;
}

/**
 * Streams a buffer straight to Cloudinary -- no local disk write.
 *
 * `resource_type: 'auto'` lets Cloudinary classify images, video (audio is a
 * video subtype), and raw documents correctly. The returned `resource_type`
 * must be persisted, because deleting an asset later requires the same value.
 */
export function uploadToCloudinary(
  buffer: Buffer,
  options: UploadApiOptions
): Promise<UploadApiResponse> {
  if (!isCloudinaryConfigured) {
    return Promise.reject(
      new ApiError(
        503,
        ErrorCodes.INTERNAL_ERROR,
        'Media storage is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.'
      )
    );
  }

  return new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {resource_type: 'auto', secure: true, ...options},
      (error, result) => {
        if (error) {
          reject(
            new ApiError(
              502,
              ErrorCodes.INTERNAL_ERROR,
              error.message || 'Cloudinary upload failed'
            )
          );
          return;
        }
        if (!result) {
          reject(
            new ApiError(502, ErrorCodes.INTERNAL_ERROR, 'Cloudinary returned no result')
          );
          return;
        }
        resolve(result);
      }
    );
    stream.end(buffer);
  });
}

/**
 * Removes an asset from Cloudinary. Failures are swallowed by callers that
 * treat cleanup as best-effort, but the error is surfaced to a caller like the
 * media delete route so a failed destroy is not silently reported as success.
 */
export async function deleteFromCloudinary(
  publicId: string,
  resourceType: CloudinaryResourceType = 'image'
): Promise<void> {
  if (!isCloudinaryConfigured) {
    throw new ApiError(
      503,
      ErrorCodes.INTERNAL_ERROR,
      'Media storage is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.'
    );
  }
  await cloudinary.uploader.destroy(publicId, {resource_type: resourceType, invalidate: true});
}

/** Normalises Cloudinary's `resource_type` to what we persist. */
export function toResourceType(value: string): CloudinaryResourceType {
  return value === 'video' || value === 'raw' ? value : 'image';
}
