import mongoose, {Schema, Types} from 'mongoose';

export interface BaseUserDocument extends mongoose.Document {
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  username?: string;
  /** Cloudinary URL of the profile picture. `null` until one is uploaded. */
  avatarUrl?: string | null;
  /**
   * Cloudinary `public_id` for the profile picture.
   *
   * Kept beside the URL so a replaced or removed avatar can be destroyed
   * instead of being orphaned in the media library. Server-side only -- it is
   * never included in `PublicAccount`.
   */
  avatarPublicId?: string | null;
  /** Initials avatar background color (hex). */
  avatarColor?: string | null;
  /** Display name shown across the app. Defaults to first + last name. */
  displayName?: string | null;
  /** Job title / role, e.g. "Social Media Manager". */
  jobTitle?: string | null;
  /** Short bio, max 160 characters. */
  bio?: string | null;
  /** Pronouns (free text). */
  pronouns?: string | null;
  /** IANA timezone, e.g. "Asia/Manila". */
  timezone?: string | null;
  /** Accent color for the profile card header (brand token or hex). */
  accentColor?: string | null;
  /**
   * Per-field visibility. Keys: email, phone, bio, jobTitle, pronouns, timezone.
   * Values: 'me' (only me) or 'boards' (people on my boards).
   */
  profileVisibility?: Record<string, 'me' | 'boards'> | null;
  /** Optional phone number (private by default). */
  phone?: string | null;
  /** When the username was last changed, for rate limiting. */
  lastUsernameChangeAt?: Date | null;
  /** When the display name was last changed, for rate limiting. */
  lastDisplayNameChangeAt?: Date | null;
  workspaceId?: Types.ObjectId | null;
  isVerified: boolean;
  verificationCode?: string | null;
  verificationExpiry?: Date | null;
  resetCode?: string | null;
  resetExpiry?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function createBaseUserSchema<T extends BaseUserDocument>() {
  const schema = new Schema<T>(
    {
      firstName: {type: String, required: true},
      lastName: {type: String, required: true},
      email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
      },
      passwordHash: {type: String, required: true},
      username: {type: String, unique: true, sparse: true},
      // Profile picture. Stored on Cloudinary; see `services/account.service.ts`.
      avatarUrl: {type: String, default: null},
      avatarPublicId: {type: String, default: null},
      avatarColor: {type: String, default: null},
      displayName: {type: String, default: null},
      jobTitle: {type: String, default: null},
      bio: {type: String, default: null},
      pronouns: {type: String, default: null},
      timezone: {type: String, default: null},
      accentColor: {type: String, default: null},
      phone: {type: String, default: null},
      profileVisibility: {type: Schema.Types.Mixed, default: null},
      lastUsernameChangeAt: {type: Date, default: null},
      lastDisplayNameChangeAt: {type: Date, default: null},
      // Primary workspace. Membership itself lives in the WorkspaceMember
      // collection, which is the source of truth; this field is denormalised
      // for convenience so the UI can resolve a default without a join.
      workspaceId: {type: Schema.Types.ObjectId, ref: 'Workspace', default: null, index: true},
      isVerified: {type: Boolean, default: false},
      verificationCode: {type: String, default: null},
      verificationExpiry: {type: Date, default: null},
      resetCode: {type: String, default: null},
      resetExpiry: {type: Date, default: null}
    },
    {timestamps: true}
  );

  return schema;
}