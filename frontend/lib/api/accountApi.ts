import { httpClient } from "./httpClient";

/**
 * Profile pictures.
 *
 * Unlike `mediaApi`, an avatar is a single field on the account rather than a
 * listable attachment: uploading replaces the previous picture (the server
 * destroys the old asset), and the response carries the new URL.
 *
 * `MAX_AVATAR_BYTES` mirrors the backend's `MAX_AVATAR_BYTES`, so the user finds
 * out about an oversized image before spending the upload on it.
 */
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export type AvatarResponse = {
  avatarUrl: string | null;
};

export async function uploadAvatar(
  file: File,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
): Promise<AvatarResponse> {
  const form = new FormData();
  form.append("file", file);

  const { data } = await httpClient.post<AvatarResponse>("/account/me/avatar", form, {
    // Override the client's JSON default so axios leaves the FormData alone and
    // lets the browser set the multipart boundary.
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (event) => {
      if (onProgress && event.total) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    },
    signal,
  });

  return data;
}

export async function removeAvatar(): Promise<AvatarResponse> {
  const { data } = await httpClient.delete<AvatarResponse>("/account/me/avatar");
  return data;
}