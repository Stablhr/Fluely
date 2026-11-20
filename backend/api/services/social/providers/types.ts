import {SchedulablePlatform} from '../../../constants/social';
import {PostMedia} from '../../../models/SocialPost.model';

/** Tokens as a platform returns them, before encryption. */
export interface TokenSet {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  scopes: string[];
}

/** One account a sign-in grants access to; a Meta sign-in can grant several Pages. */
export interface ConnectedAccount {
  platformAccountId: string;
  accountType: string;
  accountName: string;
  accountUsername?: string;
  profileImageUrl?: string;
  token: TokenSet;
}

export interface PublishContent {
  title: string;
  /** Caption with hashtags already appended. */
  text: string;
  hashtags: string[];
  media: PostMedia[];
  visibility: 'public' | 'private' | 'friends' | 'unlisted';
  altText?: string;
  link?: string;
}

export interface PublishInput {
  account: {platformAccountId: string; accountType: string; accessToken: string};
  content: PublishContent;
}

export interface PublishResult {
  externalPostId: string;
  publishedUrl?: string;
}

/**
 * A failure talking to a platform. `retryable` decides whether the job is
 * tried again (rate limits, outages) or failed for good (bad content, a
 * revoked token). `authFailed` additionally marks the account as needing a
 * reconnect.
 */
export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean,
    public readonly authFailed = false
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export interface SocialProvider {
  platform: SchedulablePlatform;
  /** Whether the client id and secret for this platform are set. */
  isConfigured(): boolean;
  authorizeUrl(state: string, redirectUri: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<ConnectedAccount[]>;
  /** Present for platforms whose tokens can be refreshed. */
  refresh?(refreshToken: string): Promise<TokenSet>;
  publish(input: PublishInput): Promise<PublishResult>;
}
