import {Types} from 'mongoose';
import {userRepository} from '../repositories/user.repository';
import {boardRepository} from '../repositories/board.repository';
import {boardCollaboratorRepository} from '../repositories/boardCollaborator.repository';
import {CLOUDINARY_FOLDERS} from '../config/cloudinary';
import {ApiError} from '../utils/error';
import {ErrorCodes} from '../constants/errorCodes';
import {deleteFromCloudinary, uploadToCloudinary} from './cloudinary.service';

export type ProfilePatch = {
  displayName?: string | null;
  username?: string | null;
  jobTitle?: string | null;
  bio?: string | null;
  pronouns?: string | null;
  timezone?: string | null;
  accentColor?: string | null;
  avatarColor?: string | null;
  phone?: string | null;
  profileVisibility?: Record<string, 'me' | 'boards'> | null;
};

function sanitizeText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  // Strip HTML tags to prevent injection; collapse repeated spaces.
  return value.replace(/<[^>]*>/g, '').replace(/\\s+/g, ' ').trim();
}

function toProfile(account: any) {
  return {
    id: account._id.toString(),
    email: account.email,
    firstName: account.firstName,
    lastName: account.lastName,
    username: account.username ?? null,
    avatarUrl: account.avatarUrl ?? null,
    avatarColor: account.avatarColor ?? null,
    displayName: account.displayName ?? null,
    jobTitle: account.jobTitle ?? null,
    bio: account.bio ?? null,
    pronouns: account.pronouns ?? null,
    timezone: account.timezone ?? null,
    accentColor: account.accentColor ?? null,
    phone: account.phone ?? null,
    profileVisibility: account.profileVisibility ?? null,
    createdAt: account.createdAt,
  };
}

