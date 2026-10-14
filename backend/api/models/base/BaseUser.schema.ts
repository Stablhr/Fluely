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