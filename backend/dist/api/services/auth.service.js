"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = void 0;
exports.toPublicAccount = toPublicAccount;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const user_repository_1 = require("../repositories/user.repository");
const admin_repository_1 = require("../repositories/admin.repository");
const error_1 = require("../utils/error");
const email_service_1 = require("./email.service");
const blocklist_service_1 = require("./blocklist.service");
const errorCodes_1 = require("../constants/errorCodes");
const verificationCodeEmail_1 = require("../templates/verificationCodeEmail");
const resetPasswordEmail_1 = require("../templates/resetPasswordEmail");
const workspace_service_1 = require("./workspace.service");
const logger_1 = require("../logging/logger");
function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
function getVerificationExpiry(minutes) {
    return new Date(Date.now() + minutes * 60 * 1000);
}
/**
 * Look up the signed-in account and reduce it to PublicAccount.
 *
 * The access token only carries an id and a type, so GET /auth/me has to hit
 * the database to say anything about the person: the app renders their name in
 * the sidebar and the top bar, and the token cannot supply that. Password hash
 * and the verification and reset codes never leave this function.
 */
function toPublicAccount(account, type) {
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
async function findAccountById(userId, type) {
    return type === 'user'
        ? user_repository_1.userRepository.findById(userId)
        : admin_repository_1.adminRepository.findById(userId);
}
exports.authService = {
    async register(data) {
        const [existingEmail] = await Promise.all([
            user_repository_1.userRepository.findByEmail(data.email)
        ]);
        if (existingEmail) {
            throw new error_1.ApiError(409, errorCodes_1.ErrorCodes.EMAIL_EXISTS, 'Email already exists');
        }
        try {
            const passwordHash = await bcrypt_1.default.hash(data.password, 10);
            const verificationCode = generateVerificationCode();
            const verificationExpiry = getVerificationExpiry(10);
            const user = await user_repository_1.userRepository.create({
                firstName: data.firstName,
                lastName: data.lastName,
                email: data.email,
                passwordHash,
                username: data.username,
                verificationCode,
                verificationExpiry,
                isVerified: false
            });
            const emailTpl = (0, verificationCodeEmail_1.verificationCodeEmailTemplate)({
                code: verificationCode,
                expiresMinutes: 10,
                recipientName: data.firstName
            });
            await email_service_1.emailService.sendEmail({
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
                await workspace_service_1.workspaceService.provisionForUser(user._id, data.firstName);
            }
            catch (provisionError) {
                logger_1.logger.error({ err: provisionError, userId: String(user._id) }, 'Could not provision a workspace for the new account');
            }
            return { id: user.id, email: user.email };
        }
        catch (err) {
            if (err instanceof Error &&
                'code' in err &&
                err.code === 11000) {
                const keyValue = err.keyValue;
                if (keyValue?.username) {
                    throw new error_1.ApiError(409, errorCodes_1.ErrorCodes.USERNAME_EXISTS, 'username already exists');
                }
                if (keyValue?.email) {
                    throw new error_1.ApiError(409, errorCodes_1.ErrorCodes.EMAIL_EXISTS, 'Email already exists');
                }
                throw new error_1.ApiError(409, errorCodes_1.ErrorCodes.ACCOUNT_EXISTS, 'Account already exists');
            }
            throw err;
        }
    },
    async verify(email, code) {
        const user = await user_repository_1.userRepository.findByEmail(email);
        if (!user || !user.verificationCode || !user.verificationExpiry) {
            throw new error_1.ApiError(400, errorCodes_1.ErrorCodes.INVALID_CODE, 'Invalid verification code');
        }
        const codeMatches = user.verificationCode === code;
        const notExpired = user.verificationExpiry > new Date();
        if (!codeMatches || !notExpired) {
            throw new error_1.ApiError(400, errorCodes_1.ErrorCodes.EXPIRED_CODE, 'Verification code expired or invalid');
        }
        await user_repository_1.userRepository.markVerified(email);
    },
    async resendVerification(email) {
        const user = await user_repository_1.userRepository.findByEmail(email);
        if (!user || user.isVerified) {
            return;
        }
        const verificationCode = generateVerificationCode();
        const verificationExpiry = getVerificationExpiry(10);
        await user_repository_1.userRepository.setVerificationCode(email, verificationCode, verificationExpiry);
        const emailTpl = (0, verificationCodeEmail_1.verificationCodeEmailTemplate)({
            code: verificationCode,
            expiresMinutes: 10,
            recipientName: user.firstName
        });
        await email_service_1.emailService.sendEmail({
            to: email,
            subject: emailTpl.subject,
            text: emailTpl.text,
            html: emailTpl.html
        });
    },
    async sendResetPasswordCodeEmail(params) {
        const emailTpl = (0, resetPasswordEmail_1.resetPasswordEmailTemplate)({
            code: params.code,
            expiresMinutes: 10,
            recipientName: params.recipientName
        });
        await email_service_1.emailService.sendEmail({
            to: params.email,
            subject: emailTpl.subject,
            text: emailTpl.text,
            html: emailTpl.html
        });
    },
    async forgotPassword(email) {
        const user = await user_repository_1.userRepository.findByEmail(email);
        if (!user || !user.isVerified)
            return;
        const resetCode = generateVerificationCode();
        const resetExpiry = getVerificationExpiry(10);
        await user_repository_1.userRepository.setResetCode(email, resetCode, resetExpiry);
        await exports.authService.sendResetPasswordCodeEmail({
            email,
            code: resetCode,
            recipientName: user.firstName
        });
    },
    async verifyResetCode(email, code) {
        const user = await user_repository_1.userRepository.findByEmail(email);
        if (!user || !user.resetCode || !user.resetExpiry) {
            throw new error_1.ApiError(400, errorCodes_1.ErrorCodes.INVALID_CODE, 'Invalid or expired reset code');
        }
        const codeMatches = user.resetCode === code;
        const notExpired = user.resetExpiry > new Date();
        if (!codeMatches || !notExpired) {
            throw new error_1.ApiError(400, errorCodes_1.ErrorCodes.EXPIRED_CODE, 'Reset code expired or invalid');
        }
    },
    async resetPassword(email, code, newPassword) {
        const user = await user_repository_1.userRepository.findByEmail(email);
        if (!user || !user.resetCode || !user.resetExpiry) {
            throw new error_1.ApiError(400, errorCodes_1.ErrorCodes.INVALID_CODE, 'Invalid or expired reset code');
        }
        const codeMatches = user.resetCode === code;
        const notExpired = user.resetExpiry > new Date();
        if (!codeMatches || !notExpired) {
            throw new error_1.ApiError(400, errorCodes_1.ErrorCodes.EXPIRED_CODE, 'Reset code expired or invalid');
        }
        const passwordHash = await bcrypt_1.default.hash(newPassword, 10);
        await user_repository_1.userRepository.updatePassword(user.id, passwordHash);
        await user_repository_1.userRepository.clearResetCode(email);
    },
    async changePassword(userId, type, currentPassword, newPassword) {
        const repository = type === 'user' ? user_repository_1.userRepository : admin_repository_1.adminRepository;
        const account = await repository.findById(userId);
        if (!account) {
            throw new error_1.ApiError(404, errorCodes_1.ErrorCodes.USER_NOT_FOUND, 'User not found');
        }
        const matches = await bcrypt_1.default.compare(currentPassword, account.passwordHash);
        if (!matches) {
            throw new error_1.ApiError(401, errorCodes_1.ErrorCodes.INVALID_CREDENTIALS, 'Current password is incorrect');
        }
        const passwordHash = await bcrypt_1.default.hash(newPassword, 10);
        await repository.updatePassword(userId, passwordHash);
    },
    async login(email, password) {
        const identifier = email;
        const [user, admin] = await Promise.all([
            user_repository_1.userRepository.findByEmail(identifier),
            admin_repository_1.adminRepository.findByEmailOrUsername(identifier)
        ]);
        const account = user || admin;
        const userType = user ? 'user' : admin ? 'admin' : null;
        if (!account || !userType) {
            throw new error_1.ApiError(401, errorCodes_1.ErrorCodes.INVALID_CREDENTIALS, 'Invalid email or password');
        }
        if (!account.isVerified) {
            throw new error_1.ApiError(403, errorCodes_1.ErrorCodes.NOT_VERIFIED, 'Email not verified');
        }
        const match = await bcrypt_1.default.compare(password, account.passwordHash);
        if (!match) {
            throw new error_1.ApiError(401, errorCodes_1.ErrorCodes.INVALID_CREDENTIALS, 'Invalid email or password');
        }
        const accessToken = jsonwebtoken_1.default.sign({ userId: account.id, type: userType }, env_1.env.JWT_SECRET, { expiresIn: '15m' });
        const refreshToken = jsonwebtoken_1.default.sign({ userId: account.id, type: userType }, env_1.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
        return { accessToken, refreshToken, user: account, userType };
    },
    /**
     * The signed-in account, for GET /auth/me. The JWT only carries an id and a
     * type, so the name has to come from the database.
     */
    async getAccount(userId, type) {
        const account = await findAccountById(userId, type);
        if (!account) {
            throw new error_1.ApiError(401, errorCodes_1.ErrorCodes.UNAUTHORIZED, 'Invalid token');
        }
        return toPublicAccount(account, type);
    },
    async refreshAccessToken(refreshToken) {
        try {
            if (blocklist_service_1.blocklistService.isRevoked(refreshToken)) {
                throw new error_1.ApiError(401, errorCodes_1.ErrorCodes.UNAUTHORIZED, 'Token revoked');
            }
            const payload = jsonwebtoken_1.default.verify(refreshToken, env_1.env.JWT_REFRESH_SECRET);
            const account = await findAccountById(payload.userId, payload.type);
            if (!account) {
                throw new error_1.ApiError(401, errorCodes_1.ErrorCodes.UNAUTHORIZED, 'Invalid token');
            }
            if (!account.isVerified) {
                throw new error_1.ApiError(403, errorCodes_1.ErrorCodes.NOT_VERIFIED, 'Email not verified');
            }
            blocklist_service_1.blocklistService.revoke(refreshToken);
            const accessToken = jsonwebtoken_1.default.sign({ userId: account.id, type: payload.type }, env_1.env.JWT_SECRET, { expiresIn: '15m' });
            const newRefreshToken = jsonwebtoken_1.default.sign({ userId: account.id, type: payload.type }, env_1.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
            return { accessToken, refreshToken: newRefreshToken };
        }
        catch {
            throw new error_1.ApiError(401, errorCodes_1.ErrorCodes.UNAUTHORIZED, 'Invalid token');
        }
    },
    logout(refreshToken) {
        blocklist_service_1.blocklistService.revoke(refreshToken);
    }
};
