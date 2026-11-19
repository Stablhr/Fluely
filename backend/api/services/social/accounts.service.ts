import {CookieOptions} from 'express';
import jwt from 'jsonwebtoken';
import {Types} from 'mongoose';
import {env} from '../../config/env';
import {ErrorCodes} from '../../constants/errorCodes';
import {PLATFORM_LABELS, SchedulablePlatform} from '../../constants/social';
import {logger} from '../../logging/logger';
import {SocialAccountDocument, SocialAccountModel} from '../../models/SocialAccount.model';
import {Actor} from '../../utils/actor';
import {createSecureToken, constantTimeEqual} from '../../utils/crypto';
import {ApiError} from '../../utils/error';
import {decryptToken, encryptToken} from '../../utils/tokenCrypto';
import {getProvider, platformMode, platformSummaries} from './providers/registry';
import {ConnectedAccount, ProviderError} from './providers/types';
import {socialWorkspace} from './workspace';

/**
 * Connected accounts and the OAuth flow that creates them.
 *
 * Connect: the signed-in browser asks for an authorize URL. The `state` sent
 * to the platform is a short-lived signed token naming the person, workspace
 * and platform, and its nonce is also set as an httpOnly cookie, so the
 * callback only completes in the browser that started it (no login CSRF).
 * The callback exchanges the code, stores encrypted tokens and redirects back
 * to the planner with the outcome in the query string.
 */

export const OAUTH_COOKIE = `${env.COOKIE_PREFIX ?? 'dc'}_social_oauth`;
const STATE_AUDIENCE = 'social-oauth';
const STATE_TTL_SECONDS = 10 * 60;

export type ConnectReturn = 'planner' | 'settings';
type StateClaims = {
  u: string;
  w: string;
  p: SchedulablePlatform;
  n: string;
  r?: ConnectReturn;
  /** The app address the sign-in started from (one of CORS_ORIGINS). */
  o?: string;
};

/** The same allow-list `app.ts` gives CORS. */
function allowedOrigins(): string[] {
  return env.CORS_ORIGINS
    ? env.CORS_ORIGINS.split(',').map(o => o.trim().replace(/\/+$/, ''))
    : ['http://localhost:3000', 'https://fluely.vercel.app'];
}

/**
 * The address to send the browser back to: the one the sign-in started from
 * when it is an allowed app address (so a frontend on another port or a
 * preview deployment gets its own page back), else FRONTEND_URL.
 */
export function frontendOrigin(origin: string | undefined): string | undefined {
  const clean = origin?.replace(/\/+$/, '');
  return clean && allowedOrigins().includes(clean) ? clean : undefined;
}

/** Where the browser lands after a sign-in, with the outcome in the query. */
function returnUrl(
  to: ConnectReturn | undefined,
  origin: string | undefined,
  params: Record<string, string>
): string {
  const base = frontendOrigin(origin) ?? env.FRONTEND_URL.replace(/\/+$/, '');
  const path = to === 'settings' ? '/settings?tab=accounts&' : '/content-planner?';
  return `${base}${path}${new URLSearchParams(params)}`;
}

export function oauthCookieOptions(): CookieOptions {
  // The callback is a top-level navigation from the platform's site, which a
  // `strict` cookie would not survive.
  const sameSite = env.COOKIE_SAMESITE === 'none' ? 'none' : 'lax';
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE === 'true' || sameSite === 'none',
    sameSite,
    path: '/api/social-accounts',
    maxAge: STATE_TTL_SECONDS * 1000
  };
}

export function redirectUriFor(platform: SchedulablePlatform): string {
  return `${env.API_PUBLIC_URL}/api/social-accounts/oauth/${platform}/callback`;
}

