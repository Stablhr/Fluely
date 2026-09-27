import multer from 'multer';
import {NextFunction, Request, Response} from 'express';
import {ApiError} from '../utils/error';
import {ErrorCodes} from '../constants/errorCodes';
import {createSecureToken} from '../utils/crypto';
import {
  ensureUploadDir,
  extensionForMimeType,
  mediaConfig
} from '../config/media';

ensureUploadDir();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureUploadDir();
    cb(null, mediaConfig.uploadDirAbs);
  },
  filename: (_req, file, cb) => {
    const ext = extensionForMimeType(file.mimetype);
    cb(null, `${createSecureToken(16)}${ext}`);
  }
});

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
          `File exceeds the ${Math.round(mediaConfig.maxFileSizeBytes / 1024 / 1024)}MB limit`
        )
      );
      return;
    }
    if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
      next(
        new ApiError(
          400,
          ErrorCodes.VALIDATION_ERROR,
          'Too many files, or an unexpected file field was sent'
        )
      );
      return;
    }
  }
  next(err);
}
