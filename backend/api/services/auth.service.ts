import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import {env} from '../config/env';
import {userRepository} from '../repositories/user.repository';
import {adminRepository} from '../repositories/admin.repository';
import {ApiError} from '../utils/error';
import {emailService} from './email.service';
import {blocklistService} from './blocklist.service';
import {ErrorCodes} from '../constants/errorCodes';
import {verificationCodeEmailTemplate} from '../templates/verificationCodeEmail';
import {resetPasswordEmailTemplate} from '../templates/resetPasswordEmail';
import {workspaceService} from './workspace.service';
import {logger} from '../logging/logger';

function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getVerificationExpiry(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

type RefreshTokenPayload = {
  userId: string;
  type: 'user' | 'admin';
};

/**
 * The public shape of an account. Both the user and the admin model extend
 * BaseUser, so one shape covers either collection and the client never has to
 * know which one it was handed.
 */
export type PublicAccount = {
  id: string;
  email: string;
  type: 'user' | 'admin';
  firstName: string;
  lastName: string;
  username?: string;
  workspaceId: string | null;
};

/**
 * Look up the signed-in account and reduce it to PublicAccount.
 *
 * The access token only carries an id and a type, so GET /auth/me has to hit
 * the database to say anything about the person: the app renders their name in
 * the sidebar and the top bar, and the token cannot supply that. Password hash
 * and the verification and reset codes never leave this function.
 */
export function toPublicAccount(
  account: {
    _id: unknown;
    email: string;
    firstName: string;
    lastName: string;
    username?: string;
    workspaceId?: unknown;
  },
  type: 'user' | 'admin'
): PublicAccount {
  return {
    id: String(account._id),
    email: account.email,
    type,
    firstName: account.firstName,
    lastName: account.lastName,
    username: account.username,
    workspaceId: account.workspaceId ? String(account.workspaceId) : null
  };
}

async function findAccountById(
  userId: string,
  type: 'user' | 'admin'
) {
  return type === 'user'
    ? userRepository.findById(userId)
    : adminRepository.findById(userId);
}

export const authService = {
  async register(data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    username: string;
  }) {
    const [existingEmail] = await Promise.all([
      userRepository.findByEmail(data.email)
    ]);

    if (existingEmail) {
          throw new ApiError(409, ErrorCodes.EMAIL_EXISTS, 'Email already exists');
    }

    try {
      const passwordHash = await bcrypt.hash(data.password, 10);
      const verificationCode = generateVerificationCode();
      const verificationExpiry = getVerificationExpiry(10);

      const user = await userRepository.create({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        passwordHash,
        username: data.username,
        verificationCode,
        verificationExpiry,
        isVerified: false
      });

      const emailTpl = verificationCodeEmailTemplate({
        code: verificationCode,
        expiresMinutes: 10,
        recipientName: data.firstName
      });

      await emailService.sendEmail({
        to: data.email,
        subject: emailTpl.subject,
        text: emailTpl.text,
        html: emailTpl.html
      });

      // Every new account gets a workspace of its own so that
      // `visibility: 'workspace'` means something from the first board. This
      // must not fail registration: without a workspace the person simply
      // cannot use workspace visibility until they create or join one.
      try {
        await workspaceService.provisionForUser(user._id, data.firstName);
      } catch (provisionError) {
        logger.error(
          {err: provisionError, userId: String(user._id)},
          'Could not provision a workspace for the new account'
        );
      }

      return {id: user.id, email: user.email};
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        'code' in err &&
        (err as {code: number}).code === 11000
      ) {
        const keyValue = (err as {keyValue?: Record<string, string>}).keyValue;

        if (keyValue?.username) {
          throw new ApiError(409, ErrorCodes.USERNAME_EXISTS, 'username already exists');
        }

        if (keyValue?.email) {
      throw new ApiError(409, ErrorCodes.EMAIL_EXISTS, 'Email already exists');

        }

        throw new ApiError(409, ErrorCodes.ACCOUNT_EXISTS, 'Account already exists');
      }

      throw err;
    }
  },

  async verify(email: string, code: string) {
    const user = await userRepository.findByEmail(email);

    if (!user || !user.verificationCode || !user.verificationExpiry) {
      throw new ApiError(400, ErrorCodes.INVALID_CODE, 'Invalid verification code');
    }

    const codeMatches = user.verificationCode === code;
    const notExpired = user.verificationExpiry > new Date();

    if (!codeMatches || !notExpired) {
      throw new ApiError(
        400,
        ErrorCodes.EXPIRED_CODE,
        'Verification code expired or invalid'
      );
    }

    await userRepository.markVerified(email);
  },

  async resendVerification(email: string) {
    const user = await userRepository.findByEmail(email);
    if (!user || user.isVerified) {
      return;
    }

    const verificationCode = generateVerificationCode();
    const verificationExpiry = getVerificationExpiry(10);

    await userRepository.setVerificationCode(
      email,
      verificationCode,
      verificationExpiry
    );

    const emailTpl = verificationCodeEmailTemplate({
      code: verificationCode,
      expiresMinutes: 10,
      recipientName: user.firstName
    });

    await emailService.sendEmail({
      to: email,
      subject: emailTpl.subject,
      text: emailTpl.text,
      html: emailTpl.html
    });
  },

  async sendResetPasswordCodeEmail(params: {
    email: string;
    code: string;
    recipientName?: string;
  }) {
    const emailTpl = resetPasswordEmailTemplate({
      code: params.code,
      expiresMinutes: 10,
      recipientName: params.recipientName
    });

    await emailService.sendEmail({
      to: params.email,
      subject: emailTpl.subject,
      text: emailTpl.text,
      html: emailTpl.html
    });
  },

  async forgotPassword(email: string) {
    const user = await userRepository.findByEmail(email);

    if (!user || !user.isVerified) return;

    const resetCode = generateVerificationCode();
    const resetExpiry = getVerificationExpiry(10);

    await userRepository.setResetCode(email, resetCode, resetExpiry);

    await authService.sendResetPasswordCodeEmail({
      email,
      code: resetCode,
      recipientName: user.firstName
    });
  },

  async verifyResetCode(email: string, code: string) {
    const user = await userRepository.findByEmail(email);

    if (!user || !user.resetCode || !user.resetExpiry) {
      throw new ApiError(400, ErrorCodes.INVALID_CODE, 'Invalid or expired reset code');
    }

    const codeMatches = user.resetCode === code;
    const notExpired = user.resetExpiry > new Date();

    if (!codeMatches || !notExpired) {
      throw new ApiError(400, ErrorCodes.EXPIRED_CODE, 'Reset code expired or invalid');
    }
  },

  async resetPassword(email: string, code: string, newPassword: string) {
    const user = await userRepository.findByEmail(email);

    if (!user || !user.resetCode || !user.resetExpiry) {
      throw new ApiError(400, ErrorCodes.INVALID_CODE, 'Invalid or expired reset code');
    }

    const codeMatches = user.resetCode === code;
    const notExpired = user.resetExpiry > new Date();

    if (!codeMatches || !notExpired) {
      throw new ApiError(400, ErrorCodes.EXPIRED_CODE, 'Reset code expired or invalid');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await userRepository.updatePassword(user.id, passwordHash);
    await userRepository.clearResetCode(email);
  },

  async changePassword(
    userId: string,
    type: 'user' | 'admin',
    currentPassword: string,
    newPassword: string
  ) {
    const repository = type === 'user' ? userRepository : adminRepository;
    const account = await repository.findById(userId);

    if (!account) {
      throw new ApiError(404, ErrorCodes.USER_NOT_FOUND, 'User not found');
    }

    const matches = await bcrypt.compare(currentPassword, account.passwordHash);
    if (!matches) {
      throw new ApiError(
        401,
        ErrorCodes.INVALID_CREDENTIALS,
        'Current password is incorrect'
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await repository.updatePassword(userId, passwordHash);
  },

  async login(email: string, password: string) {
    const identifier = email;
    const [user, admin] = await Promise.all([
      userRepository.findByEmail(identifier),
      adminRepository.findByEmailOrUsername(identifier)
    ]);

    const account = user || admin;
    const userType: 'user' | 'admin' | null = user ? 'user' : admin ? 'admin' : null;

    if (!account || !userType) {
      throw new ApiError(
        401,
        ErrorCodes.INVALID_CREDENTIALS,
        'Invalid email or password'
      );
    }

    if (!account.isVerified) {
      throw new ApiError(403, ErrorCodes.NOT_VERIFIED, 'Email not verified');
    }

    const match = await bcrypt.compare(password, account.passwordHash);
    if (!match) {
      throw new ApiError(
        401,
        ErrorCodes.INVALID_CREDENTIALS,
        'Invalid email or password'
      );
    }

    const accessToken: string = jwt.sign(
      {userId: account.id, type: userType},
      env.JWT_SECRET,
      {expiresIn: '15m'}
    );

    const refreshToken = jwt.sign(
      {userId: account.id, type: userType},
      env.JWT_REFRESH_SECRET,
      {expiresIn: '7d'}
    );

    return {accessToken, refreshToken, user: account, userType};
  },

  /**
   * The signed-in account, for GET /auth/me. The JWT only carries an id and a
   * type, so the name has to come from the database.
   */
  async getAccount(userId: string, type: 'user' | 'admin'): Promise<PublicAccount> {
    const account = await findAccountById(userId, type);

    if (!account) {
      throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Invalid token');
    }

    return toPublicAccount(account, type);
  },

  async refreshAccessToken(refreshToken: string) {
    try {
      if (blocklistService.isRevoked(refreshToken)) {
        throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Token revoked');
      }

      const payload = jwt.verify(
        refreshToken,
        env.JWT_REFRESH_SECRET
      ) as RefreshTokenPayload;

      const account = await findAccountById(payload.userId, payload.type);

      if (!account) {
        throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Invalid token');
      }

      if (!account.isVerified) {
        throw new ApiError(403, ErrorCodes.NOT_VERIFIED, 'Email not verified');
      }

      blocklistService.revoke(refreshToken);

      const accessToken = jwt.sign(
        {userId: account.id, type: payload.type},
        env.JWT_SECRET,
        {expiresIn: '15m'}
      );

      const newRefreshToken = jwt.sign(
        {userId: account.id, type: payload.type},
        env.JWT_REFRESH_SECRET,
        {expiresIn: '7d'}
      );

      return {accessToken, refreshToken: newRefreshToken};
    } catch {
      throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Invalid token');
    }
  },

  logout(refreshToken: string) {
    blocklistService.revoke(refreshToken);
  }
};