export function serializeAccount(account: SocialAccountDocument) {
  return {
    _id: account._id.toString(),
    id: account._id.toString(),
    platform: account.platform,
    platformAccountId: account.platformAccountId,
    accountType: account.accountType,
    accountName: account.accountName,
    accountUsername: account.accountUsername,
    profileImageUrl: account.profileImageUrl,
    status: account.status,
    scopes: account.scopes,
    demo: account.demo,
    lastError: account.lastError ?? undefined,
    tokenExpiresAt: account.tokenExpiresAt ?? undefined,
    connectedBy: account.connectedBy.toString(),
    createdAt: account.createdAt,
    updatedAt: account.updatedAt
  };
}

async function saveAccounts(
  workspaceId: Types.ObjectId,
  platform: SchedulablePlatform,
  connectedBy: Types.ObjectId,
  accounts: ConnectedAccount[],
  demo: boolean
) {
  const saved: SocialAccountDocument[] = [];
  for (const account of accounts) {
    const doc = await SocialAccountModel.findOneAndUpdate(
      {workspaceId, platform, platformAccountId: account.platformAccountId},
      {
        $set: {
          accountType: account.accountType,
          accountName: account.accountName.slice(0, 200),
          accountUsername: account.accountUsername,
          profileImageUrl: account.profileImageUrl,
          accessTokenEnc: encryptToken(account.token.accessToken),
          refreshTokenEnc: account.token.refreshToken ? encryptToken(account.token.refreshToken) : null,
          tokenExpiresAt: account.token.expiresAt ?? null,
          scopes: account.token.scopes,
          status: 'active',
          demo,
          lastError: null,
          connectedBy
        }
      },
      {upsert: true, new: true, setDefaultsOnInsert: true}
    ).exec();
    saved.push(doc as SocialAccountDocument);
  }
  return saved;
}

function assertEnabled(platform: SchedulablePlatform) {
  if (platformMode(platform) === 'disabled') {
    throw new ApiError(400, ErrorCodes.PLATFORM_DISABLED, `${PLATFORM_LABELS[platform]} is turned off`);
  }
}

