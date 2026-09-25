const API_BASE = process.env.NEXT_PUBLIC_KALI_API_URL

export const isRemoteEnabled = Boolean(API_BASE)

interface ApiResponse<T> {
  ok: boolean
  data?: T
  error?: string
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  if (!API_BASE) throw new Error('Remote API is not configured')
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  const json: ApiResponse<T> = await res.json()
  if (!json.ok) throw new Error(json.error ?? 'API request failed')
  return json.data as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

export async function uploadFile(file: File): Promise<{
  storageUrl: string
  name: string
  size: number
  mimeType: string
}> {
  if (!API_BASE) throw new Error('Remote API is not configured')
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${API_BASE}/media/upload`, { method: 'POST', body: formData })
  const json: ApiResponse<{ storageUrl: string; name: string; size: number; mimeType: string }> =
    await res.json()
  if (!json.ok) throw new Error(json.error ?? 'Upload failed')
  return json.data!
}
