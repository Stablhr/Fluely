import mongoose, {Schema} from 'mongoose';
import {BaseUserDocument, createBaseUserSchema} from './base/BaseUser.schema';
import {BoardVisibilities, BoardVisibility} from '../constants/product';

/** Per-channel switches for the notification events a person can silence. */
export interface NotificationChannelPreferences {
  /** Someone @mentioned me in a card comment. */
  mentions: boolean;
  /** Someone accepted or declined a board invitation I sent. */
  invitationResponses: boolean;
}

/**
 * Account-level settings. Every field has a schema default, so documents that
 * predate the subdocument read back fully populated without a migration (the
 * account service also fills defaults defensively, see `resolvePreferences`).
 *
 * Board invitations are deliberately not switchable: the invitee has to
 * receive them to be able to accept.
 */
export interface UserPreferences {
  notifications: {
    inApp: NotificationChannelPreferences;
    email: NotificationChannelPreferences;
  };
  /** Visibility pre-selected when the person creates a board. */
  defaultBoardVisibility: BoardVisibility;
}

export interface UserDocument extends BaseUserDocument {
  preferences?: UserPreferences;
}

const channelPreferencesSchema = new Schema<NotificationChannelPreferences>(
  {
    mentions: {type: Boolean, default: true},
    invitationResponses: {type: Boolean, default: true}
  },
  {_id: false}
);

const notificationPreferencesSchema = new Schema<UserPreferences['notifications']>(
  {
    inApp: {type: channelPreferencesSchema, default: () => ({})},
    email: {type: channelPreferencesSchema, default: () => ({})}
  },
  {_id: false}
);

const preferencesSchema = new Schema<UserPreferences>(
  {
    notifications: {type: notificationPreferencesSchema, default: () => ({})},
    defaultBoardVisibility: {type: String, enum: BoardVisibilities, default: 'private'}
  },
  {_id: false}
);

const UserSchema = createBaseUserSchema<UserDocument>();
UserSchema.add({preferences: {type: preferencesSchema, default: () => ({})}});

export const UserModel = mongoose.model<UserDocument>(
  'User',
  UserSchema,
  'users'
);
