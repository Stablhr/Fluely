import {Types} from 'mongoose';
import {userRepository} from '../repositories/user.repository';
import {CLOUDINARY_FOLDERS} from '../config/cloudinary';
import {ApiError} from '../utils/error';
import {ErrorCodes} from '../constants/errorCodes';
import {deleteFromCloudinary, uploadToCloudinary} from './cloudinary.service';

/**
 * Profile pictures.
 *
 * Unlike board and card media, an avatar has no `MediaAttachment` row: it is a
 * single field on the account, so there is nothing to list, page, or share. It
 * lives under `fluely/avatars/<userId>` so one person's assets stay together,
 * and the account keeps the Cloudinary `public_id` precisely so replacing a
 * picture can destroy the asset it replaces rather than leaking it.
 */
export const accountService = {
  async uploadAvatar(userId: Types.ObjectId, file: Express.Multer.File) {
    const existing = await userRepository.findById(userId.toString());
    if (!existing) {
      throw new ApiError(404, ErrorCodes.USER_NOT_FOUND, 'Account not found');
    }

    const result = await uploadToCloudinary(file.buffer, {
      folder: `${CLOUDINARY_FOLDERS.avatars}/${userId}`,
      resource_type: 'image',
      use_filename: true,
      unique_filename: true
    });

    try {
      await userRepository.setAvatar(
        userId.toString(),
        result.secure_url,
        result.public_id
      );
    } catch (error) {
      // The account still points at the old picture, so destroy what we just
      // pushed rather than leaving an unreferenced asset behind.
      await deleteFromCloudinary(result.public_id, 'image').catch(() => undefined);
      throw error;
    }

    // Only now is the old picture unreachable; best-effort, because a failed
    // destroy should not fail an otherwise successful upload.
    if (existing.avatarPublicId) {
      await deleteFromCloudinary(existing.avatarPublicId, 'image').catch(() => undefined);
    }

    return {avatarUrl: result.secure_url};
  },

  async removeAvatar(userId: Types.ObjectId) {
    const existing = await userRepository.findById(userId.toString());
    if (!existing) {
      throw new ApiError(404, ErrorCodes.USER_NOT_FOUND, 'Account not found');
    }
    if (!existing.avatarUrl) {
      return {avatarUrl: null};
    }

    // Destroy first: if Cloudinary is unreachable the fields still hold a
    // working URL and the request can simply be retried.
    if (existing.avatarPublicId) {
      await deleteFromCloudinary(existing.avatarPublicId, 'image');
    }

    await userRepository.clearAvatar(userId.toString());
    return {avatarUrl: null};
  }
};