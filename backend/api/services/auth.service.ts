import bcrypt from 'bcrypt';
import {randomInt} from 'crypto';
import jwt from 'jsonwebtoken';
import {env} from '../config/env';
import {ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS} from '../config/session';
import {userRepository} from '../repositories/user.repository';
import {adminRepository} from '../repositories/admin.repository';
import {ApiError} from '../utils/error';
import {emailService} from './email.service';
import {blocklistService} from './blocklist.service';
import {ErrorCodes} from '../constants/errorCodes';
import {constantTimeEqual, createSecureToken} from '../utils/crypto';
import {verificationCodeEmailTemplate} from '../templates/verificationCodeEmail';
import {resetPasswordEmailTemplate} from '../templates/resetPasswordEmail';
import {workspaceService} from './workspace.service';
import {logger} from '../logging/logger';

function generateVerificationCode() {
  return randomInt(100000, 1000000).toString();
}

/** Wrong guesses allowed per code before it stops working and a new one is needed. */
const MAX_CODE_ATTEMPTS = 5;

const CODE_ERRORS = {
  verification: {missing: 'Invalid verification code', wrong: 'Verification code expired or invalid'},
  reset: {missing: 'Invalid or expired reset code', wrong: 'Reset code expired or invalid'}
};

/** Checks an emailed code, spending one of its few guesses unless it is right. */
async function checkCode(email: string, code: string, kind: 'verification' | 'reset') {
  const user = await userRepository.useCodeAttempt(email, kind, MAX_CODE_ATTEMPTS);
  const stored = kind === 'reset' ? user?.resetCode : user?.verificationCode;
  const expiry = kind === 'reset' ? user?.resetExpiry : user?.verificationExpiry;
  if (!user || !stored || !expiry) {
    throw new ApiError(400, ErrorCodes.INVALID_CODE, CODE_ERRORS[kind].missing);
  }
  if (!constantTimeEqual(stored, code) || expiry <= new Date()) {
    throw new ApiError(400, ErrorCodes.EXPIRED_CODE, CODE_ERRORS[kind].wrong);
  }
  await userRepository.refundCodeAttempt(email, kind);
  return user;
}

function getVerificationExpiry(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

/**
 * A refresh that lost the race for its token. Usually another tab of the same
 * browser won and already stored fresh cookies, so they must not be cleared.
 */
export const REFRESH_TOKEN_REUSED = 'Refresh token already used';

type RefreshTokenPayload = {
  userId: string;
  type: 'user' | 'admin';
  /** The account's `tokenVersion` when the token was issued. */
  tv?: number;
};

function issueTokens(account: {_id: unknown; tokenVersion?: number}, type: 'user' | 'admin') {
  const userId = String(account._id);
  const accessToken: string = jwt.sign({userId, type}, env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL_SECONDS
  });
  const refreshToken = jwt.sign(
    {userId, type, tv: account.tokenVersion ?? 0},
    env.JWT_REFRESH_SECRET,
    // A unique id per token: without it, two tokens issued for the same account
    // in the same second are byte-identical, so revoking one revokes both.
    {expiresIn: REFRESH_TOKEN_TTL_SECONDS, jwtid: createSecureToken(16)}
  );
  return {accessToken, refreshToken};
}

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
  /**
   * Cloudinary URL of the profile picture, or `null` when none is set.
   * `avatarPublicId` is deliberately absent -- the client has no use for it and
   * it should not leave the server.
   */
  avatarUrl: string | null;
  avatarColor?: string | null;
  displayName?: string | null;
  jobTitle?: string | null;
  bio?: string | null;
  pronouns?: string | null;
  timezone?: string | null;
  accentColor?: string | null;
  phone?: string | null;
  profileVisibility?: Record<string, 'me' | 'boards'> | null;
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
    avatarUrl?: string | null;
    avatarColor?: string | null;
    displayName?: string | null;
    jobTitle?: string | null;
    bio?: string | null;
    pronouns?: string | null;
    timezone?: string | null;
    accentColor?: string | null;
    phone?: string | null;
    profileVisibility?: Record<string, 'me' | 'boards'> | null;
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
    await checkCode(email, code, 'verification');
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
    await checkCode(email, code, 'reset');
  },

  async resetPassword(email: string, code: string, newPassword: string) {
    const user = await checkCode(email, code, 'reset');

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
    // Every other session ends; this one continues with fresh tokens.
    return issueTokens({_id: account._id, tokenVersion: (account.tokenVersion ?? 0) + 1}, type);
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

    return {...issueTokens(account, userType), user: account, userType};
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
      const payload = jwt.verify(
        refreshToken,
        env.JWT_REFRESH_SECRET
      ) as RefreshTokenPayload;

      // Revoking is the claim: of two refreshes racing with one token, only one wins.
      if (!(await blocklistService.revoke(refreshToken))) {
        throw new ApiError(401, ErrorCodes.UNAUTHORIZED, REFRESH_TOKEN_REUSED);
      }

      const account = await findAccountById(payload.userId, payload.type);

      if (!account) {
        throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Invalid token');
      }

      // The password changed after this token was issued.
      if ((payload.tv ?? 0) !== (account.tokenVersion ?? 0)) {
        throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Session ended');
      }

      if (!account.isVerified) {
        throw new ApiError(403, ErrorCodes.NOT_VERIFIED, 'Email not verified');
      }

      return issueTokens(account, payload.type);
    } catch (error) {
      if (error instanceof ApiError && error.message === REFRESH_TOKEN_REUSED) throw error;
      throw new ApiError(401, ErrorCodes.UNAUTHORIZED, 'Invalid token');
    }
  },

  async logout(refreshToken: string): Promise<void> {
    await blocklistService.revoke(refreshToken);
  }
};
