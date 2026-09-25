'use client'

import { useCallback, useEffect, useState } from 'react'
import type { SocialMediaAttachment } from '@/lib/kali/store/schema'

const STORAGE_KEY = 'kali-media-library'

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

function readStore(): MediaLibraryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as MediaLibraryItem[]
  } catch {
    return []
  }
}

function writeStore(items: MediaLibraryItem[]) {
  try {
    // Cap the number of library entries to avoid localStorage overflow.
    const trimmed = items.slice(0, 60)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
    listeners.forEach((l) => l(trimmed))
  } catch {
    // Storage may be full — drop silently
  }
}

export function useMediaLibrary() {
  const [items, setItems] = useState<MediaLibraryItem[]>(readStore)

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
    const next = [entry, ...readStore().filter((i) => i.id !== entry.id)]
    writeStore(next)
    return entry
  }, [])

  const removeFromLibrary = useCallback((id: string) => {
    writeStore(readStore().filter((i) => i.id !== id))
  }, [])

  return { items, addToLibrary, removeFromLibrary }
}
