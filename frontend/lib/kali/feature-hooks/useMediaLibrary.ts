'use client'

import { useCallback, useEffect, useState } from 'react'
import type { SocialMediaAttachment } from '@/lib/kali/store/schema'
import { LEGACY_MEDIA_LIBRARY_KEY, mediaLibraryKey } from '@/lib/kali/store/storage'
import { useCurrentUserId } from '@/lib/hooks/auth/useMeQuery'

export interface MediaLibraryItem {
  id: string
  type: SocialMediaAttachment['type']
  name: string
  mimeType?: string
  size: number
  dataUrl: string
  platformCompat: SocialMediaAttachment['platformCompat']
  addedAt: string
}

type Listener = (items: MediaLibraryItem[]) => void
const listeners = new Set<Listener>()

function readStore(userId: string | null): MediaLibraryItem[] {
  if (!userId) return []
  try {
    // The old shared library lived only in this browser; hand it to the first
    // account that opens it rather than lose it.
    const legacy = localStorage.getItem(LEGACY_MEDIA_LIBRARY_KEY)
    if (legacy !== null) {
      if (localStorage.getItem(mediaLibraryKey(userId)) === null) {
        localStorage.setItem(mediaLibraryKey(userId), legacy)
      }
      localStorage.removeItem(LEGACY_MEDIA_LIBRARY_KEY)
    }
    const raw = localStorage.getItem(mediaLibraryKey(userId))
    if (!raw) return []
    return JSON.parse(raw) as MediaLibraryItem[]
  } catch {
    return []
  }
}

function writeStore(items: MediaLibraryItem[], userId: string | null) {
  if (!userId) return
  try {
    // Cap the number of library entries to avoid localStorage overflow.
    const trimmed = items.slice(0, 60)
    localStorage.setItem(mediaLibraryKey(userId), JSON.stringify(trimmed))
    listeners.forEach((l) => l(trimmed))
  } catch {
    // Storage may be full — drop silently
  }
}

export function useMediaLibrary() {
  const userId = useCurrentUserId()
  const [items, setItems] = useState<MediaLibraryItem[]>(() => readStore(userId))

  useEffect(() => {
    const listener = (next: MediaLibraryItem[]) => setItems(next)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  const addToLibrary = useCallback((media: SocialMediaAttachment | MediaLibraryItem) => {
    const entry: MediaLibraryItem = {
      id: media.id,
      type: media.type,
      name: media.name,
      mimeType: media.mimeType,
      size: media.size,
      dataUrl: media.dataUrl,
      platformCompat: media.platformCompat ?? [],
      addedAt: new Date().toISOString(),
    }
    const next = [entry, ...readStore(userId).filter((i) => i.id !== entry.id)]
    writeStore(next, userId)
    return entry
  }, [userId])

  const removeFromLibrary = useCallback((id: string) => {
    writeStore(readStore(userId).filter((i) => i.id !== id), userId)
  }, [userId])

  return { items, addToLibrary, removeFromLibrary }
}
