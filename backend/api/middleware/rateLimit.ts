import rateLimit from 'express-rate-limit';
import type {Request, RequestHandler} from 'express';

const enabled = process.env.RATE_LIMIT_ENABLED !== 'false';
const noop: RequestHandler = (_req, _res, next) => next();

function makeLimiter(opts: Parameters<typeof rateLimit>[0]): RequestHandler {
  return enabled ? (rateLimit(opts) as RequestHandler) : noop;
}

const rateLimitHandler: RequestHandler = (_req, res) => {
  res.status(429).json({
    success: false,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests. Please try again later.'
  });
};

/**
 * Keys a limiter by the signed-in account when there is one, and by IP address
 * otherwise.
 *
 * Keying on the IP alone made every account behind one address share a single
 * budget. Two people on the same office network -- or, in development, two
 * browsers on `localhost` -- would consume each other's quota. It also let the
 * background pollers drain the allocation a person's own clicks draw from.
 *
 * The limiter runs after `requireAuth` on every protected route, so the account
 * id is available there; public routes (and `/auth/me`, which mounts the
 * limiter before its guard) fall back to the address.
 */
function accountOrIp(req: Request): string {
  const userId = req.auth?.userId;
  return userId ? `user:${userId}` : `ip:${req.ip ?? 'unknown'}`;
}

/**
 * Sensitive pre-auth writes (register, verify, login, password reset). Keyed by
 * address because no account exists yet, and left strict for brute-force.
 */
export const authLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler
});

/**
 * Authenticated writes: board/list/card edits, workspace membership, avatar
 * removal, token refresh. Sized for an editing session -- a card drag is one
 * write -- while still capping a runaway client.
 */
export const authActionLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 120,
  keyGenerator: accountOrIp,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler
});

/**
 * Human-paced reads: board lists and structure, activity, media, collaborators.
 * The board page issues one of these each time a remote change is detected, so
 * the ceiling has to sit well above interactive traffic.
 */
export const authReadLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 600,
  keyGenerator: accountOrIp,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler
});

/**
 * Background polling reads -- the notification bell and pending invitations.
 * They fire every few seconds on their own, so they get a per-minute allowance
 * instead of spending the human-paced budget above. Sized for several visible
 * tabs on one account.
 */
export const backgroundReadLimiter = makeLimiter({
  windowMs: 60 * 1000,
  max: 120,
  keyGenerator: accountOrIp,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler
});

export const uploadLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: accountOrIp,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler
});

export const defaultLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  keyGenerator: accountOrIp,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler
});

/**
 * The live board poll: one request every few seconds per open board. Kept
 * per-minute and separate from the read budget so a busy board cannot rate-limit
 * the structure re-pull it needs to converge.
 */
export const pollLimiter = makeLimiter({
  windowMs: 60 * 1000,
  max: 120,
  keyGenerator: accountOrIp,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler
});
