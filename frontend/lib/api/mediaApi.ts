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
  /** Cloudinary `public_id`, used to destroy the asset later. */
  publicId?: string;
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

/**
 * Some browsers report an empty MIME type for less common extensions (`.mov`,
 * `.m4v`, ...). Fall back to the extension so the server can still classify
 * the file instead of rejecting it as an unsupported type.
 */
const EXTENSION_MIME: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  mov: "video/quicktime",
  webm: "video/webm",
  ogv: "video/ogg",
  avi: "video/x-msvideo",
  mpeg: "video/mpeg",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  pdf: "application/pdf",
  txt: "text/plain",
};

export function mimeTypeFor(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_MIME[ext] ?? "application/octet-stream";
}

/** True when the file should bypass the server proxy and go straight to Cloudinary. */
function needsDirectUpload(file: File): boolean {
  const mime = mimeTypeFor(file);
  // Videos are always direct: they routinely exceed what a serverless
  // function will accept in a request body. Anything else over the limit goes
  // direct too, well under the ~4.5MB body cap.
  return mime.startsWith("video/") || file.size > 3 * 1024 * 1024;
}

export async function uploadMedia(
  files: File[],
  scope: MediaScope = {},
  onProgress?: UploadProgress
): Promise<MediaDto[]> {
  if (files.length === 0) return [];

  // Route videos and large files through a direct (signed) Cloudinary upload to
  // bypass the serverless body limit; small files keep the proxy path.
  const direct: File[] = [];
  const proxy: File[] = [];
  for (const f of files) {
    if (needsDirectUpload(f)) direct.push(f);
    else proxy.push(f);
  }

  const results: MediaDto[] = [];

  if (proxy.length > 0) {
    const form = new FormData();
    for (const file of proxy) form.append("files", file);
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

    results.push(...data.items);
  }

  for (const file of direct) {
    results.push(await uploadMediaDirect(file, scope, onProgress));
  }

  return results;
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

/** Direct (signed) upload to Cloudinary for large files / videos, bypassing the
 *  serverless body limit. Returns a registered MediaDto. */
export async function uploadMediaDirect(
  file: File,
  scope: MediaScope = {},
  onProgress?: UploadProgress
): Promise<MediaDto> {
  const { data: sig } = await httpClient.post<{
    cloudName: string
    apiKey: string
    timestamp: number
    signature: string
    folder: string
  }>('/media/signature', { boardId: scope.boardId, cardId: scope.cardId })

  const form = new FormData()
  form.append('file', file)
  form.append('api_key', sig.apiKey)
  form.append('timestamp', String(sig.timestamp))
  form.append('signature', sig.signature)
  form.append('folder', sig.folder)
  form.append('use_filename', 'true')
  form.append('unique_filename', 'true')

  const uploadUrl = `https://api.cloudinary.com/v1_1/${sig.cloudName}/auto/upload`
  const uploaded: { secure_url: string; public_id: string; resource_type: string } = await new Promise(
    (resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', uploadUrl)
      xhr.upload.onprogress = (e) => {
        if (onProgress && e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100))
        }
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText))
          } catch {
            reject(new Error('Invalid Cloudinary response'))
          }
        } else {
          reject(new Error(`Cloudinary upload failed (${xhr.status})`))
        }
      }
      xhr.onerror = () => reject(new Error('Network error during upload'))
      xhr.send(form)
    }
  )

  const { data } = await httpClient.post<{ item: MediaDto }>('/media/register', {
    boardId: scope.boardId,
    cardId: scope.cardId,
    name: file.name,
    url: uploaded.secure_url,
    publicId: uploaded.public_id,
    mimeType: mimeTypeFor(file),
    sizeBytes: file.size,
    resourceType: uploaded.resource_type || 'auto',
  })
  return data.item
}