export const socialAccountService = {
  platforms: platformSummaries,

  async list(actor: Actor) {
    const {workspaceId} = await socialWorkspace(actor);
    const rows = await SocialAccountModel.find({workspaceId}).sort({platform: 1, createdAt: 1}).exec();
    return rows.map(serializeAccount);
  },

  /**
   * Starts connecting a real account: returns the platform's sign-in URL.
   * Refuses when the platform's app keys are not set. With `demo`, creates a
   * demo account instead, so scheduling can be tried end to end.
   */
  async startConnect(
    actor: Actor,
    platform: SchedulablePlatform,
    returnTo: ConnectReturn = 'planner',
    demo = false,
    origin?: string
  ) {
    assertEnabled(platform);
    const {workspaceId} = await socialWorkspace(actor);
    const provider = getProvider(platform);

    // A real account needs the platform's app keys on the server. Without
    // them, say so: silently creating a demo account looked like a successful
    // connection to a real one.
    if (!demo && !provider.isConfigured()) {
      throw new ApiError(
        409,
        ErrorCodes.PLATFORM_NOT_CONFIGURED,
        `${PLATFORM_LABELS[platform]} is not set up yet. Add its app keys to the server to connect a real account.`
      );
    }

    if (demo) {
      const [account] = await saveAccounts(
        workspaceId,
        platform,
        actor.actorId,
        [
          {
            platformAccountId: `demo-${platform}-${workspaceId.toString()}`,
            accountType: 'demo',
            accountName: `Demo ${PLATFORM_LABELS[platform]} account`,
            token: {accessToken: 'demo', scopes: []}
          }
        ],
        true
      );
      return {demo: true as const, account: serializeAccount(account)};
    }

    const nonce = createSecureToken(16);
    const claims: StateClaims = {
      u: actor.actorId.toString(),
      w: workspaceId.toString(),
      p: platform,
      n: nonce,
      r: returnTo,
      o: frontendOrigin(origin)
    };
    const state = jwt.sign(claims, env.JWT_SECRET, {audience: STATE_AUDIENCE, expiresIn: STATE_TTL_SECONDS});
    return {
      demo: false as const,
      nonce,
      url: provider.authorizeUrl(state, redirectUriFor(platform))
    };
  },

  /**
   * Finishes connecting and returns where to send the browser. Never throws:
   * every failure becomes an error message on the planner page.
   */
  async finishConnect(
    platform: SchedulablePlatform,
    query: {code?: string; state?: string; error?: string; error_description?: string},
    cookieNonce: string | undefined
  ): Promise<string> {
    // Read where to return before anything can fail; an unreadable state
    // falls back to the planner.
    let claims: StateClaims | null = null;
    try {
      claims = jwt.verify(query.state ?? '', env.JWT_SECRET, {audience: STATE_AUDIENCE}) as StateClaims;
    } catch {
      claims = null;
    }
    const back = (params: Record<string, string>) => returnUrl(claims?.r, claims?.o, {platform, ...params});

    if (query.error) {
      return back({social: 'error', message: query.error_description || 'The sign-in was cancelled'});
    }
    if (!claims) {
      return back({social: 'error', message: 'The sign-in link expired. Try connecting again.'});
    }
    if (claims.p !== platform || !cookieNonce || !constantTimeEqual(cookieNonce, claims.n) || !query.code) {
      return back({social: 'error', message: 'This sign-in was started in another browser. Try again here.'});
    }

    try {
      assertEnabled(platform);
      const accounts = await getProvider(platform).exchangeCode(query.code, redirectUriFor(platform));
      const saved = await saveAccounts(
        new Types.ObjectId(claims.w),
        platform,
        new Types.ObjectId(claims.u),
        accounts,
        false
      );
      return back({social: 'connected', count: String(saved.length)});
    } catch (error) {
      logger.warn({err: error, platform}, 'Social account connection failed');
      const message =
        error instanceof ProviderError || error instanceof ApiError
          ? error.message
          : `Could not connect ${PLATFORM_LABELS[platform]}`;
      return back({social: 'error', message});
    }
  },

  /** The person who connected an account, or the workspace owner, can remove it. */
  async disconnect(actor: Actor, accountId: string) {
    const {workspaceId, isOwner} = await socialWorkspace(actor);
    if (!Types.ObjectId.isValid(accountId)) {
      throw new ApiError(404, ErrorCodes.SOCIAL_ACCOUNT_NOT_FOUND, 'Account not found');
    }
    const account = await SocialAccountModel.findOne({_id: accountId, workspaceId}).exec();
    if (!account) throw new ApiError(404, ErrorCodes.SOCIAL_ACCOUNT_NOT_FOUND, 'Account not found');
    if (!isOwner && !account.connectedBy.equals(actor.actorId)) {
      throw new ApiError(403, ErrorCodes.FORBIDDEN, 'Only the person who connected this account or the workspace owner can remove it');
    }
    await account.deleteOne();
  },

  /**
   * A usable access token, refreshed when it is about to expire. Marks the
   * account `expired` when it cannot be refreshed, so the UI asks for a
   * reconnect.
   */
  async accessToken(account: SocialAccountDocument): Promise<string> {
    const soon = Date.now() + 5 * 60 * 1000;
    const expires = account.tokenExpiresAt?.getTime();
    if (expires === undefined || expires > soon) return decryptToken(account.accessTokenEnc);

    const provider = getProvider(account.platform);
    if (!provider.refresh || !account.refreshTokenEnc) {
      account.status = 'expired';
      account.lastError = 'The sign-in expired. Reconnect the account.';
      await account.save();
      throw new ProviderError(
        `${PLATFORM_LABELS[account.platform]}: the sign-in for ${account.accountName} expired. Reconnect it.`,
        'TOKEN_EXPIRED',
        false,
        true
      );
    }
    const fresh = await provider.refresh(decryptToken(account.refreshTokenEnc));
    account.accessTokenEnc = encryptToken(fresh.accessToken);
    if (fresh.refreshToken) account.refreshTokenEnc = encryptToken(fresh.refreshToken);
    account.tokenExpiresAt = fresh.expiresAt ?? null;
    account.status = 'active';
    account.lastError = null;
    await account.save();
    return fresh.accessToken;
  }
};
