import { httpClient } from "./httpClient";

/**
 * Uploads and deletes media through the backend's Cloudinary pipeline.
 *
 * Files never touch this app: the multipart body goes to `POST /api/media`,
 * which streams it to Cloudinary and returns a durable HTTPS `url`. Callers
 * store that URL (and the returned `id`, used to delete the asset later) rather
 * than a base64 `dataUrl`, so nothing bulky ends up in the browser store.
 */

export type MediaKind = "image" | "video" | "audio" | "document";

export interface MediaDto {
  id: string;
  boardId: string | null;
  cardId: string | null;
  kind: MediaKind;
  name: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface MediaScope {
  boardId?: string | null;
  cardId?: string | null;
}

export type UploadProgress = (percent: number) => void;

/** The server caps a batch at 10 files (`uploadMedia.array('files', 10)`). */
export const MAX_MEDIA_FILES_PER_UPLOAD = 10;

export async function uploadMedia(
  files: File[],
  scope: MediaScope = {},
  onProgress?: UploadProgress
): Promise<MediaDto[]> {
  if (files.length === 0) return [];

  const form = new FormData();
  for (const file of files) form.append("files", file);
  if (scope.boardId) form.append("boardId", scope.boardId);
  if (scope.cardId) form.append("cardId", scope.cardId);

  const { data } = await httpClient.post<{ items: MediaDto[] }>("/media", form, {
    // Override the client's JSON default so axios leaves the FormData alone and
    // lets the browser set the multipart boundary.
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (event) => {
      if (onProgress && event.total) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    },
  });

  return data.items;
}

export async function uploadMediaFile(
  file: File,
  scope: MediaScope = {},
  onProgress?: UploadProgress
): Promise<MediaDto> {
  const [item] = await uploadMedia([file], scope, onProgress);
  if (!item) throw new Error("The upload returned no media.");
  return item;
}

export async function deleteMedia(id: string): Promise<void> {
  await httpClient.delete(`/media/${id}`);
}
