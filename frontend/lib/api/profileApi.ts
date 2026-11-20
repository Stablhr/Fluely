import { httpClient } from "./httpClient";

export type ProfileVisibility = Record<string, "me" | "boards">;

export type BoardVisibilityPreference = "private" | "workspace" | "public";

export type NotificationChannelPreferences = {
  mentions: boolean;
  invitationResponses: boolean;
};

export type AccountPreferences = {
  notifications: {
    inApp: NotificationChannelPreferences;
    email: NotificationChannelPreferences;
  };
  defaultBoardVisibility: BoardVisibilityPreference;
};

/** Any subset of the nested preference keys; the server deep-merges it. */
export type AccountPreferencesPatch = {
  notifications?: {
    inApp?: Partial<NotificationChannelPreferences>;
    email?: Partial<NotificationChannelPreferences>;
  };
  defaultBoardVisibility?: BoardVisibilityPreference;
};

export const DEFAULT_PREFERENCES: AccountPreferences = {
  notifications: {
    inApp: { mentions: true, invitationResponses: true },
    email: { mentions: true, invitationResponses: true },
  },
  defaultBoardVisibility: "private",
};

export type MyProfile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  username: string | null;
  avatarUrl: string | null;
  avatarColor: string | null;
  displayName: string | null;
  jobTitle: string | null;
  bio: string | null;
  pronouns: string | null;
  timezone: string | null;
  accentColor: string | null;
  phone: string | null;
  profileVisibility: ProfileVisibility | null;
  preferences?: AccountPreferences;
  createdAt: string;
};

export type PublicProfile = {
  id: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  avatarColor: string | null;
  accentColor: string | null;
  jobTitle: string | null;
  bio: string | null;
  pronouns: string | null;
  timezone: string | null;
  email: string | null;
  phone: string | null;
  createdAt: string;
};

export async function getMyProfile(): Promise<MyProfile> {
  const { data } = await httpClient.get<MyProfile>("/account/me/profile");
  return data;
}

export async function updateMyProfile(
  patch: Partial<Omit<MyProfile, "preferences">> & { preferences?: AccountPreferencesPatch },
): Promise<MyProfile> {
  const { data } = await httpClient.patch<MyProfile>("/account/me/profile", patch);
  return data;
}

export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const { data } = await httpClient.get<{ available: boolean }>(
    "/account/users/username-available",
    { params: { u: username } },
  );
  return data.available;
}

export async function getPublicProfile(
  userId: string,
  boardId?: string,
): Promise<PublicProfile> {
  const { data } = await httpClient.get<PublicProfile>(
    `/account/users/${userId}/profile`,
    { params: boardId ? { boardId } : undefined },
  );
  return data;
}

export async function uploadAvatar(file: File, onProgress?: (p: number) => void) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await httpClient.post<{ avatarUrl: string | null }>(
    "/account/me/avatar",
    form,
    {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    },
  );
  return data;
}

export async function removeAvatar() {
  const { data } = await httpClient.delete<{ avatarUrl: string | null }>("/account/me/avatar");
  return data;
}
/**
 * Permanently deletes the signed-in account and everything it owns. The server
 * verifies the password, clears the session cookies, and returns once done.
 */
export async function deleteMyAccount(params: { password: string }): Promise<void> {
  await httpClient.delete("/account/me", {
    data: { password: params.password, confirmation: "DELETE" },
  });
}
