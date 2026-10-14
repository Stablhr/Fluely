import multer from 'multer';
import {NextFunction, Request, Response} from 'express';
import {ApiError} from '../utils/error';
import {ErrorCodes} from '../constants/errorCodes';
import {mediaConfig} from '../config/media';

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
 * Multer reports its own failure modes through `MulterError`. Translate them so
 * the client sees the standard error envelope rather than a 500.
 */
export function handleUploadErrors(
  err: unknown,
  _req: Request,
  _res: Response,
  next: NextFunction
) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      next(
        new ApiError(
          413,
          ErrorCodes.FILE_TOO_LARGE,
          `File is larger than the ${Math.round(mediaConfig.maxFileSizeBytes / 1024 / 1024)}MB limit`
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
