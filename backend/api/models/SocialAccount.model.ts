import mongoose, {Schema, Types} from 'mongoose';
import {
  SchedulablePlatform,
  SchedulablePlatforms,
  SocialAccountStatus,
  SocialAccountStatuses
} from '../constants/social';

/**
 * A connected social account (a LinkedIn profile or Company Page, a Facebook
 * Page, an Instagram business account, a TikTok creator, a YouTube channel).
 *
 * Shared per workspace: anyone in the workspace can schedule to it. Tokens are
 * stored encrypted (`utils/tokenCrypto.ts`) and never leave the server.
 */
export interface SocialAccountDocument extends mongoose.Document {
  workspaceId: Types.ObjectId;
  platform: SchedulablePlatform;
  /** The platform's own id: person/organization URN, Page id, IG user id, open_id, channel id. */
  platformAccountId: string;
  /** `profile`, `organization`, `page`, `business`, `creator`, `channel`. */
  accountType: string;
  accountName: string;
  accountUsername?: string;
  profileImageUrl?: string;
  accessTokenEnc: string;
  refreshTokenEnc?: string | null;
  tokenExpiresAt?: Date | null;
  scopes: string[];
  status: SocialAccountStatus;
  /** Created without a real sign-in, because the platform has no credentials yet. */
  demo: boolean;
  lastError?: string | null;
  connectedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SocialAccountSchema = new Schema<SocialAccountDocument>(
  {
    workspaceId: {type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true},
    platform: {type: String, enum: SchedulablePlatforms, required: true},
    platformAccountId: {type: String, required: true},
    accountType: {type: String, required: true, default: 'profile'},
    accountName: {type: String, required: true, maxlength: 200},
    accountUsername: {type: String, maxlength: 200},
    profileImageUrl: {type: String, maxlength: 2000},
    accessTokenEnc: {type: String, required: true},
    refreshTokenEnc: {type: String, default: null},
    tokenExpiresAt: {type: Date, default: null},
    scopes: {type: [String], default: []},
    status: {type: String, enum: SocialAccountStatuses, default: 'active'},
    demo: {type: Boolean, default: false},
    lastError: {type: String, default: null},
    connectedBy: {type: Schema.Types.ObjectId, ref: 'User', required: true}
  },
  {timestamps: true}
);

// Reconnecting the same account updates the row instead of duplicating it.
SocialAccountSchema.index({workspaceId: 1, platform: 1, platformAccountId: 1}, {unique: true});

export const SocialAccountModel = mongoose.model<SocialAccountDocument>(
  'SocialAccount',
  SocialAccountSchema,
  'social_accounts'
);