async function sharesBoard(viewerId: Types.ObjectId, targetId: Types.ObjectId, boardId?: string): Promise<boolean> {
  if (viewerId.toString() === targetId.toString()) return true;
  // If a board context is provided, verify both have access to it.
  if (boardId) {
    const board = await boardRepository.findById(boardId);
    if (!board) return false;
    const vCollab = await boardCollaboratorRepository.find(board._id, viewerId);
    const tCollab = await boardCollaboratorRepository.find(board._id, targetId);
    const viewerIsOwner = board.ownerId.equals(viewerId);
    const targetIsOwner = board.ownerId.equals(targetId);
    const viewerAccess = viewerIsOwner || (vCollab?.status === 'accepted');
    const targetAccess = targetIsOwner || (tCollab?.status === 'accepted');
    return viewerAccess && targetAccess;
  }
  // No board context: check if they share any board. Scan boards owned by
  // either party and check whether the other is an accepted collaborator.
  const targetOwned = await boardRepository.listOwnedBy(targetId);
  for (const b of targetOwned) {
    const collab = await boardCollaboratorRepository.find(b._id, viewerId);
    if (collab?.status === 'accepted') return true;
  }
  const viewerOwned = await boardRepository.listOwnedBy(viewerId);
  for (const b of viewerOwned) {
    const collab = await boardCollaboratorRepository.find(b._id, targetId);
    if (collab?.status === 'accepted') return true;
  }
  return false;
}

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
  },

  /** Full profile for the signed-in user. */
  async getProfile(userId: Types.ObjectId) {
    const account = await userRepository.findById(userId.toString());
    if (!account) throw new ApiError(404, ErrorCodes.USER_NOT_FOUND, 'Account not found');
    return toProfile(account);
  },

  /** Live availability check for a username/handle. */
  async isUsernameAvailable(username: string, selfId: Types.ObjectId): Promise<boolean> {
    const existing = await userRepository.findByUsername(username);
    if (!existing) return true;
    return existing._id.toString() === selfId.toString();
  },

  /** Update editable profile fields. */
  async updateProfile(userId: Types.ObjectId, patch: ProfilePatch) {
    const existing = await userRepository.findById(userId.toString());
    if (!existing) throw new ApiError(404, ErrorCodes.USER_NOT_FOUND, 'Account not found');

    const update: Record<string, unknown> = {};

    if (patch.displayName !== undefined) {
      const now = new Date();
      const last = existing.lastDisplayNameChangeAt;
      if (last && now.getTime() - last.getTime() < 24 * 60 * 60 * 1000) {
        throw new ApiError(429, ErrorCodes.RATE_LIMITED, 'Display name can only be changed once a day.');
      }
      update.displayName = sanitizeText(patch.displayName);
      update.lastDisplayNameChangeAt = now;
    }
    if (patch.jobTitle !== undefined) update.jobTitle = sanitizeText(patch.jobTitle) || null;
    if (patch.bio !== undefined) update.bio = sanitizeText(patch.bio) || null;
    if (patch.pronouns !== undefined) update.pronouns = sanitizeText(patch.pronouns) || null;
    if (patch.timezone !== undefined) update.timezone = patch.timezone;
    if (patch.accentColor !== undefined) update.accentColor = patch.accentColor;
    if (patch.avatarColor !== undefined) update.avatarColor = patch.avatarColor;
    if (patch.phone !== undefined) update.phone = sanitizeText(patch.phone) || null;
    if (patch.profileVisibility !== undefined) update.profileVisibility = patch.profileVisibility;

    if (patch.username !== undefined) {
      const now = new Date();
      const last = existing.lastUsernameChangeAt;
      if (last && now.getTime() - last.getTime() < 14 * 24 * 60 * 60 * 1000) {
        throw new ApiError(429, ErrorCodes.RATE_LIMITED, 'Username can only be changed once every 14 days.');
      }
      const u = (patch.username ?? '').toLowerCase().trim();
      if (u.length > 0) {
        if (!/^[a-z0-9_.]{3,24}$/.test(u)) {
          throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, 'Invalid username format.');
        }
        const taken = await userRepository.findByUsername(u);
        if (taken && taken._id.toString() !== userId.toString()) {
          throw new ApiError(409, ErrorCodes.USERNAME_TAKEN, 'That username is already taken.');
        }
      }
      update.username = u.length > 0 ? u : null;
      update.lastUsernameChangeAt = now;
    }

    await userRepository.updateProfile(userId.toString(), update as any);
    const updated = await userRepository.findById(userId.toString());
    if (!updated) throw new ApiError(404, ErrorCodes.USER_NOT_FOUND, 'Account not found');
    return toProfile(updated);
  },

  /**
   * Visibility-filtered profile for a collaborator. Returns 404 when the viewer
   * does not share a board with the target (or is not the target).
   */
  async getPublicProfile(viewerId: Types.ObjectId, targetId: Types.ObjectId, boardId?: string) {
    const target = await userRepository.findById(targetId.toString());
    if (!target) throw new ApiError(404, ErrorCodes.USER_NOT_FOUND, 'Profile not found');

    const isSelf = viewerId.toString() === targetId.toString();
    if (!isSelf) {
      const shared = await sharesBoard(viewerId, targetId, boardId);
      if (!shared) throw new ApiError(404, ErrorCodes.USER_NOT_FOUND, 'Profile not found');
    }

    const visibility = target.profileVisibility ?? {};
    const showEmail = isSelf || visibility.email === 'boards';
    const showPhone = isSelf || visibility.phone === 'boards';
    const showOthers = isSelf || visibility.others !== 'me';

    return {
      id: target._id.toString(),
      displayName: target.displayName || `${target.firstName} ${target.lastName}`.trim(),
      username: target.username ?? null,
      avatarUrl: target.avatarUrl ?? null,
      avatarColor: target.avatarColor ?? null,
      accentColor: target.accentColor ?? null,
      jobTitle: showOthers ? (target.jobTitle ?? null) : null,
      bio: showOthers ? (target.bio ?? null) : null,
      pronouns: showOthers ? (target.pronouns ?? null) : null,
      timezone: showOthers ? (target.timezone ?? null) : null,
      email: showEmail ? target.email : null,
      phone: showPhone ? (target.phone ?? null) : null,
      createdAt: target.createdAt,
    };
  }
};