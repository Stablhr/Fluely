import multer from 'multer';
import {NextFunction, Request, Response} from 'express';
import {ApiError} from '../utils/error';
import {ErrorCodes} from '../constants/errorCodes';
import {mediaConfig, MAX_AVATAR_BYTES} from '../config/media';

/**
 * Files are held in memory and handed to Cloudinary as a stream by
 * `mediaService.create`. Nothing is written to the server's filesystem, which
 * is also what makes this work on serverless hosts where the disk is read-only.
 */
const storage = multer.memoryStorage();

function fileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) {
  if (mediaConfig.allowedMimeTypes.includes(file.mimetype.toLowerCase())) {
    cb(null, true);
    return;
  }
  cb(
    new ApiError(
      415,
      ErrorCodes.UNSUPPORTED_MEDIA_TYPE,
      `Unsupported file type: ${file.mimetype}`
    )
  );
}

export const uploadMedia = multer({
  storage,
  fileFilter,
  limits: {fileSize: mediaConfig.maxFileSizeBytes, files: 10}
});

/**
 * Profile pictures: images only, one at a time, and capped far below the
 * attachment limit. A non-image (a renamed `.exe`, say) is rejected on the
 * declared MIME type, the same way `uploadMedia` rejects unsupported types.
 */
function imageFileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) {
  if (file.mimetype.toLowerCase().startsWith('image/')) {
    cb(null, true);
    return;
  }
  cb(
    new ApiError(
      415,
      ErrorCodes.UNSUPPORTED_MEDIA_TYPE,
      `Profile pictures must be an image, got: ${file.mimetype}`
    )
  );
}

export const uploadAvatar = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {fileSize: MAX_AVATAR_BYTES, files: 1}
});

/**
 * Multer reports its own failure modes through `MulterError`. Translate them so
 * the client sees the standard error envelope rather than a 500.
 *
 * The size limit is passed in rather than read from a single config, because
 * avatars and attachments cap differently and the message has to name the right
 * number.
 */
function translateMulterError(
  err: unknown,
  maxBytes: number,
  next: NextFunction
) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      next(
        new ApiError(
          413,
          ErrorCodes.FILE_TOO_LARGE,
          `File is larger than the ${Math.round(maxBytes / 1024 / 1024)}MB limit`
        )
      );
      return;
    }
    if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
      next(
        new ApiError(
          400,
          ErrorCodes.VALIDATION_ERROR,
          'Too many files, or an unexpected field name'
        )
      );
      return;
    }
  }
  next(err);
}

export function handleUploadErrors(
  err: unknown,
  _req: Request,
  _res: Response,
  next: NextFunction
) {
  translateMulterError(err, mediaConfig.maxFileSizeBytes, next);
}

export function handleAvatarUploadErrors(
  err: unknown,
  _req: Request,
  _res: Response,
  next: NextFunction
) {
  translateMulterError(err, MAX_AVATAR_BYTES, next);
}
