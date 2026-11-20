import {BoardVisibilities, BoardVisibility} from '../constants/product';
import type {NotificationChannelPreferences, UserPreferences} from '../models/User.model';
import type {AccountPreferencesPatchInput} from '../dtos/product.dto';

export const DEFAULT_PREFERENCES: UserPreferences = {
  notifications: {
    inApp: {mentions: true, invitationResponses: true},
    email: {mentions: true, invitationResponses: true}
  },
  defaultBoardVisibility: 'private'
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function channel(value: unknown, fallback: NotificationChannelPreferences): NotificationChannelPreferences {
  const record = asRecord(value);
  return {
    mentions: flag(record.mentions, fallback.mentions),
    invitationResponses: flag(record.invitationResponses, fallback.invitationResponses)
  };
}

/**
 * The stored preferences with every missing leaf filled from the defaults.
 * Mongoose already applies schema defaults when it hydrates a document, but
 * this keeps reads correct for lean rows and for accounts that predate the
 * field, and always returns a plain object (never a subdocument).
 */
export function resolvePreferences(stored: unknown): UserPreferences {
  const record = asRecord(stored);
  const notifications = asRecord(record.notifications);
  const visibility = record.defaultBoardVisibility;
  return {
    notifications: {
      inApp: channel(notifications.inApp, DEFAULT_PREFERENCES.notifications.inApp),
      email: channel(notifications.email, DEFAULT_PREFERENCES.notifications.email)
    },
    defaultBoardVisibility: BoardVisibilities.includes(visibility as BoardVisibility)
      ? (visibility as BoardVisibility)
      : DEFAULT_PREFERENCES.defaultBoardVisibility
  };
}

/**
 * Flattens a validated partial patch into dotted `$set` paths, so only the
 * leaves the caller sent are written and everything else is left as stored.
 */
export function preferencePatchToSetFields(
  patch: AccountPreferencesPatchInput
): Record<string, boolean | BoardVisibility> {
  const fields: Record<string, boolean | BoardVisibility> = {};
  for (const channelName of ['inApp', 'email'] as const) {
    const channelPatch = patch.notifications?.[channelName];
    if (!channelPatch) continue;
    for (const key of ['mentions', 'invitationResponses'] as const) {
      const value = channelPatch[key];
      if (value !== undefined) {
        fields[`preferences.notifications.${channelName}.${key}`] = value;
      }
    }
  }
  if (patch.defaultBoardVisibility !== undefined) {
    fields['preferences.defaultBoardVisibility'] = patch.defaultBoardVisibility;
  }
  return fields;
}
